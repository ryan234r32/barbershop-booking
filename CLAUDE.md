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

### Booking Creation Flow (critical path)
1. Validate input with Zod → 2. Fetch service → 3. Upsert user → 4. Check `user.bookingRestricted` → 5. **Acquire Redis lock** → 6. **Double-check slot availability** inside lock → 7. Create booking in DB → 8. Schedule reminders (async) → 9. Send LINE confirmation (async) → 10. **Release lock in finally block**

### Cron Jobs (vercel.json)
- `/api/cron/reminders` — every 15 min, sends pending notification records via LINE
- `/api/cron/cleanup` — daily 3AM, maintenance tasks
- `/api/cron/at-risk` — weekly Monday 4AM, CRM segmentation updates

## Key Conventions
- All dates use **Asia/Taipei** timezone — always use `nowTaipei()` for current time
- Slot times are always `"HH:00"` format (hourly slots)
- `tenantId` is on every table and every DB query (multi-tenant)
- Use `getAdminFromCookie(request)` for admin auth — takes `NextRequest` param
- Use `errorResponse(error)` for all API error responses — handles custom error classes + generic 500
- Prisma 7: datasource URL goes in `prisma.config.ts`, NOT in `schema.prisma`
- LINE Bot SDK v10: use `Client` from legacy API, `pushMessage(userId, message)`
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
