# PRD V2 實作計畫

> **版本:** 1.0
> **日期:** 2026-04-05
> **狀態:** 計畫階段，等待開始實作
> **用途:** PRD V2 實作前的完整規劃藍圖，整合 CEO Review 成果、老闆訪談、競品研究

**相關文件：**
- [PRD V1（原始）](./PRD.md) — 保留作為參考
- [PRD V2（待寫）](./PRD-v2.md) — 即將寫入
- [第一次老闆訪談](./第一次老闆訪談.md)
- [老闆訪談](./老闆訪談.md)
- [競品研究與商業模式分析](./competitive-research.md)
- LIFF 設計文件: `~/.gstack/projects/ryan234r32-barbershop-booking/ryan-main-design-20260402-230045.md`

---

## Context

開發者透過 `/office-hours` 完成了 LIFF 設計文件（已批准），並進行了老闆訪談。發現最大痛點是「時間」而非「漏單」，且老闆在手機上管理預約（非桌面）。2026-04-05 追加了大量新需求（設定化、onboarding tour、營運報表、商業模式研究等）。現在需要寫 PRD V2，取代過時的 V1 PRD。

## CEO Review — Key Decisions

- **Product Strategy:** 先讓 1008 用得離不開，再考慮第二家店
- **Mode:** SELECTIVE EXPANSION
- **Approach:** 全新 PRD V2（保留 V1 作為參考）
- **Business Model:** 訂閱制（業界 99% 採用此模式）

---

## PRD V2 Scope

### IN SCOPE (現在做)

#### 1. LIFF 客人端重新設計

- 單頁預約流程（取代 5 步驟 wizard）
- **日曆 + 時段同頁面顯示**（點日期直接在下方看到時段，不跳轉）
- Rich Menu 6 格
- LINE Flex Messages 品牌化 + 美感優化
- 改期功能（不只是取消）
- 智慧時段推薦（smart-suggest.ts 上線，Phase 1）
- 取消釋出通知（waitlist — 時段空出時通知等候客人）
- 一鍵加入 Google Calendar（已存在，保留）

#### 2. Admin 手機優先體驗（重點擴充）

**2.1 主畫面：今日時間軸**
- 老闆在剪頭髮空檔打開手機，第一眼看到今日時間軸
- 顯示每個時段：時間、客人名、服務、狀態
- 一鍵操作：標記完成 / 標記爽約 / 查看客人資料

**2.2 日曆視圖**
- 可切換週 / 月檢視
- 每個預約顯示為可點擊區塊
- 點擊彈出預約詳情：姓名、性別、備註、電話

**2.3 服務管理（手機版）**
- 新增 / 編輯 / 停用服務
- 每個服務欄位：名稱、圖片、說明、時長（分鐘）、價格
- 圖片上傳功能（手機相簿直接選）

**2.4 營業設定（手機版）**
- 開放預約時段設定（星期幾、幾點到幾點）
- **最多提前預約天數**（可設定，預設 30 天）
- **最少提前預約時間**（可設定，預設 1 小時）
- 假日管理

**2.5 營運報表頁面**
- 每日現金流
- 今日總收款
- 各支付管道明細：現金、信用卡、銀行匯款、LINE Pay
- 本週 / 本月營收趨勢

**2.6 PWA 支援（加分項，非必要）**
- 加 manifest.json + service worker
- 老闆可「加到主畫面」，有 app 的使用體驗
- 實作成本約 30 分鐘
- 穩定性：與一般網頁相同

#### 3. 店家 Onboarding 導覽（體驗導向，非設定導向）

**重要前提：** 1008 是客製化模式，系統設定由開發者在訪談時完成。Onboarding 的目標不是「幫老闆設定系統」，而是「帶老闆體驗系統怎麼幫他」。降低 Time to Value。

**5 步驟體驗流程：**
1. 「這是你今天的行事曆」→ 看到真實預約資料
2. 「點一下這個預約」→ 看到客人詳情（來幾次、上次做什麼）
3. 「客人剪完了？滑一下標記完成」→ 體驗操作
4. 「看看客人在 LINE 裡看到什麼」→ 理解客人端體驗
5. 「完成！客人會自己預約了」→ 對應痛點摘要

**注意：** 設定型 Onboarding（填店名、綁帳號、建服務）留給未來 SaaS 版。

#### 4. LINE Flex Message 美感優化

- 所有 Flex Message 統一品牌色系
- 深度研究 LINE Flex Message 設計最佳實踐
- 歡迎訊息、價目表、確認通知、提醒通知全部重新設計

#### 5. 設計先行流程

- 每個新頁面 / 畫面先做 HTML mockup
- 工具組合：
  - `/design-shotgun` — 生成多個 AI 設計變體
  - `/design-consultation` — 建立完整設計系統
  - 開發者用 Google Stitch 等工具提供外部設計參考
- 確認後才開始寫 code

#### 6. 商業模式實作

- 訂閱制架構（Tenant model 已有 plan 欄位）
- 免費試用 30 天計時
- 方案升級 / 降級流程
- 付費提醒通知（試用到期、續約）
- **暫不實作金流**（老闆確認後再加）

### NOT IN SCOPE (以後做)

- 線上金流（等老闆確認需求 + 商業登記）
- 完整行銷套件（基本 campaigns 已有）
- 評價系統（等多人店）
- Apple Calendar
- Redis rate limiting（等多店）
- 多設計師排班（等第二家店）
- 跨行業特化功能（塔羅、汽車美容等）

---

## 待老闆確認問題

1. **預約窗口：** 最多提前幾天？最少提前幾小時？（暫定 30 天 / 1 小時）
2. **服務照片：** 有沒有各服務的示意照可用？
3. **營業報表：** 最想看哪些數字？（每日收款 / 客流量 / 熱門服務）
4. **Onboarding：** 現有設定中有沒有想改的？（例如預約窗口）
5. **品牌色：** 1008 Hair Studio 的品牌色是什麼？
6. **IG / FB 帳號：** 要顯示在 LINE 裡嗎？

---

## 待開發者自行體驗研究

1. 下載 [Fresha](https://www.fresha.com/) 體驗預約流程
2. 找一家用 [夯客](https://hotcake.app/) 的美髮店實際預約
3. 試用 [Booksy](https://booksy.com/)（mobile-first 標竿）
4. 截圖記錄讓你覺得「smooth」和「皺眉」的瞬間

---

## 關鍵檔案

**要寫的新檔案:**
- `docs/PRD-v2.md` — 全新 PRD V2

**參考檔案:**
- `docs/PRD.md` — 原始 PRD V1（保留）
- `docs/老闆訪談.md` — 老闆訪談逐字稿
- `docs/第一次老闆訪談.md` — 第一次訪談紀錄
- `docs/competitive-research.md` — 競品研究與商業分析
- `~/.gstack/projects/ryan234r32-barbershop-booking/ryan-main-design-20260402-230045.md` — LIFF 設計文件
- `~/.gstack/projects/ryan234r32-barbershop-booking/ceo-plans/2026-04-02-prd-v2-liff-admin-redesign.md` — CEO plan

**現有可重用程式碼:**
- `src/lib/booking/smart-suggest.ts` — 已存在，Phase 1 上線
- `src/lib/booking/availability.ts` — 時段計算
- `src/lib/booking/lock.ts` — Redis lock
- `src/lib/line/messages.ts` — Flex Message builders（需美感優化）
- `src/components/ui/toast.tsx` — Toast system
- `src/lib/notifications/scheduler.ts` — 通知排程（waitlist 通知可擴展）
- `prisma/schema.prisma` — 已有 Tenant plan 欄位支援訂閱制

---

## 實作順序

### Phase 0: PRD V2 + 設計系統（CC+gstack: 半天）
1. 寫 `docs/PRD-v2.md`
2. 跑 `/design-consultation` 建立品牌色系與設計系統
3. 產出 `DESIGN.md`

### Phase 1: LIFF 客人端（CC+gstack: 1-2 天）
1. 設計先行：用 /design-shotgun 做 mockup
2. 單頁預約流程 + smart suggest
3. **日曆 + 時段同頁面設計**
4. Rich Menu + Flex Messages
5. 觀察門檻：老闆 + 3 位客人試用

### Phase 2: Admin 手機優先（CC+gstack: 2-3 天）
1. 設計先行：手機版 Admin mockup
2. 今日時間軸
3. 日曆視圖（週 / 月切換）
4. 服務管理（含圖片上傳）
5. 營業設定（預約窗口可設定）
6. 營運報表
7. Onboarding 導覽
8. PWA 支援（可選）
9. 觀察門檻：老闆在剪頭髮時用手機操作

### Phase 3: 進階功能（CC+gstack: 1 天）
1. 改期 API + UI
2. 取消釋出通知（waitlist）
3. 訂閱制 UI（方案顯示、試用到期提醒）
4. 品牌統一

---

## 驗證方式

1. `npm run test` — 所有 235+ 測試通過
2. `npm run build` — production build 成功
3. LINE LIFF 環境實測（iPhone + Android）
4. 老闆觀察門檻測試
5. 設計先行流程：每個頁面先有 HTML mockup 被批准
6. Admin 頁面 mobile viewport（375px width）測試

---

## GSTACK Review 紀錄

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 2 | CLEAR | 5 proposals, 3 accepted, 1 skipped, 4 deferred |
| Codex Review | `/codex review` | Independent 2nd opinion | 0 | — | — |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | STALE | 2 issues found, now stale |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | — | — |

**VERDICT:** CEO CLEARED — eng review stale, re-run required before implementation.

---

**下一步建議：**
1. 先讀 [competitive-research.md](./competitive-research.md) 了解市場定位
2. 等老闆回答 6 個問題後，開始寫 PRD V2
3. 跑 `/design-consultation` 建立設計系統
4. 跑 `/plan-eng-review` 確認技術架構
