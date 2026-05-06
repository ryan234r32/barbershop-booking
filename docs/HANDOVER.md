# 系統交付手冊

> 給接手者：30 分鐘讀完，30 天內就能獨立操作整個系統。

## 你接到的是什麼

**1008 Hair Studio LINE 預約系統**：以 LINE 為核心、客戶在 LINE 內完成預約 → 老闆在後台 (admin) 管理 → 自動推播提醒 → 自動產出報表的一站式系統。

**核心功能：**
- 客戶端（LINE LIFF）：預約 / 改期 / 取消 / 查詢 / 上傳轉帳截圖 / 領優惠券 / 抽獎
- 店家端（管理後台 PWA）：日曆 / 報到 / 結帳 / 對帳 / 客戶 CRM / 三視角報表（每日/每月/每年）/ 行銷推播 / 服務管理 / 公休設定 / 支出記帳
- 系統：9 條自動 cron 工作（提醒、CRM 分群、週報、日結、ECPay 對帳、優惠券到期、health-check）
- 監控：Sentry 錯誤追蹤 + LINE 緊急推播 + 每日 11:00 安全稽核 + 每日 03:00 (UTC) DB 備份（90 天保留）

完整功能規格見 [PRD.md](PRD.md)、[PRD-v3.md](PRD-v3.md)，最近的改版計畫見 v3.x-*-plan.md 系列。

## 你會用到 7 個外部服務

| 服務 | 角色 | 月費 | 接手要做的事 |
|---|---|---|---|
| **Vercel** | 網站 hosting + cron | $0 (Hobby) / $20 (Pro) | 把 GitHub 連結權限轉給你；env vars 都已設好 |
| **Supabase** | PostgreSQL 資料庫 + 客戶截圖儲存 | $0 (Free) | 把專案 owner 換成你；DB 連線字串、Service Role Key 在 .env.example |
| **Upstash Redis** | 防重複預約鎖 | $0 (Free) | 帳號 invite 給你；REST URL + Token 在 env |
| **LINE Developers** | LINE Bot + LIFF | $0 + 訊息費 | 把 Channel admin 加你；ChannelID/Secret/AccessToken/LIFF ID 都在 env |
| **Sentry** | 錯誤追蹤（出包自動推 LINE 給老闆） | $0 (Dev) | DSN 在 env；登入用 GitHub OAuth |
| **ECPay** | 線上金流（綠界 ATM 虛擬帳號） | 抽 0.5-2% 手續費 | 商家後台帳號移交；HashKey/HashIV 在 env |
| **GitHub** | 原始碼 | $0 | repo 加你 collaborator |

> 全部移交流程見「**帳號移交 checklist**」章節。

## 第一週：先別動任何東西

**Day 1 — 老闆陪你跑一次完整流程**

跟著老闆的 LINE 帳號跑一次：
1. 客人加 LINE 好友 → 看歡迎訊息
2. 在 LINE 內點下方選單 → 開預約 LIFF → 預約一個剪髮
3. 收到預約確認 Flex 訊息
4. 老闆從 admin 後台看到這筆預約（PWA 可加到主畫面）
5. 老闆按「報到」→ 客人 status 變更
6. 老闆按「結帳」→ 選付款方式（現金 / 銀行轉帳）
7. 客人收到「服務完成 + 寫評論連結」訊息

**Day 2-3 — 看著系統自動跑**

不操作，純看。
- 早上 11:00 看 GitHub Actions 跑 security-daily（會自動 commit 報告到 `docs/security-reports/YYYY-MM-DD.md`）
- 早上 11:00 看 Vercel cron 跑 db-backup-daily（在 GitHub Actions tab）
- 看 admin 後台「儀表板」是否正常顯示今日預約
- LINE 看老闆收到的自動通知（新預約 / 取消 / 客人匯款）

**Day 4-7 — 練熟 5 個最常用操作**

詳見 [OPERATIONS.md](OPERATIONS.md)。重點：
1. 手動建預約（電話來的客人）
2. 取消預約 / 改期
3. 標 no-show（爽約）
4. 看每日營業日結
5. 客戶 CRM 查詢

## 第一個月：學會用報表做生意決策

**Week 2 — 推第一次行銷**
- `/admin/campaigns` 推一次「VIP 客戶 8 折」或「沉睡客戶回來剪髮」push
- 後台會自動分群（NEW / REGULAR / VIP / AT_RISK / LAPSED），不用自己挑客戶
- ⚠ 推播次數受 LINE 月費方案限制，先看 LINE Developer Console 的 quota

**Week 3 — 用報表發現一件事**

去 `/reports?view=monthly` 看上個月。系統會自動產一段「自然語言摘要」，例如：
> 「本月營收 12.3 萬（YoY +15%），染髮客單比上月跌 8% — 主因是 4/14 後染髮客 23% 流失到 AT_RISK 群組。建議：對該群組推染髮 9 折券。」

照著做。看下個月有沒有效。

**Week 4 — 調整服務 / 價格 / 公休**
- `/admin/services` 改服務（名稱、價格、時段數、圖片）
- `/admin/settings` 改營業時間 / 公休日
- 改完後請務必跑一次預約測試流程，確保 LIFF 顯示正常

**Day 30 — 看 retention push 效果**
- `/admin/retention-push` 看自動召回推播的 7 天趨勢
- 規則寫在 `src/lib/notifications/retention-push.ts:RETENTION_RULES`：剪 35/49/70 天、染 31/56/90 天、燙 90/120/150 天，分軟提醒 / 9 折 / 8 折召回三段
- ⚠ Demo 前 6 題 (B1-B6) 要跟老闆確認折扣金額、燙髮樣本是否啟用 — 詳見 plan §14.8

## 帳號移交 checklist

> 賣方 → 買方。建議當面對齊一次，每改一個就打勾。

- [ ] **GitHub repo** — 賣方 settings → collaborators → 邀請買方為 admin
  - 確認買方有 `gh` CLI 或 GitHub Desktop 裝好可以 clone
- [ ] **Vercel** — settings → members → invite 買方為 owner（不是 viewer）
  - 確認 Production env vars 對買方 visible（Vercel dashboard → Project → Settings → Environment Variables）
- [ ] **Supabase** — Organization settings → invite 買方
  - 拿到 Project Ref + DB password；確認可以連到 Studio
  - 把 service role key 重新生一組（賣方手上的舊 key revoke）
- [ ] **Upstash** — team → invite member（或直接把帳號密碼給買方並改密碼）
  - 重新生一組 REST Token，更新 Vercel env
- [ ] **LINE Developers Console** — Provider → Channel → role tab → 加買方為 Admin
  - Provider 也要加（不只 Channel）
  - LIFF apps 不用個別加權限
  - **重要**：Channel Access Token 用「Long-lived」，不是 short-lived；確認 Webhook URL 還是 prod 網域
- [ ] **Sentry** — Organization → Members → invite
  - 確認 alerts 還是寄給對的 email
  - DSN 不用換（同一個 project）
- [ ] **ECPay 綠界** — 商家後台帳號移交（這個流程綠界自己有規範，找他們客服）
  - ⚠ 從 Stage（測試）切到 Production 模式時，HashKey / HashIV 會換 — 必須同步更新 Vercel env，不然金流會掛
  - 退款流程也要走綠界後台，系統不負責退款
- [ ] **`.env.local`** — 賣方手上的本機 env 檔案不要傳給買方，讓買方從 `.env.example` 自己建

完成後跑一次 `/api/health` (https://barbershop-booking-ryan234r32s-projects.vercel.app/api/health) 確認 DB + Redis 都 ok，然後手動觸發一次 LINE webhook（從 LINE Developers Console 的 Verify 按鈕）確認 webhook 路線通。

## 出包了找誰

**先看哪裡：**
1. **Vercel Dashboard** → 最新 deployment 的 Logs tab — 最常見的問題（build 掛、API 500）都在這
2. **Sentry** → 最近 24h 的 issues — JS 錯誤、LINE webhook 失敗
3. **GitHub Actions** → security-daily / db-backup-daily 的執行歷史

**緊急聯絡（賣方提供）：**
- 賣方本人 LINE / 電話（買方記下，前 30 天遇到問題優先打）
- 各家服務的客服（Vercel support / Supabase Discord / LINE 開發者 Forum）

**自學最快的路：**
- 讀 [`CLAUDE.md`](../CLAUDE.md) — 這是給 AI 助手用的，但人讀也很清楚架構 + landmines
- 讀 [`docs/RUNBOOK.md`](RUNBOOK.md) — 出包時翻這本
- 讀 [`docs/OPERATIONS.md`](OPERATIONS.md) — 日常操作 cookbook

## 衍生文件索引

| 文件 | 用途 | 給誰看 |
|---|---|---|
| [OPERATIONS.md](OPERATIONS.md) | 日常 admin 操作 cookbook | 老闆 / 店員 |
| [RUNBOOK.md](RUNBOOK.md) | 出包時的處理 SOP | 老闆 + 技術接手人 |
| [TECHNICAL-HANDOVER.md](TECHNICAL-HANDOVER.md) | 開發環境 / 部署 / 改 code | 技術接手人 |
| [BUYER-VALIDATION.md](BUYER-VALIDATION.md) | 交付驗收 checklist | 買賣雙方 |
| [PRD.md](PRD.md) | 完整功能規格 | 想了解全貌的人 |
| [`uptime-monitoring-setup.md`](uptime-monitoring-setup.md) | 外部監控（Better Stack / UptimeRobot）設定 | 技術接手人 |
| [`web-push-setup.md`](web-push-setup.md) | PWA 推播設定 | 技術接手人 |
| [`rich-menu-setup.md`](rich-menu-setup.md) | LINE 圖文選單設定 | 老闆 / 技術接手人 |

## 系統現狀（截至 2026-05-06）

- **Production deploy**: `dd791dc chore(pre-handover): security hardening + lint/dep cleanup (#101)`
- **Tests**: 1807 passing (vitest)
- **Security audit**: 0 critical, 0 high CVEs ([.gstack/security-reports/](../.gstack/security-reports/))
- **健康指標**:
  - `/api/health` 200 (DB + Redis ok)
  - 9 個 cron 都正常排程
  - 1169 筆 prod booking 真實數據已導入（從歷史 Excel）
  - 47% 一次性客戶 / 50% 佔用率 / 3.36 年訪頻率（基線指標）
- **已知技術債**（不影響運作）:
  - `src/middleware.ts` 在 Next 17 會被改名 `proxy.ts` — 接手後找時間遷移
  - JWT 30 天 session 沒有伺服器端 revocation list — 單店單管理員不影響，多店要加
  - 行銷推播折扣金額（B1-B6）需要老闆親自答覆才能啟用 retention-push cron

詳細交接 status 見 [`docs/session-handoff-2026-04-29.md`](session-handoff-2026-04-29.md)。
