# 理髮廳 — 顧客痛點 Roadmap

> **三份檔案的分工**：
> - 本檔（roadmap）— 要去哪（**未來**）
> - [顧客痛點Roadmap互動表.html](顧客痛點Roadmap互動表.html) — 拖拉看板（**現在**）
> - [開發日記/](開發日記/) — 走過哪（**過去**，每日 5 行格式，敘事 + TIL）
>
> 三者各司其職，不要重複內容。
>
> **線上版**：deploy 後可在 `https://barbershop-booking-swart.vercel.app/roadmap.html` 開啟（手機可加到主畫面當 app）。同 source code 在 `public/roadmap.html`，跟著 Next.js app 一起部署。
>
> **跨裝置同步**：用 HTML 介面右上角的「匯出 JSON」存到 iCloud Drive / Google Drive，另一台「匯入 JSON」讀回來。沒有自動 sync（每台 localStorage 各自獨立）— 要全自動 sync 之後再做（接 Supabase 即可）。

## PM 工作原則

1. **Now 最多 3 件** — 限制 WIP，避免什麼都想做。
2. **先問為什麼** — 每張卡要有痛點、證據、下一步。
3. **先 Shape 再 Build** — 模糊的東西先放 Next / Waiting，問清楚再進 Now。
4. **可靠性是產品力** — 試用前先有 timeout、fallback、checkpoint、救援步驟。
5. **指標刪除機制** — 月/年報每個指標問：老闆看到後能做什麼決策？答不出來就降級。

---

## 現在處理 (NOW · 上限 3-4 件)

### P20 · 日曆「新增預約」流程改版 — DOING
- **痛點**：admin 從日曆建單流程不順，老闆會回頭用 LINE 手動處理。
- **下一步**：盤點 `new-booking-sheet.tsx`(331 行) 與 `calendar/*` 整合 → 收斂欄位 → 縮短建單步數 → 與已報到 / 結帳串起來。
- **來源**：Ryan 2026-05-04

### P16 · 預防機制 / 救援手冊 — DOING
- **痛點**：資料遺失、錯誤、連線超時、第三方掛掉時要能救援。試用前的可靠性基礎。
- **下一步**：列高風險情境 → 偵測方式 → 預防方案 → 救援步驟 → 驗證測試。
- **現況**：已有 `/api/health`、Sentry、daily backup、audit log、ECPay timeout、Redis lock、recurring expense idempotent guard。
- **來源**：Ryan 2026-05-03 + V3.8 P0 prevention

### P11 · 支出 / 淨利頁深化 — DOING
- **痛點**：產品要從『預約工具』升級成『經營工具』。
- **現況**：expenses API、ExpenseEntrySheet、daily close、月報/年報損益分解都已就位。
- **下一步**：ExpenseEntrySheet UX 收斂 → daily close 整合 → 月報每月支出歸納 → 年報結構驗證。
- **來源**：Ryan 2026-05-03 + V3.7 finance tab

### P17 · 月報 / 年報該呈現什麼 — DOING
- **痛點**：不要再堆指標。月報回答『這個月哪裡偏掉？下個月要調什麼？』；年報回答『全年健康？明年策略？』
- **下一步**：為每個指標問：老闆看到後能做什麼決策？答不出來就降級或刪掉。
- **來源**：Ryan 2026-05-03

---

## 下一個 (NEXT)

### P03 · 諮詢分流：漂髮、燙染、45 天外預約
- **痛點**：自選漂髮容易出錯，45 天外服務變動大，需要先收資料再讓老闆看。
- **下一步**：等 I0/I1 服務確認表 → 設計『先收資料、不直接建單』流程。

### P07 · LINE keyword 自動回覆 + 燙染漂 Flex 卡
- **痛點**：老闆重複打字回答前置問題很耗時。
- **下一步**：等 I0 回覆 → 自動問答只收資料、漂髮直接進諮詢隊列。

### P15 · 顧客完成後回饋 / 評價
- **痛點**：目前沒有正式回饋管道，產品改進無資料來源。
- **下一步**：決定方式（LINE 簡訊 / LIFF 短表單）→ 最小可行版本。

### P18 · 試用觀察 / 回饋迴圈 (45 天)
- **痛點**：缺正式 learning loop，容易做很多但不知道是否真的變好。
- **下一步**：每週記錄 3 個訊號：老闆省時、顧客採用率、人工介入點。也追蹤 P06 採用習慣。

### P19 · 資料備份 / 還原演練
- **痛點**：預防機制不能只寫『有備份』；正式試用前至少演練一次『資料錯了怎麼回復』。
- **下一步**：模擬資料錯誤 → 找備份 → 還原到安全環境 → 驗證資料正確。

### P09 · 行銷 / 回購 / 優惠券
- **痛點**：報表收斂後才有判斷依據（推給誰、推什麼、怎麼看成效）。
- **下一步**：等 P11 + P17 完成；先做最小召回券 A/B。

---

## 等老闆 / 卡住 (WAIT)

### P12 · 服務項目重構（價格 + 時間 + 自動/人工分流）
- **卡點**：服務組合、自動 vs 人工的邊界要老闆親口確認。
- **動作**：等老闆填 `服務項目確認表-給老闆-2026-04-24.xlsx` 後，重構 services。
- **要確認**：價格、時間、組合（染+護髮）、不能單獨預約的項目、漂髮/45 天外是否強制諮詢。

### P02 · 老闆是否要主動推播召回 / 回購券
- **卡點**：推播時機、折扣金額、文案語氣需要老闆決定品牌調性。
- **動作**：等 V3.6 §14.8 B1-B6 答覆 → 啟用 retention-push cron。

---

## 延後處理 (LATER)

- **P10 · 月報指標 → 行銷 A/B 完整化** — 等 P17 + P09 有資料後再做。
- **P13 · Admin 諮詢隊列 UI 整併** — 試用觀察期看老闆是否真的需要。
- **P14 · 拖拉行事曆 / Calendar 進階操作** — 1145 行 calendar 重構是高風險，demo 後才動。
- **P01 · LIFF 加 LINE 流程優化** — 已能用，沒有阻塞。
- **P04 · Admin app 整併** — V3.8 已做主要整併，剩餘為 nice-to-have。

---

## 已完成 (DONE)

### P05 · 對帳：現金/轉帳分類
原本紅黑字混淆，已收斂為付款方式 pill。V3.7 finance tab 已上線。

### P06 · 結帳金額快速記錄（決策：不做主動提醒）
**原想**：服務結束前 20 分跳結帳卡。
**決策改為**：老闆主動打開 App → 點日曆顧客 → 點已報到 → 進結帳頁。
**理由**：系統不主動跳資訊，由老闆培養 App 操作習慣。
**追蹤**：P18 試用觀察會看老闆是否養成；若沒養成，再考慮入口設計。

### P08 · 顧客分群（新/熟/VIP/流失）
新客定義改為『店內首次』而非 LINE 註冊；用 1169 筆 Excel 真實資料 spot-check 過。V3.5 已上線。

---

## 定期習慣 + GStack 節奏

> 詳細節奏與 pipeline 見 [開發日記/README.md](開發日記/README.md#gstack-使用節奏-solo-founder)

| 節奏 | 主要動作 | GStack skills |
|------|----------|---------------|
| **每日 ≤ 10 分** | 推進 1 件、commit | `npm run preflight` |
| **每週日 30-60 分** | Weekly retro + health audit | `/retro` → `/health` → `/triage` → `/gstack-upgrade` |
| **每月一次 1-2 小時** | 安全 + 文件 + 反思 | `/cso comprehensive` → `/document-release` → `/learn` |
| **新功能 pipeline** | 鎖架構 → 實作 → 上線 → 監控 | `/plan-eng-review` → (高風險加 `/codex`) → `npm run preflight` → `/review` → `/ship` → `/land-and-deploy` → `/canary` |
| **修 bug pipeline** | 根因 → 修復 → 審查 → 上線 | `/investigate` → fix → `/review` → `/ship` |
| **試用期間每週** | 記錄老闆省時、LIFF 採用率、人工 LINE 介入點 | （手動寫進日記） |

---

## 每日進度日誌

> Claude 每天 session 收尾時會更新這段（最新在最上面）。

### 2026-05-04
- **做了什麼**：
  - Roadmap 三件套（MD + HTML + 開發日記）整合完畢；上線到 `public/roadmap.html`
  - HTML 加 Founder Score（4 軸 0-100：WIP / 速度 / 週期 / 學習）+ Coach 提醒 + 自動 timestamp
  - 設計 gstack 節奏（每日 / 週日 / 月底 + per-feature/bug pipeline）
  - 加入 Import/Export JSON、＋新卡片、＋今日進度按鈕（mobile-friendly）
  - 三份 memory feedback 設定好：收工自動寫日記 + gstack 節奏主動建議
- **明天接續**（按優先級）：
  1. 回填 NOW 卡片的 `startedAt`（P11/P16/P17/P20）讓 cycle time 統計有資料 — 在 `docs/顧客痛點Roadmap互動表.html` 的 DEFAULT_CARDS 改，5 分鐘
  2. 把 Founder Score 計分公式文件化進 `docs/開發日記/README.md`，15 分鐘
  3. commit + push 部署（用 `/ship`），這樣 phone 才能從 `https://barbershop-booking-swart.vercel.app/roadmap.html` 開
  4. 回到 P20 日曆新增預約 — 讀 `src/components/admin/new-booking-sheet.tsx` 找 friction
  5. P16 預防機制 — 列高風險情境 + 救援步驟表
  6. P11 ExpenseEntrySheet UX 收斂

<!-- 新進度往上插入。每段格式：### YYYY-MM-DD / 做了什麼 / 明天接續 -->
