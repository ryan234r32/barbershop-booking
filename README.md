# 1008 Hair Studio — LINE 預約系統

> 以 LINE 為核心的理髮廳預約管理系統

## 功能特色

### 顧客端 (LINE LIFF)
- LINE 內即時預約（選服務→選日期→選時段→確認）
- 查看/取消預約
- 銀行轉帳截圖上傳

### 店家管理後台
- 即時儀表板 + 今日時程
- 行事曆視圖（日/週）
- 顧客 CRM（自動分群：NEW→REGULAR→VIP→AT_RISK→LAPSED）
- 三視角報表（每日 / 每月 / 每年） + 對帳工作流（color rail + 異常排前）
- 結帳工作流（quick-tile 折扣 + 加購商品 + 熟客自動帶折扣）
- 集中支出總覽（月份切換 + 即時搜尋 + 分類 filter）
- 染/燙/漂諮詢自動引導（LINE 關鍵字 → Flex Message）
- 服務項目管理 + 營業時間 + 公休提醒（30/60 天內未設月份 banner）

### 系統功能
- LINE Bot Webhook（關鍵字回覆 + Quick Reply + 染燙漂自動諮詢 Flex）
- Rich Menu 底部選單
- 自動提醒通知（24h + 1h）
- 智慧時段推薦（晚段優先 — 老闆早段陪家人）
- 取消政策 + 違規追蹤
- Redis 分散式鎖防重複預約
- 月初公休提醒 cron（每月 1 號推 LINE 提醒設下下月公休）

## Tech Stack

- Next.js 16 (App Router) + TypeScript + Tailwind CSS
- Prisma 7 + PostgreSQL (Supabase)
- Upstash Redis (distributed locks)
- LINE Messaging API + LIFF v2
- Vercel (deploy + cron jobs)

## Getting Started

### Prerequisites
- Node.js 20+
- PostgreSQL (or Supabase account)
- LINE Official Account + Messaging API Channel
- Upstash Redis account

### Setup
```bash
npm install
cp .env.example .env  # Fill in environment variables
npm run db:push       # Push schema to database
npm run db:seed       # Seed initial data
npm run dev           # Start dev server
```

### Environment Variables
See `.env.example` for the full list with setup instructions.

## Deployment
Deploy to Vercel with `vercel deploy`. Cron jobs are configured in `vercel.json`.

## Scripts
```bash
npm run dev          # Development server
npm run build        # Production build
npm run test         # Run tests
npm run lint         # ESLint
npm run db:studio    # Prisma Studio
npm run db:seed      # Seed data
```

## 交付文件

如果你是接手者（買主 / 老闆 / 技術接手人），先讀對應的這份：

| 你是 | 先讀 |
|---|---|
| 買主 / 新老闆 | [docs/HANDOVER.md](docs/HANDOVER.md) — 主交付文件 + 30 天上手計畫 |
| 老闆 / 店員（日常操作） | [docs/OPERATIONS.md](docs/OPERATIONS.md) — Top 10 admin 操作 cookbook |
| 出包了 | [docs/RUNBOOK.md](docs/RUNBOOK.md) — 10 種常見 incident SOP |
| 技術接手人 | [docs/TECHNICAL-HANDOVER.md](docs/TECHNICAL-HANDOVER.md) — clone repo 到 ship prod 完整路徑 |
| 驗收當下對照 | [docs/BUYER-VALIDATION.md](docs/BUYER-VALIDATION.md) — 90 分鐘 7-phase 驗收 checklist |
| 想了解全貌 | [docs/PRD.md](docs/PRD.md) + [CLAUDE.md](CLAUDE.md) |
