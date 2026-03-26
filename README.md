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
- 營運分析 + 熱力圖 + CSV 匯出
- 服務項目管理 + 營業時間設定

### 系統功能
- LINE Bot Webhook（關鍵字回覆 + Quick Reply）
- Rich Menu 底部選單
- 自動提醒通知（24h + 1h）
- 智慧時段推薦
- 取消政策 + 違規追蹤
- Redis 分散式鎖防重複預約

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
