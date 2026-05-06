# 交付驗收 checklist

> 給買賣雙方。建議買方人在現場、賣方陪跑一次，每打勾一項就同步推進。

## 為什麼要這份

驗收不是儀式，是**避免事後爭議**：
- 買方確認「東西真的會動」
- 賣方確認「我交完就沒責任了」
- 雙方留紀錄

預估走完全流程：**90 分鐘**。

## Phase 1 — 帳號權限移交（30 分鐘）

每打勾一項，買方需要當場：(a) 用自己 device 登入，(b) 確認看得到 admin / billing 介面。

- [ ] **GitHub** — 買方 collaborator 加完，clone repo 成功，看得到全部分支與歷史
- [ ] **Vercel** — 買方為 owner，看得到 Production deployment list 跟 env vars
- [ ] **Supabase** — 買方 organization member，看得到 Project / Studio / billing
- [ ] **Upstash** — 買方 team member（或自家帳號），看得到 Redis console
- [ ] **LINE Developers Console** — 買方為 Channel + Provider Admin，看得到 Webhook + Messaging API quota + LIFF apps
- [ ] **Sentry** — 買方加進 Organization，看得到 issues
- [ ] **ECPay 綠界** — 商家後台帳號移交完成（依綠界規範）

> 如果有任一項只是「賣方還持有但答應之後給」— **不算驗收完成**。當場 invite 才是真的。

## Phase 2 — 安全姿態確認（10 分鐘）

買方自己跑這幾個指令（賣方不碰鍵盤）：

- [ ] `git pull origin main` — 拉到最新 commit
- [ ] `npm install` — install OK
- [ ] `npm run preflight` — typecheck + lint + test 全綠（**1807+ tests passing**）
- [ ] `npm audit` — 0 high, 0 critical
- [ ] `curl https://barbershop-booking-ryan234r32s-projects.vercel.app/api/health`
  - 回 `{"status":"ok","checks":{"database":"ok","redis":"ok"}}`
- [ ] 用 `curl -I` 看 Production response header — 確認有：
  - [ ] `Content-Security-Policy: default-src 'self'; ...`
  - [ ] `X-Frame-Options: DENY`
  - [ ] `X-Content-Type-Options: nosniff`

## Phase 3 — 客戶端流程（20 分鐘）

買方拿自己的 LINE 帳號（**不要用賣方的測試帳號**）：

- [ ] 加店家 LINE 好友 — 收到歡迎 Flex 訊息（含「立即預約」按鈕）
- [ ] 點 LINE 下方圖文選單 — 6 個按鈕都會回對應內容（預約 / 我的預約 / 服務價格 / 匯款 / 取消改期 / 聯絡店家）
- [ ] 點「立即預約」進 LIFF — 顯示服務 carousel
- [ ] 預約剪髮（1 個時段）— 收到「預約成功」Flex
- [ ] 預約染髮（3-4 個時段，跨午休應該擋住）— 顯示對應錯誤
- [ ] LIFF「我的預約」— 看到剛剛那筆預約
- [ ] LIFF「改期」— 改成另一個時段，收 LINE 通知
- [ ] LIFF「取消」（確認 24h 政策） — 收 LINE 取消確認

## Phase 4 — 老闆端流程（20 分鐘）

買方用 admin 帳號登入 admin 後台：

- [ ] `/login` — 用賣方提供的 admin 帳號登入成功
- [ ] **立刻去 `/admin/settings` 改密碼** — 賣方手上那組不能繼續用
- [ ] `/calendar` — 看到 Phase 3 預約的那筆 booking
- [ ] 點該 booking → 全頁 sheet 打開 — 看到客戶資訊、服務項目、CRM segment
- [ ] 點「已報到」segment — 客人 status 變 checked_in
- [ ] 點「進行結帳」按鈕 — 結帳 modal 打開
- [ ] 選付款方式（現金）→ 完成結帳 — booking status 變 COMPLETED
  - [ ] 客人收到「服務完成 + Google 評論連結」Flex
- [ ] `/reports?view=daily` — 看到剛剛的營收 +1 筆
- [ ] `/admin/customers` — 看到 Phase 3 客戶在列表，segment 標籤正確

## Phase 5 — 自動化系統（10 分鐘）

驗證 cron + webhook + 監控還在跑：

- [ ] [Vercel Dashboard → Crons](https://vercel.com) — 9 條 cron 都顯示 last run 在 24h 內
- [ ] [GitHub Actions](https://github.com) → security-daily 最近一次 run 是綠的
- [ ] [GitHub Actions](https://github.com) → db-backup-daily 最近一次 run 有產 artifact
- [ ] LINE Developers Console → Webhook → 點 Verify — 回 200 OK
- [ ] Sentry → Issues → 確認最近 24h 沒有 unresolved P0 issue
- [ ] 在 LINE 對 bot 講「服務」 — 收到服務 carousel（驗證 webhook + LINE API token）

## Phase 6 — 災難復原 drill（10 分鐘，建議但可選）

買方在指導下做一次：

- [ ] GitHub Actions → db-backup-daily → 下載最新 artifact
- [ ] `gunzip` + 連到一個**臨時** Supabase project（不是 prod）
- [ ] `psql $TEMP_DIRECT_URL < backup.sql` — restore 完成
- [ ] 在 Supabase Studio 隨便 SELECT 一張表 — 資料看得見
- [ ] 刪掉臨時 project

> 跑這一遍才會真正「相信備份」。賣方走後出狀況時，這個信心很重要。

## Phase 7 — 文件確認（5 分鐘）

買方點開以下檔案，至少瀏覽過一次：

- [ ] [`HANDOVER.md`](HANDOVER.md) — 主交付文件
- [ ] [`OPERATIONS.md`](OPERATIONS.md) — 日常操作 cookbook
- [ ] [`RUNBOOK.md`](RUNBOOK.md) — 出包處理 SOP
- [ ] [`TECHNICAL-HANDOVER.md`](TECHNICAL-HANDOVER.md) — 技術接手指南
- [ ] [`CLAUDE.md`](../CLAUDE.md) — 系統架構 + landmines

## 賣方收尾（驗收通過後）

- [ ] 把賣方手上的 `.env.local` / 各服務密碼**手動**清掉（不是 delete file，是覆蓋寫亂碼再刪）
- [ ] 從各服務 invite list 把賣方自己 remove（**買方先確認上面 6 個服務都登得進去**才做這步）
- [ ] git log 寫一筆 final commit（這份 BUYER-VALIDATION.md 的勾選 markdown），打 tag `handover-vYYYY-MM-DD`
- [ ] 賣方把交付文件正本（簽字版）跟買方各留一份

## 驗收簽字

> 雙方簽字日期 = 服務完成日期 = 後續責任歸屬切換點

| 角色 | 姓名 | 簽字 | 日期 |
|---|---|---|---|
| 賣方 | __________ | __________ | __________ |
| 買方 | __________ | __________ | __________ |
| 見證（如有） | __________ | __________ | __________ |

驗收後若 7 天內出現「**驗收當下確實 OK 但事後才發現的 critical bug**」，賣方協助修復；超過 7 天屬於正常維運，買方自負。

（這條建議寫進交付合約，不只是這份 markdown。）
