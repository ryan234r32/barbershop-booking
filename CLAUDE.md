# 理髮廳 LINE 預約系統

## Tech Stack
- Next.js 16 (App Router) + TypeScript + Tailwind CSS + shadcn/ui
- Prisma 7 + PostgreSQL (Supabase) — config in `prisma.config.ts`, NOT `schema.prisma`
- Upstash Redis — distributed booking locks
- LINE: @line/bot-sdk v10 (legacy Client API) + @line/liff v2
- Vercel deployment + Cron Jobs
- Auth: custom JWT with httpOnly cookies

## Project Structure
- `src/app/(liff)/` — Customer-facing LIFF pages (booking, my-bookings, payment)
- `src/app/(admin)/` — Admin dashboard (dashboard, calendar, customers, services, settings, analytics)
- `src/app/login/` — Admin login (outside admin route group to avoid auth redirect loop)
- `src/app/api/` — All API routes
- `src/lib/booking/` — Core booking engine (availability, lock, cancellation)
- `src/lib/line/` — LINE client, messages, webhook verification
- `src/lib/notifications/` — Reminder scheduling and sending
- `src/lib/crm/` — Customer segmentation
- `src/lib/auth/` — Admin JWT auth
- `src/lib/liff/` — LIFF provider context
- `src/lib/admin/` — Admin auth context

## Key Conventions
- All dates use Asia/Taipei timezone (+08:00)
- Slot times are always "HH:00" format (hourly slots)
- tenantId is on every table for multi-tenant support
- Use `getAdminFromCookie(request)` for admin auth — takes NextRequest param
- `errorResponse(error)` handles all API error responses
- Prisma 7: datasource URL goes in `prisma.config.ts`, NOT in `schema.prisma`
- LINE Bot SDK v10: still use `Client` from legacy API, `pushMessage(userId, message)`
- Admin login page is at `/login` (outside `(admin)` route group)

## Business Rules
- Business hours: 11:00-20:00, 1-hour slots (9 slots/day)
- Haircut = 1 slot, Perm/Color = 3-4 consecutive slots
- Cancellation: previous day = free; same day + business hours = call only; same day + after hours = online but violation
- 3 violations = restricted to phone booking for 1 month
- Payment: cash or bank transfer only (no online payment)

## Running
```bash
npm run dev           # Start dev server
npm run db:generate   # Generate Prisma client
npm run db:push       # Push schema to database
npm run db:seed       # Seed demo data
```
