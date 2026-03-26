# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Tech Stack
- Next.js 16 (App Router) + TypeScript + Tailwind CSS + shadcn/ui
- Prisma 7 + PostgreSQL (Supabase) — config in `prisma.config.ts`, NOT `schema.prisma`
- Upstash Redis — distributed booking locks (`@upstash/lock`)
- LINE: @line/bot-sdk v10 (legacy Client API) + @line/liff v2
- Vercel deployment + Cron Jobs
- Auth: custom JWT with httpOnly cookies (`admin_token`)

## Commands
```bash
npm run dev              # Start dev server
npm run build            # Production build
npm run lint             # ESLint
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
- `src/app/(liff)/` — Customer LIFF pages (booking, my-bookings, payment), wrapped by `LiffProvider`
- `src/app/(admin)/` — Admin dashboard, wrapped by `AdminProvider` (checks auth on mount via `/api/auth/me`)
- `src/app/login/` — Admin login, **outside** `(admin)` route group to avoid auth redirect loop
- `src/app/api/` — All API routes

### Core Libraries
- `src/lib/booking/` — Availability engine (dynamic slot calculation), Redis lock, cancellation policy
- `src/lib/line/` — LINE client singleton, Flex Message builders, webhook signature verification
- `src/lib/notifications/` — DB-based scheduler (creates records picked up by cron)
- `src/lib/auth/jwt.ts` — `signAdminToken()`, `verifyAdminToken()`, `getAdminFromCookie(request)`
- `src/lib/utils/errors.ts` — `AppError`, `SlotUnavailableError`, `BookingRestrictedError`, `CancellationNotAllowedError`
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

### Booking Creation Flow (critical path)
1. Validate input with Zod → 2. Fetch service → 3. Upsert user → 4. Check `user.bookingRestricted` → 5. **Acquire Redis lock** → 6. **Double-check slot availability** inside lock → 7. Create booking in DB → 8. Schedule reminders (async) → 9. Send LINE confirmation (async) → 10. **Notify admin via LINE** (async) → 11. **Release lock in finally block**

### Cron Jobs (vercel.json, times in UTC → +8 for Taipei)
- `/api/cron/reminders` — hourly, sends pending notification records via LINE
- `/api/cron/cleanup` — 19:00 UTC (3AM Taipei), maintenance tasks
- `/api/cron/at-risk` — Sunday 20:00 UTC (Monday 4AM Taipei), CRM segmentation
- `/api/cron/weekly-report` — Sunday 22:00 UTC (Monday 6AM Taipei), push weekly report to admin

## Key Conventions
- All dates use **Asia/Taipei** timezone — always use `nowTaipei()` for current time
- Slot times are always `"HH:00"` format (hourly slots)
- `tenantId` is on every table and every DB query (multi-tenant)
- Use `getAdminFromCookie(request)` for admin auth — takes `NextRequest` param
- Use `errorResponse(error)` for all API error responses — handles custom error classes + generic 500
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
- Cancellation: previous day = free; same day + business hours = call only; same day + after hours = online but violation
- 3 violations = restricted to phone booking for 1 month
- Payment: cash or bank transfer only (no online payment)
- CRM segments: NEW → REGULAR → VIP, or AT_RISK (60d inactive) → LAPSED (120d)

## Environment Variables
Required: `DATABASE_URL`, `JWT_SECRET`, `DEFAULT_TENANT_ID`
LINE: `LINE_CHANNEL_ID`, `LINE_CHANNEL_SECRET`, `LINE_CHANNEL_ACCESS_TOKEN`, `NEXT_PUBLIC_LIFF_ID`
Redis: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`
Optional: `ADMIN_LINE_USER_ID` — LINE user ID of the shop owner; enables push notifications for new bookings and cancellations
