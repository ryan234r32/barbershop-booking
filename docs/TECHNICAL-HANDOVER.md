# Technical Handover

> 給技術接手者：clone repo 到上線 prod 的完整路徑，加上你會踩到的雷。

## TL;DR

```bash
git clone <repo>
cd barbershop-booking
npm install                  # postinstall 會跑 prisma generate
cp .env.example .env.local   # 從賣方拿到實際值填進去
npm run db:push              # schema 推到你新建的 Supabase project
npm run db:seed              # 灌 demo 資料 + 印出 DEFAULT_TENANT_ID
npm run dev                  # localhost:3000
```

`npm run preflight` 全綠就可以推 PR。1807+ tests，CI 在 Vercel preview 跑。

## Stack

讀 [`CLAUDE.md`](../CLAUDE.md) 的 Tech Stack + Architecture 兩節。重點：

- **Next.js 16** App Router + Turbopack(dev) / webpack(prod build)
- **Prisma 7** + Supabase Postgres — schema in `prisma/schema.prisma`，但 datasource URL 在 `prisma.config.ts`（**不是** schema.prisma — 7.x 開始）
- **Upstash Redis** — `@upstash/lock` 防重複預約
- **Vercel** — host + cron + Sentry sourcemap upload
- **LINE @line/bot-sdk v10** — legacy Client API，`pushMessage(userId, message)`
- **Auth**:
  - Admin：custom JWT (HS256, 30d) in `admin_token` httpOnly cookie + `Authorization: Bearer` header fallback (iOS PWA)
  - LIFF customer：LINE ID Token 在每個 request 用 `X-LIFF-ID-Token` header 傳，server 跟 `api.line.me/oauth2/v2.1/verify` 驗

## 第一次跑起來

### 1. 建 Supabase 專案

- [supabase.com](https://supabase.com) → New Project
- 拿 Connection String — **兩個都要**：
  - `DATABASE_URL` = `postgresql://postgres.[REF]:[PW]@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres` (pooler, port 6543)
  - `DIRECT_URL` = port 5432 版本（給 `prisma db push` / migration / db-backup-daily 用）
- ⚠ **landmine**: `prisma db push` 讀 `.env`，**不讀** `.env.local`。要嘛把 DIRECT_URL 也放 `.env`，要嘛 export 到 shell

### 2. 建 Upstash Redis

- [upstash.com](https://upstash.com) → Create Database (REST API enabled)
- 拿：`UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`

### 3. 設 LINE Channel + LIFF

完整見 `docs/rich-menu-setup.md` 跟 LINE 官方文件。重點：

- 建 **Messaging API Channel**
  - `LINE_CHANNEL_ID` / `LINE_CHANNEL_SECRET` / `LINE_CHANNEL_ACCESS_TOKEN` (Long-lived)
- 建 **LIFF App**（綁這個 Channel）
  - `NEXT_PUBLIC_LIFF_ID`
  - LIFF endpoint URL = `https://yourdomain.com/booking`（或開發時的 ngrok URL）
- 設 **Webhook URL** = `https://yourdomain.com/api/webhook`，按 Verify
- Channel 要把 「使用 LINE Login」打開（LIFF 才會回傳 ID Token）

### 4. 產 secrets

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"  # JWT_SECRET
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"  # CRON_SECRET
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"  # UPTIME_WEBHOOK_SECRET
```

### 5. push schema + seed

```bash
npm run db:push      # schema → Supabase
npm run db:seed      # 印出 DEFAULT_TENANT_ID — 抄到 .env.local
```

### 6. dev server

```bash
npm run dev
# localhost:3000/login → 用 prisma/seed.ts 印出的 admin email + password 登入
```

### 7. ngrok / Vercel preview 接 LINE webhook

LINE webhook 必須是 https public URL。本機 dev 用：

```bash
ngrok http 3000
# 拿 https://xxx.ngrok.io
# LINE Console → Webhook URL = https://xxx.ngrok.io/api/webhook → Verify
```

或 push 到 PR，用 Vercel preview URL。

## Prod 部署

### Vercel project 設定

1. Import repo → Vercel detects Next.js → 接受預設 build/dev commands
2. **Environment variables** — 從 `.env.example` 一條一條加。**三個環境都要設**（Production / Preview / Development），不然 preview build 會掛在 module-load env throw（前車之鑑：landmine §1.3 + commit `2079e78` JWT lazy-load）
3. **Cron jobs** 在 `vercel.json` 已宣告 — Vercel 自動排程
   - Hobby plan：每天最多 1 次 → 影響 `health-check` cron
   - Pro plan：daily limit 才解開
4. **Domain**：Settings → Domains → 加自訂域名（或用 `xxx.vercel.app`）
   - Vercel 自動 issue Let's Encrypt cert + HSTS
5. **Sentry**：在 Vercel env 設 `SENTRY_DSN` + `SENTRY_AUTH_TOKEN`（後者沒設會跳過 sourcemap upload）

### Cron schedule reference

寫在 `vercel.json` + CLAUDE.md「Cron Jobs」章節：

| Path | Schedule (UTC) | Taipei | 用途 |
|---|---|---|---|
| `/api/cron/reminders` | `0 1 * * *` | 09:00 | 推 24h / 1h 預約提醒 |
| `/api/cron/cleanup` | `0 19 * * *` | 03:00 | 清過期記錄 |
| `/api/cron/at-risk` | `0 20 * * 0` | Mon 04:00 | CRM 分群更新 |
| `/api/cron/weekly-report` | `0 22 * * 0` | Mon 06:00 | 推週報給老闆 |
| `/api/cron/daily-settlement` | `30 12 * * *` | 20:30 | 推日結摘要 |
| `/api/cron/coupon-expiry-reminder` | `0 2 * * *` | 10:00 | 券到期前 ping |
| `/api/cron/ecpay-sweeper` | `0 3 * * *` | 11:00 | 掃 stale ECPay 訂單 |
| `/api/cron/recurring-expenses` | `30 16 * * *` | 00:30 (next day) | 自動建定期支出 |
| `/api/cron/health-check` | `0 1 * * *` | 09:00 | self-ping |

退一步：`/api/cron/retention-push`（每日 02:00 UTC / 10:00 Taipei）— V3.6 三段服務分群推播。在 vercel.json 嗎？要看現況，可能需要加。

## 開發 workflow

每天的節奏：

```bash
git checkout -b feat/xxx
# 寫 code
npm run preflight             # typecheck + lint + test
git commit -m "..."
git push -u origin feat/xxx
gh pr create
# 等 Vercel preview build 通過
# 自己去 preview URL 點一遍
gh pr merge --squash
```

**強制守則**：
- 永遠跑 preflight 才 commit。CLAUDE.md landmine 第一條
- 不直接 push main（branch protection 擋）
- PR 至少看一次 Vercel preview 才 merge
- Squash merge（保持 main 線性）

## 關鍵 landmines（節錄 CLAUDE.md，也請完整讀 CLAUDE.md）

1. **TZ — `nowTaipei()` 在 Vercel 上會 double-shift**。要 Taipei 日期字串用 `todayInTaipei()` from `src/lib/utils/time.ts`
2. **iOS PWA full-page sheet 必須 `h-[100dvh]` 不是 `h-[100vh]`**，不然鍵盤彈出時 footer 變浮動
3. **OCC pattern**：所有 booking 修改 endpoint 都帶 `expectedUpdatedAt`，後端 `updateMany WHERE updatedAt = <prev>`，count=0 → 409 stale_write
4. **Tenant include 必須用 `select` 白名單** — 不要 `tenant: true`，會洩 `lineAccessToken` / `bankAccountNumber`
5. **knip 看不到 CSS `@import`** — 移 dep 前必 `grep -rE "from|@import.*<pkg>" src/`
6. **CSP 必須含 `fonts.googleapis.com` + `fonts.gstatic.com`**（Manrope / Noto Sans TC）
7. **`prisma db push` 讀 `.env` 不讀 `.env.local`**

## CI / Auto-checks

- `.github/workflows/security-daily.yml` — 每天 11:00 Taipei 跑 `npm audit` + `gitleaks` + `trivy fs` + `tsc --noEmit`，commit 報告到 `docs/security-reports/YYYY-MM-DD.md`
- `.github/workflows/db-backup-daily.yml` — 每天 11:00 Taipei `pg_dump` → artifact 保留 90 天

兩個 workflow 的第三方 actions 都 SHA-pinned（gitleaks + trivy）。bump 流程：

```bash
gh api repos/<owner>/<repo>/git/refs/tags/<tag> --jq '.object.sha'
# 替換 .github/workflows/*.yml 的 SHA
```

## 加新功能的 SOP

1. 開 issue / TODO 文件
2. 寫 plan markdown 進 `docs/v3.x-feature-plan.md`
3. （可選）跑 `/plan-eng-review` 跨 model review
4. 切 feature branch
5. 寫 code + tests
6. `npm run preflight` 通過
7. 推 PR，等 Vercel preview build 過
8. 看 preview URL 自己點一遍
9. （可選）跑 `/review` 做 pre-landing 審查
10. squash merge → 自動部署 prod
11. 更新 CLAUDE.md（如有新 landmine 或新架構）

## 常用工具腳本

`scripts/` 目錄有幾個有用的 one-shot：

- `scripts/import-historical-excel.ts` — 從 Excel 灌歷史 booking（已執行過 1169 筆，留檔做 reference）
- `scripts/clean-test-data.ts` — 清測試資料（**`--commit` 才會真正執行，預設 dryrun**）
- `scripts/generate-reports-snapshot.ts` — 產報表快照（給 demo 用）
- `scripts/list-test-bookings.ts` — debug 用查 booking
- `scripts/smoke-ecpay.ts` — ECPay 端到端煙霧測試（dev server 起著才能跑）
- `scripts/restore-from-backup.sh` — DB 災難復原半自動腳本

## Test infrastructure

- `vitest.config.ts` — 單元 + 整合
- `vitest.setup.ts` — global mocks
- 每個 module 旁邊的 `__tests__/` 資料夾
- 跑單一檔：`npx vitest run src/lib/path/to/__tests__/file.test.ts`

## 接手後第一週要做的技術事

1. **跑一次完整 preflight + smoke test** — 確認 1807 tests 全綠
2. **驗證所有 cron** — Vercel Dashboard → Crons tab → 看 last run / 每條都 ok
3. **驗證 secrets 都換新** — 賣方手上的 JWT_SECRET / CRON_SECRET 不能繼續用
4. **訂閱 alerts** — Sentry 加自己 email；Vercel notifications 加自己；GitHub repo 加自己 watch
5. **跑一次 DB backup restore drill** — 下載最新 backup → 還原到一個臨時 Supabase project → 確認資料完整。**這比讀 docs 有用 10 倍**

## 接手後 30 天可以做的整理

- 把 `docs/PRD-v2.md` / `PRD-v2-plan.md` / `PRD-v2.1-decisions.md` 等舊檔案 archive 進 `docs/archive/`
- 把 `tasks/lessons-inbox.md` 跑一次 `/triage` 升格通則進 CLAUDE.md
- 跑一次 `/cso comprehensive` 看當下安全姿態
- 跑一次 `/health` 看 code 品質
- 把 `src/middleware.ts` 改名 `src/proxy.ts`（Next 17 deprecation）

## 後續重大功能候選

依 product priority：

1. **金流串接升級** — 目前 ECPay ATM only，可加信用卡、APP Pay（見 `tasks/payment-gateway-tier-s.md`）
2. **多店 SaaS** — schema 已 `tenantId` 化，前端 routing 還沒（見 PRD V4.0）
3. **Calendar drag-to-reschedule** — week view 拖拉改期（commit `c68ab50` 之前先 demo 過）
4. **顧客評價系統** — Google review 已接，可加站內評論（見 PRD V3.0）

詳見 [`docs/顧客痛點功能Roadmap.md`](顧客痛點功能Roadmap.md)
