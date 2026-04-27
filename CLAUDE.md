# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Tech Stack
- Next.js 16 (App Router) + TypeScript + Tailwind CSS + shadcn/ui
- Prisma 7 + PostgreSQL (Supabase) — config in `prisma.config.ts`, NOT `schema.prisma`
- Upstash Redis — distributed booking locks (`@upstash/lock`)
- LINE: @line/bot-sdk v10 (legacy Client API) + @line/liff v2
- Vercel deployment + Cron Jobs
- Auth: admin via custom JWT cookie (`admin_token`) + Authorization Bearer fallback for iOS PWA; LIFF customers via LINE ID token verified server-side against `api.line.me/oauth2/v2.1/verify`

## Commands
```bash
npm run dev              # Start dev server
npm run build            # Production build
npm run lint             # ESLint
npm run typecheck        # tsc --noEmit
npm run preflight        # typecheck + lint + test — run before EVERY commit
npm run test             # Run all tests (vitest)
npm run test:watch       # Watch mode
npx vitest run src/path  # Run a single test file
npm run db:generate      # Generate Prisma client
npm run db:push          # Push schema to database (no migrations)
npm run db:seed          # Seed demo data
npm run db:studio        # Prisma Studio GUI
npm run db:migrate       # Create migration
```

## Architecture

### Route Groups
- `src/app/(liff)/` — Customer LIFF pages (booking, my-bookings, payment, cancel, reschedule), wrapped by `LiffProvider`
- `src/app/(admin)/` — Admin dashboard, wrapped by `AdminProvider` (checks auth on mount via `/api/auth/me`)
- `src/app/login/` — Admin login, **outside** `(admin)` route group to avoid auth redirect loop
- `src/app/api/` — All API routes

### Core Libraries
- `src/lib/booking/` — Availability engine (dynamic slot calculation), Redis lock, cancellation policy
- `src/lib/line/` — LINE client singleton, Flex Message builders, webhook signature verification
- `src/lib/notifications/` — DB-based scheduler (creates records picked up by cron)
- `src/lib/auth/jwt.ts` — `signAdminToken()`, `verifyAdminToken()`, `getAdminFromCookie(request)`
- `src/lib/auth/line-liff.ts` — `verifyLiffIdToken(token, channelId)` calls LINE verify endpoint; throws `LiffTokenVerificationError` with reason `invalid|expired|wrong_audience|network`
- `src/lib/auth/booking-auth.ts` — `requireBookingAuth(request)` returns `{type:"admin",adminId,tenantId} | {type:"liff",lineUserId,displayName?,tenantId}`; admin wins if both present; throws `UnauthorizedError` otherwise
- `src/lib/utils/errors.ts` — `AppError`, `SlotUnavailableError`, `BookingRestrictedError`, `CancellationNotAllowedError`, `UnauthorizedError`; `errorResponse()` handles `AppError`, `ZodError` (→ 400 with field-level issues), and unknown errors (→ generic 500)
- `src/lib/utils/time.ts` — `nowTaipei()`, `isSameDay()`, `formatDateToISO()` — all timezone-aware
- `src/lib/utils/validation.ts` — Zod schemas for all inputs
- `src/lib/utils/constants.ts` — Business constants (`MAX_VIOLATIONS=3`, `BOOKING_LOCK_TTL_MS=10000`, etc.)

### V1.1 New Libraries
- `src/lib/notifications/admin-notify.ts` — Fire-and-forget LINE push to admin for new bookings/cancellations
- `src/lib/utils/logger.ts` — Structured logging (JSON in prod, readable in dev)
- `src/lib/utils/cron-auth.ts` — Shared cron secret verification
- `src/lib/hooks/use-page-title.ts` — Admin page title hook
- `src/components/ui/toast.tsx` — Toast notification system (ToastProvider + useToast)

### V1.1 New Pages
- `src/app/(admin)/campaigns/page.tsx` — Marketing push campaigns by customer segment
- `src/app/api/admin/campaigns/route.ts` — Campaign API (POST send, GET segment counts)
- `src/app/api/admin/export/route.ts` — Booking CSV export
- `src/app/api/admin/weekly-report/route.ts` — Weekly business report generation
- `src/app/api/health/route.ts` — Health check (DB + Redis, no auth)
- `src/app/api/cron/weekly-report/route.ts` — Auto-send weekly report to admin via LINE

### V1.2 Post-Booking Journey (new)
- `src/app/(liff)/cancel/[bookingId]/page.tsx` — Cancel confirmation page with 24h policy + "改期優先於取消" design
- `src/app/(liff)/reschedule/[bookingId]/page.tsx` — Reschedule page reusing CalendarStep
- `src/app/api/bookings/[id]/reschedule/route.ts` — Reschedule API (UPDATE, preserves booking ID + payment)
- `src/app/api/bookings/past-due/route.ts` — Admin-only: list past-due CONFIRMED bookings
- `src/app/api/cron/daily-settlement/route.ts` — 20:30 Taipei: push daily summary to admin LINE
- `src/components/ui/modal.tsx` — Reusable modal (supports non-dismissible mode)
- `src/components/admin/past-due-modal.tsx` — Forces admin to confirm 已收款/未到 for each past-due booking

### V1.3 Security Hardening (2026-04)
- `src/lib/auth/line-liff.ts` + `src/lib/auth/booking-auth.ts` — dual-path auth guard; killed body-supplied `lineUserId` impersonation
- `POST /api/bookings` no longer leaks tenant secrets — tenant include uses `select` white-list
- `errorResponse()` adds `ZodError` → 400 branch (previously surfaced as generic 500 "系統錯誤")
- Server-side validation: past-date rejection, business-hours window check (startHour + slotsNeeded ≤ closeHour)
- **Deferred TODOs:** apply `requireBookingAuth()` to `/api/bookings/[id]/reschedule` + `/cancel` (same impersonation risk); add rate limit to booking creation

### Booking Creation Flow (critical path)
0. **`requireBookingAuth(request)`** → 1. Validate input with Zod → 2. Fetch service → 2b. **Reject past dates** (Taipei TZ) + **enforce business hours** (startHour + slotsNeeded ≤ 20) → 3. Upsert user (lineUserId from auth; admin path synthesizes `manual-{adminId}-{uuid}`) → 4. Check `user.bookingRestricted` → 5. **Acquire Redis lock** → 6. **Double-check slot availability** inside lock → 7. Create booking in DB (tenant include uses `select` white-list — never returns `lineAccessToken`/`lineChannelSecret`/`bankAccountNumber`) → 8. Schedule reminders + 9. LINE confirmation (both skipped for admin-created bookings) → 10. **Notify admin via LINE** (async) → 11. **Release lock in finally block**

Body-supplied `lineUserId` is **ignored** — caller identity always comes from verified auth. LIFF clients send `X-LIFF-ID-Token: <idToken>` header; admin clients send admin JWT cookie or `Authorization: Bearer <token>`.

### Cron Jobs (vercel.json, times in UTC → +8 for Taipei)
- `/api/cron/reminders` — hourly, sends pending notification records via LINE
- `/api/cron/cleanup` — 19:00 UTC (3AM Taipei), maintenance tasks
- `/api/cron/at-risk` — Sunday 20:00 UTC (Monday 4AM Taipei), CRM segmentation
- `/api/cron/weekly-report` — Sunday 22:00 UTC (Monday 6AM Taipei), push weekly report to admin
- `/api/cron/daily-settlement` — 12:30 UTC (20:30 Taipei), push daily settlement summary to admin

## Key Conventions
- **犯錯當下**：小坑/一次性事件 → `/lesson {內容}` 丟進 `tasks/lessons-inbox.md`；明顯通則（「永遠要 X」「X 時必須 Y」）→ 直接加一行到本段 `Key Conventions`。Inbox 每週日 `/triage` 審核升格。
- **訪談問題自動累積**：當對話中出現「要問老闆」、「待老闆確認」、「跟老闆 confirm」等語意的未解問題時，**自動 Append** 到 `docs/interview-questions/pending-after-interview-{N}.md`（N = 當前最新訪談次數）。不要堆在對話中等使用者整理。分類放到 A~H 某個對應區塊；找不到對應分類就放「其他」。
- **訪談檔放入 docs/ 時自動輪替**：當使用者放入新的 `第N次老闆訪談-*.md` 或 `第N次老闆訪談逐字稿-*.md` 到 `docs/` 時，立刻執行 `python3 scripts/rotate-interview-questions.py` — 它會把舊的 pending 改名為 resolved 並建立下一階段的 pending 檔。然後比對新訪談檔內容，標註舊 pending 裡哪些問題已經解掉、哪些還沒答到。
- All dates use **Asia/Taipei** timezone — always use `nowTaipei()` for current time
- Slot times are always `"HH:00"` format (hourly slots)
- `tenantId` is on every table and every DB query (multi-tenant)
- Use `getAdminFromCookie(request)` for admin-only endpoints — takes `NextRequest` param; checks cookie first, falls back to `Authorization: Bearer`
- Use `requireBookingAuth(request)` for endpoints that create/modify bookings or customer data — accepts both admin JWT and LIFF ID token, never trusts body-supplied user IDs
- Use `errorResponse(error)` for all API error responses — handles `AppError`/`ZodError` (→ 400 with issues) + generic 500
- When including `tenant` in Prisma queries, always use `select` white-list (`id, businessName, address, phone, liffId`) — never `tenant: true`, which leaks `lineAccessToken` + `lineChannelSecret` to clients
- Use `verifyCronSecret(request)` for cron auth — from `src/lib/utils/cron-auth.ts`
- Use `logger.info/warn/error()` for structured logging — from `src/lib/utils/logger.ts`
- Use `useToast()` for user-facing notifications — NOT `alert()` — from `src/components/ui/toast.tsx`
- Prisma 7: datasource URL goes in `prisma.config.ts`, NOT in `schema.prisma`
- LINE Bot SDK v10: use `Client` from legacy API, `pushMessage(userId, message)`
- LINE messages: all builders in `src/lib/line/messages.ts`, include `quickReply: defaultQuickReply()` on all responses
- Zod for all request body validation — parse before use
- Singletons: `prisma` client (`src/lib/prisma.ts`), LINE client (`getLineClient()`)
- Path alias: `@` → `./src`

## Business Rules
- Business hours: 11:00-20:00, 1-hour slots (9 slots/day)
- Haircut = 1 slot, Perm/Color = 3-4 consecutive slots (up to 8)
- Cancellation: ≥24h before = free online; <24h = must call (not a violation); only No-show = violation
- 3 violations = restricted to phone booking for 1 month
- Payment: cash or bank transfer only (no online payment)
- CRM segments: NEW → REGULAR → VIP, or AT_RISK (60d inactive) → LAPSED (120d)

## Landmines (踩過會痛，不寫不行)
- **TZ — `nowTaipei()` is broken on UTC servers (Vercel)**: it double-shifts the moment +8h, so `.toLocaleDateString({ timeZone: 'Asia/Taipei' })` returns *tomorrow* between Taipei 16:00–24:00. For "today's Taipei date" use `todayInTaipei()` from `src/lib/utils/time.ts`. Caused a P0 demo incident on 2026-04-27. Don't `nowTaipei().toLocaleDateString(...)` — always go through `todayInTaipei()` for date-string compares. Tests in `src/lib/utils/__tests__/time.test.ts`.
- **Vaul `Drawer.Content` full-page sheets must use `h-[Ndvh]`, not `h-[Nvh]`**: `vh` is static, so the iOS keyboard pushes content above the visible viewport, leaving only the sticky footer. Applies to all admin sheets with input/textarea (BookingDetailFullPage / CheckoutFullPage / NewBookingSheet).
- **Booking-mutating sheets need a local `liveBooking` optimistic state**: parent's `selectedBooking` is a snapshot at click time; the SWR list refetch does *not* re-seed the prop. After every PATCH/POST inside the sheet, merge the response into local state. Otherwise segments + buttons stay stale until the user closes + reopens the sheet. Reference: `src/components/admin/booking-detail-full-page.tsx`.
- **OCC pattern for booking writes**: body carries `expectedUpdatedAt`; route does `prisma.booking.updateMany({ where: { id, tenantId, ...statusGuard, updatedAt: <prev> }, data })`; `count === 0` → 409 `stale_write` (also rolls back any in-flight transaction). Already applied to `/checkin`, `/no-show`, `/checkout`, `/acknowledge` — follow when adding new mutating endpoints.
- **Feature-flag the disruptive UI swaps**: V3.5 `BookingDetailFullPage` is behind `useFullPageBookingDetailFlag()` — env var `NEXT_PUBLIC_FULL_PAGE_BOOKING_DETAIL=false` or URL `?legacyBookingDetail=1` rolls back to the legacy bottom-sheet. Pattern in `src/lib/hooks/use-feature-flags.ts`.
- **`prisma db push` reads `.env`, not `.env.local`**: dotenv loads `.env` only by default; check which file has the right `DIRECT_URL` before pushing schema (Vercel `DIRECT_URL` ≠ pooler URL).
- **`npm run preflight` is the pre-commit gate**: typecheck + lint + test. Run before every commit. Catches 80% of "智障 bug" before they reach CI/prod.
- **GitHub Actions `security-daily.yml`**: runs 11:00 Taipei (npm audit + gitleaks + trivy + tsc), reports auto-committed to `docs/security-reports/YYYY-MM-DD.md`. For deeper LLM analysis run `/cso comprehensive` locally.

## Health Stack
Used by `/health`. Update if the toolchain changes.
- preflight (all three at once): `npm run preflight`
- typecheck: `npm run typecheck`  (alias: `npx tsc --noEmit`)
- lint: `npm run lint`
- test: `npm run test`
- deadcode: (not installed — consider adding `knip`)
- shell: (no shell scripts in repo)

## Environment Variables
Required: `DATABASE_URL`, `JWT_SECRET`, `DEFAULT_TENANT_ID`
LINE: `LINE_CHANNEL_ID`, `LINE_CHANNEL_SECRET`, `LINE_CHANNEL_ACCESS_TOKEN`, `NEXT_PUBLIC_LIFF_ID`
Redis: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`
Optional: `ADMIN_LINE_USER_ID` — LINE user ID of the shop owner; enables push notifications for new bookings and cancellations
Optional: `NEXT_PUBLIC_FULL_PAGE_BOOKING_DETAIL` — set to `false` to roll back V3.5 BookingDetailFullPage to the legacy bottom-sheet (default: ON).
