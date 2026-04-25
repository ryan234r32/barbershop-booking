<!-- /autoplan restore point: ~/.gstack/projects/ryan234r32-barbershop-booking/main-autoplan-restore-20260425-141529.md -->
# 理髮廳 V3 改版 PRD — 第二次老闆訪談後

| | |
|---|---|
| **版本** | v3.0 (Draft，待審核) |
| **撰寫日期** | 2026-04-24 |
| **最後更新** | 2026-04-25（融入碩展訪談） |
| **狀態** | ⏳ 待 G-stack 審核（CEO / Design / Eng / Autoplan） |
| **產品擁有者** | Ryan |
| **目標 Demo** | 第三次老闆訪談（時間待定） |
| **預估開發** | 5-6 週（1 人全職） |

### 來源資料
- [第二次老闆訪談-2026-04-15.md](/Users/ryan/Documents/VS_code/理髮廳/docs/第二次老闆訪談-2026-04-15.md) — 整理稿
- [第二次老闆訪談逐字稿-2026-04-15.md](/Users/ryan/Documents/VS_code/理髮廳/docs/第二次老闆訪談逐字稿-2026-04-15.md) — 原始逐字稿
- [用戶訪談-碩展-2026-04-15.md](/Users/ryan/Documents/VS_code/理髮廳/docs/用戶訪談-碩展-2026-04-15.md) — 協作朋友（診所經營顧問）試用反饋
- [品牌設計規範.md](/Users/ryan/Documents/VS_code/理髮廳/docs/品牌設計規範.md) — 設計 Source of Truth
- [服務項目確認表-給老闆-2026-04-24.xlsx](/Users/ryan/Documents/VS_code/理髮廳/docs/服務項目確認表-給老闆-2026-04-24.xlsx) — 等老闆填回
- [2025預約表Ken老師.xlsx](/Users/ryan/Documents/VS_code/理髮廳/docs/2025預約表Ken老師.xlsx) — 一年預約歷史
- 參考 UI：圈圈 App（日/週/月檢視截圖）
- 技術對標：Google Calendar（互動、時間軸、拖拉、縮放）

### 目錄
1. [Context — 為什麼做這次改版](#context為什麼做這次改版)
2. [本次 Session 已確認的決策（鎖定）](#本次-session-已確認的決策鎖定)
3. [範圍](#範圍)
4. [現況架構重點](#現況架構重點phase-1-探索結果)
5. [Google Calendar 技術對標](#google-calendar-技術對標要點)
6. [功能需求 §1–§12](#功能需求一段一功能含資料模型--檔案--驗證)
7. [依賴與排序](#依賴與排序建議開發順序)
8. [驗證總表](#驗證總表verification)
9. [開放問題](#開放問題等第三次訪談前問老闆)
10. [成功指標](#成功指標老闆視角1-個月後檢驗)
11. [成本 / 風險](#成本--風險)
12. [文件產出物](#文件產出物)

### 簽核欄

| 角色 | 姓名 | 狀態 | 日期 | 備註 |
|---|---|---|---|---|
| 產品擁有者 | Ryan | ⏳ pending | | |
| CEO Review | `/plan-ceo-review` | ⏳ pending | | |
| Design Review | `/plan-design-review` | ⏳ pending | | |
| Eng Review | `/plan-eng-review` | ⏳ pending | | |
| Final Gate | `/autoplan` | ⏳ pending | | |
| Stakeholder | 碩展（顧問）| ⏳ optional | | |
| Stakeholder | Ken 老闆 | ⏳ optional | | |

---

## Context（為什麼做這次改版）

V1.3（2026-04）完成安全加固後，老闆在第二次訪談中對產品核心運作提出了 8 個具體痛點，核心可歸納為：

> **「系統能解決的沉下去、需要我出馬的浮到最上面」**

目前 V1.3 是「被動接收預約 + 手動對帳」，V3 要升級為「主動分流 + 即時確認 + 諮詢專線」，讓老闆可以把堆積 1-2 小時的訊息溝通壓縮到幾分鐘，並且把需要「人腦判斷」的漂髮諮詢獨立於一般預約之外。

### 策略定位轉變（融入 [碩展訪談 4.2](/Users/ryan/Documents/VS_code/理髮廳/docs/用戶訪談-碩展-2026-04-15.md)）

| 原本定位（V1.x）| **V3 起的新定位** |
|---|---|
| 幫理髮廳提升效率、管理預約 | 除了效率，更要成為老闆的「**營收成長夥伴**」 |

核心邏輯：購買這類系統的老闆，深層在意的不只是管理，是**怎麼提升營收**。

V3 的具體呼應：
- §10 報表：把「過去發生了什麼」視覺化 → 讓老闆看見營收結構
- §8 回購券 A/B test：主動測試行銷策略 → 提升回流率
- §3 諮詢流程 + §6 LIFF 匯款：降低客戶 friction → 提升轉換率
- V3.5 椅效比（§12.1）：未來把「過去 → 未來預測 + 策略建議」串起來

### 商業背景

- **試用期 45 天**（一個理髮週期）：客人不會主動知道有這個系統，必須由老闆推薦；推薦後通常下個月才會剪頭髮，2 週試用接觸客戶太少 — 出自 [碩展訪談 5.2](/Users/ryan/Documents/VS_code/理髮廳/docs/用戶訪談-碩展-2026-04-15.md)
- **Beta 客戶定位**：第一個試用客戶 = 合作夥伴；做 case study；累積 showcase 為 V4 多店 SaaS 鋪路
- **老闆願付**：月費 5,000-8,000 NTD（出自第一次訪談）

### 本次改版的核心輸出

1. 服務項目重構（3 類剪髮 + 燙染漂拆解）
2. **所有新預約都要老闆手機確認**（45 天窗口）
3. **諮詢流程**新架構（漂髮 / 45 天外客）
4. **行事曆 V3**（三檢視 + 縮放 + 拖拉改期）
5. CRM 門檻調整
6. 付款對帳 UX（結束前 20 分鐘提醒卡）
7. 關鍵字自動回覆
8. 回購券（A/B） A/B test
9. 品牌設計規範全面套用

---

## 本次 Session 已確認的決策（鎖定）

| 議題 | 決策 |
|---|---|
| 公休日 | 週三 + 週日，行事曆上「直接銜接顯示」（不隱藏，不特殊處理）|
| 預約窗口 | 45 天 |
| 預約確認機制 | **每一筆**新預約都要老闆手機點「已知道」才算成功（不分 3 天內外）|
| 45 天外客 | 走訊息諮詢管道（不進 Booking）|
| 平板角色 | 一天結束後 check 對帳 + 看完整時間軸 + 看明日行事曆 |
| 月檢視 | **不顯示**營收小計（行事曆與營收分離）|
| 行事曆風格 | 遵照 `品牌設計規範.md` |
| 整體佈局 | 參考圈圈 App 的檢視切換 / 週長條 / 現時線 |
| 新客/舊客視覺 | 不區分顏色 |
| 空檔時段 | 預設背景色，不特別提示 |
| 技術對標 | Google Calendar（互動、縮放、拖拉）|
| 手動加預約 | 點時段 → 跳 add sheet（Google Calendar 風格）|

---

## 範圍

### ✅ In Scope（本次 V3 上線）
1. 服務項目重構
2. 預約確認機制強化
3. 諮詢流程（NEW）
4. 行事曆 V3（核心重構，**含週檢視文字截斷規格**）
5. CRM 門檻調整
6. 付款對帳 UX（**含 LIFF 匯款入口 + ECPay ATM 自動關閉**；不含信用卡）
7. 關鍵字自動回覆（**含改/取消關鍵字**）
8. 回購券 A/B test（**兩種期限並行**：30 天 95 折 vs 45 天 95 折，固定折扣只測期限）
9. 品牌設計規範全面套用到 admin UI
10. 2025 歷史資料匯入 + 營收/營運分析報表
11. 🆕 Demo 前 must-fix bug list（Rich Menu 6 格、密碼簡化、AI 圖替換 等 5 項）
12. 🆕 V3.5 Backlog 記錄（椅效比、Upsell、服務多選、passkey、行業 benchmark — 不做但要追蹤）

### ❌ Out of Scope（延後）
- 支出 / 損益追蹤（老闆訪談中提到的 G 群 — 使用者說先暫緩）
- 設計師排班（原 V2.0 規劃）
- 評價系統（原 V3.0 規劃延後）
- **🆕 綠界信用卡整合**（CEO review 後砍掉 — Ken 客人都熟客，現金 + 轉帳已涵蓋 95%+；觸發條件達標再啟動 V3.x）

### 🆕 加進 Scope（本輪追加）
- **2025 Excel 整年資料匯入**（提前到 Phase A）— 老闆下次 Demo 要看到「6 個月後系統長什麼樣」
- **營收 / 營運分析報表**（PWA 內，§10）— 由匯入的歷史資料驅動視覺化

---

## 現況架構重點（Phase 1 探索結果）

### 現行預約生命週期

```
LIFF 預約流程：
  客戶 LIFF → POST /api/bookings → requireBookingAuth (LIFF) → Redis lock
    → DB create (adminAcknowledgedAt = NULL) → LINE push to customer
    → notifyAdminNewBooking() → admin Web Push / LINE 備援
  
Admin 確認流程：
  Admin 打開 /calendar → SWR poll /api/bookings/unacknowledged (30s)
    → UnacknowledgedModal 顯示 1 筆一筆，按「✓」→ POST /bookings/[id]/acknowledge
    → DB update adminAcknowledgedAt=NOW（idempotent）→ 下一筆

Admin 建立預約（現行）：
  Admin → POST /api/bookings（auth.type=admin）
    → adminAcknowledgedAt = NOW（自動預先 ack，不進隊列）
    ⚠️ 這個行為 V3 要改：admin 建立的也要進隊列
```

**關鍵現有檔案**：
- [src/app/api/bookings/route.ts:92-307](/Users/ryan/Documents/VS_code/理髮廳/src/app/api/bookings/route.ts) — booking 主流程（第 224 行的 `auth.type === "admin" ? new Date() : null` 是 V3 要改的點）
- [src/app/api/bookings/unacknowledged/route.ts](/Users/ryan/Documents/VS_code/理髮廳/src/app/api/bookings/unacknowledged/route.ts) — 隊列查詢
- [src/app/api/bookings/[id]/acknowledge/route.ts](/Users/ryan/Documents/VS_code/理髮廳/src/app/api/bookings/[id]/acknowledge/route.ts) — 單筆確認（idempotent 設計，V3 保留）
- [src/components/admin/unacknowledged-modal.tsx](/Users/ryan/Documents/VS_code/理髮廳/src/components/admin/unacknowledged-modal.tsx) — 強制隊列 UI
- [src/lib/notifications/admin-notify.ts](/Users/ryan/Documents/VS_code/理髮廳/src/lib/notifications/admin-notify.ts) — Web Push + LINE 備援
- [src/lib/auth/booking-auth.ts](/Users/ryan/Documents/VS_code/理髮廳/src/lib/auth/booking-auth.ts) — 雙路徑認證

### 現行行事曆架構

- [src/app/(admin)/calendar/page.tsx:1-1145](/Users/ryan/Documents/VS_code/理髮廳/src/app/(admin)/calendar/page.tsx) — 已經有 day/week/month 三檢視框架，但：
  - ❌ 無縮放（pinch / scroll）
  - ❌ 拖拉 state machine 存在但只支援建立，**不支援改期**
  - ❌ 月檢視顯示「合計 N」（件數，V3 保留，不要加營收）
  - ✅ 有現時線、已整合 unack modal、有 `?date=&ack=` deep-link
  - ✅ `new-booking-sheet` + `booking-detail-sheet` 已實作，V3 沿用

### 現行服務模型
- [prisma/schema.prisma:171-191](/Users/ryan/Documents/VS_code/理髮廳/prisma/schema.prisma) — Service 扁平表，無 `type` 區分、無 bundle 欄位
- [prisma/seed.ts:58-73](/Users/ryan/Documents/VS_code/理髮廳/prisma/seed.ts) — 目前 8 支服務，V3 要重新設計

### 現行 CRM
- [src/lib/utils/constants.ts:24-25](/Users/ryan/Documents/VS_code/理髮廳/src/lib/utils/constants.ts) — `AT_RISK_DAYS=60`, `LAPSED_DAYS=120`
- [src/lib/crm/segmentation.ts:24-68](/Users/ryan/Documents/VS_code/理髮廳/src/lib/crm/segmentation.ts) — REGULAR/VIP 以 `totalVisits` 為基準，**沒有 60 天窗口限制**（V3 要加）
- [src/app/api/cron/at-risk/route.ts](/Users/ryan/Documents/VS_code/理髮廳/src/app/api/cron/at-risk/route.ts) — 週日 20:00 UTC 跑

### 現行付款模型
- [prisma/schema.prisma:313-354](/Users/ryan/Documents/VS_code/理髮廳/prisma/schema.prisma) — `Payment` 支援 CASH / BANK_TRANSFER（末五碼）/ ECPAY_ATM（虛擬帳號）
- [src/lib/ecpay/*](/Users/ryan/Documents/VS_code/理髮廳/src/lib/ecpay/) — 綠界虛擬帳號完整，**沒有信用卡流程**，V3 要加
- [src/app/(admin)/payments/page.tsx](/Users/ryan/Documents/VS_code/理髮廳/src/app/(admin)/payments/page.tsx) — 管理後台，V3 擴充

### 現行訊息 / 關鍵字
- [src/app/api/webhook/route.ts:116-148](/Users/ryan/Documents/VS_code/理髮廳/src/app/api/webhook/route.ts) — 意圖分類 → 自動回覆
- [src/app/api/webhook/classify-intent.ts](/Users/ryan/Documents/VS_code/理髮廳/src/app/api/webhook/classify-intent.ts) — 9 個意圖，**不含**「燙/染/漂」關鍵字
- `MessageKind.KEYWORD_REPLY` 已存在，可直接利用

### 現行設計系統
- [src/app/globals.css](/Users/ryan/Documents/VS_code/理髮廳/src/app/globals.css) — CSS 變數已按品牌規範設定（OKLCH）
- [tailwind.config.ts](/Users/ryan/Documents/VS_code/理髮廳/tailwind.config.ts) — Tailwind 4 + shadcn/ui
- ✅ 品牌色已在 token，V3 主要是把 calendar UI 全面對齊

---

## Google Calendar 技術對標要點

**我們要借鏡的互動模式**：

| GC 模式 | V3 落地做法 |
|---|---|
| 時間軸縮放：Ctrl+滾輪 / 手勢捏合 | `PointerEvent` + `wheel` + 多指手勢；CSS `transform: scaleY()` + 動態 hour-label 密度 |
| 拖拉改期：拖動區塊，產生 ghost preview | 實作 `onPointerDown → move → up` state machine，拖動時顯示半透明複本 + 目標格高亮 |
| 點空白 → 快速建立 popover | 已有 `NewBookingSheet`，只要在 day/week 空白格加 click handler |
| 現時線 + 頁面載入自動滾動到當前小時 | 已有現時線，V3 補 auto-scroll-to-now |
| 月檢視：件數小泡泡 + 超過顯示 +N | 圈圈 App 那種「合計 N」即可 |
| 週長條跨日快切 | 圈圈 App 頂部週長條可照抄 |
| 虛擬化渲染（長時間軸） | 本店時段只有 11-20 共 9 小時 × 31 天 = 279 格，**不需虛擬化** |
| 拖拉時鎖定 + optimistic UI | 前端樂觀移動，API 失敗回滾；Redis lock 由 `/api/bookings/[id]/reschedule` 已實作 |
| 時區處理 | 已用 `nowTaipei()`，沿用 |

---

## 功能需求（一段一功能，含資料模型 + 檔案 + 驗證）

### 1. 服務項目重構

**目標**：
- 3 類剪髮（男生 / 女生 / 學童，皆含 洗+剪）
- 燙：1 項主服務 + 護髮 bundle flag
- 染：補染 + 全頭染 2 項，**強制 bundle 護髮**
- 漂：改為 `CONSULTATION` type，不進 LIFF 預約流程
- 附加：瀏海修 / 護髮 / 西髮（等老闆確認能否單獨預約）

**資料模型變更**：
```prisma
model Service {
  // 既有欄位不動
  type              ServiceType       @default(BOOKING)
  requiresWith      String[]          @default([]) // serviceIds that MUST be bundled
  allowStandalone   Boolean           @default(true)
}

enum ServiceType {
  BOOKING          // 一般可勾選
  CONSULTATION     // 進諮詢流程
  ADD_ON           // 附加項目（護髮、瀏海修）
}
```

**關鍵檔案**：
- [prisma/schema.prisma:171](/Users/ryan/Documents/VS_code/理髮廳/prisma/schema.prisma) — 加欄位
- [prisma/seed.ts](/Users/ryan/Documents/VS_code/理髮廳/prisma/seed.ts) — 重寫 services 區塊
- [src/app/(admin)/services/page.tsx](/Users/ryan/Documents/VS_code/理髮廳/src/app/(admin)/services/page.tsx) — admin 管理 UI 加 type / bundle 欄位
- [src/components/liff/booking/service-step.tsx](/Users/ryan/Documents/VS_code/理髮廳/src/components/liff/booking/service-step.tsx) — 加 bundle 綁定 UI + 漂髮變諮詢按鈕

**等待老闆填 [服務項目確認表.xlsx](/Users/ryan/Documents/VS_code/理髮廳/docs/服務項目確認表-給老闆-2026-04-24.xlsx) 回傳後才能 finalize seed**。

---

### 2. 預約確認機制強化（語意修正：認知通知，非 gate）

**目標**：所有新預約（45 天內）**直接進行事曆**並標記在所有檢視；同時跳通知老闆手機，**讓他「知道」有新預約**。老闆按「我知道了」= 標記已讀（**不影響行事曆狀態**）。

**重要語意（2026-04-25 用戶澄清）**：
- ack ≠ gate：預約**永遠進行事曆**，不會因為沒 ack 而隱藏
- ack = read receipt：純為提醒老闆「有新時段被約走」
- 客戶看到的：永遠是 CONFIRMED（不會看到「待確認中」）
- 老闆看到的：手機 push + Modal 提醒「有新預約 N 筆」

**程式碼改動（小）**：
- [src/app/api/bookings/route.ts:224](/Users/ryan/Documents/VS_code/理髮廳/src/app/api/bookings/route.ts)
  ```ts
  // BEFORE: auth.type === "admin" ? new Date() : null
  // AFTER:  auth.type === "admin" ? new Date() : null  ← 不變！
  // (admin 自建本來就 auto-ack 是合理的，因為他自己建的他當然知道)
  ```
  → **§2 程式碼幾乎不改**，現有 `adminAcknowledgedAt` 行為已符合「認知通知」語意
- [src/components/admin/unacknowledged-modal.tsx](/Users/ryan/Documents/VS_code/理髮廳/src/components/admin/unacknowledged-modal.tsx) — 文案調整：「請確認您已知道這筆預約」（不是「請確認此預約」）
- 行事曆檢視：**所有 CONFIRMED 預約都顯示**（不分 ack 與否）
- ack 為 null 的預約在行事曆上加微標記（例：右上小圓點），點掉就 ack
- ❌ **不加 walk-in `preAcknowledged` checkbox**（自動消除 E-4 安全漏洞）

**驗證**：
- LIFF 預約 → 立刻顯示在行事曆 + 老闆手機跳 push
- Admin 開 /calendar → 該日所有預約都看得到（包含 ack 為 null 的）
- Modal 顯示提醒「有 N 筆新預約」→ 點「我知道了」逐筆 ack
- Reschedule → 重置 ack（觸發老闆再次認知）→ 觸發 E-1 版本檢查
- 不會出現「預約存在於 DB 但客戶看不到」的狀態

**預估工**：半天（程式碼改動更少了，主要是文案 + 行事曆顯示邏輯）

---

### 3. 諮詢流程（NEW）

**目標**：
- 漂髮（經 LIFF 或 LINE 關鍵字觸發）+ 45 天外客 → **不建 Booking**
- 建 `ConsultationRequest` 表，status = PENDING
- admin 首頁出「待回覆諮詢 N」紅點
- admin 打開諮詢 → 看客人資訊、照片、訊息 → 可「回覆 LINE」或「轉預約」
- 「轉預約」點下 → 預填客戶 + 服務 → 選時段 → 建 Booking（走標準 ack 流程）

**新資料模型**：
```prisma
model ConsultationRequest {
  id                 String   @id @default(uuid())
  tenantId           String   @map("tenant_id")
  userId             String?  @map("user_id")
  lineUserId         String   @map("line_user_id")
  serviceId          String?  @map("service_id")  // 若已知服務類型

  // 客戶提交的內容
  currentPhotoUrls   String[] @default([]) @map("current_photo_urls")
  targetPhotoUrls    String[] @default([]) @map("target_photo_urls")
  lastServiceDate    DateTime? @db.Date @map("last_service_date")
  notes              String?

  status             ConsultationStatus @default(PENDING)
  priority           Int      @default(0)  // 手動 bump 到最上

  respondedAt        DateTime? @map("responded_at")
  convertedBookingId String?   @map("converted_booking_id")

  createdAt          DateTime @default(now()) @map("created_at")
  updatedAt          DateTime @updatedAt @map("updated_at")

  tenant             Tenant   @relation(fields: [tenantId], references: [id])
  user               User?    @relation(fields: [userId], references: [id])
  service            Service? @relation(fields: [serviceId], references: [id])
  convertedBooking   Booking? @relation("ConvertedFromConsultation", fields: [convertedBookingId], references: [id])

  @@index([tenantId, status, priority])
  @@index([lineUserId])
  @@map("consultation_requests")
}

enum ConsultationStatus {
  PENDING       // 等老闆回
  REPLIED       // 已回覆，未轉預約
  CONVERTED     // 已轉預約
  ARCHIVED      // 忽略 / 失效
}
```

**新路由**：
- `POST /api/consultations` — LIFF 送出諮詢 或 webhook 偵測漂髮關鍵字時建立
- `GET /api/consultations?status=PENDING` — admin 隊列
- `PATCH /api/consultations/[id]` — 標記 REPLIED / ARCHIVED
- `POST /api/consultations/[id]/convert-to-booking` — 轉預約（建 Booking + 連結回 consultation）

**新 UI**：
- `src/app/(admin)/consultations/page.tsx` — 列表（待回覆在最上面，priority desc, createdAt desc）
- `src/components/admin/consultation-detail-sheet.tsx` — 照片、訊息、「轉預約」按鈕
- `src/components/liff/consultation-form.tsx` — LIFF 諮詢表單（上傳照片）
- 首頁 / Dashboard 加紅點 `待回覆諮詢 N`

**驗證**：
- 客戶在 LIFF 送諮詢 → admin 收 Web Push + /consultations 出現紅點
- 「轉預約」流程 end-to-end：諮詢 → 選時段 → 建 Booking → ConsultationRequest.status = CONVERTED

**預估工**：1 週

---

### 4. 行事曆 V3（核心重構）

**目標**：
- 三檢視：天 / 週 / 月，右上角 `⇄` toggle（參考圈圈 App）
- **日檢視**：Google Calendar 風格全時間軸，11:00-20:00 9 小時
- **週檢視**：7 欄時間軸，每欄上方有當日件數摘要
- **月檢視**：傳統格線，每格顯示「合計 N」 + 首筆時間 pill（**不顯示營收**）
- **縮放**：pinch-zoom（手機）+ scroll-zoom（桌面），覆蓋幅度「很壓縮 → 很展開」
- **拖拉改期**：長按預約塊 + 拖 → 放到新時段 → ghost preview → 放開呼叫 `/api/bookings/[id]/reschedule`
- **點空白時段**：跳 `NewBookingSheet`（既有）
- **點預約塊**：跳 `BookingDetailSheet`（既有）
- **公休日（週三 / 週日）**：直接銜接顯示，無特殊標示（boss 決策）
- **手機主要**：大觸控區、簡潔顯示（客名 + 服務 icon）
- **平板次要**：展開顯示客名 + 完整服務 + 金額（一天結束後查看用）
- **現時線**：保留，載入時 auto-scroll 到當前小時
- **風格**：全面套用品牌設計規範（`#003D2B` 深森林綠 + `#FFF8F1` 暖乳白 + 直角微圓角 + 線性 icon）
- **🆕 週檢視文字呈現**（融入 [碩展訪談 2.2](/Users/ryan/Documents/VS_code/理髮廳/docs/用戶訪談-碩展-2026-04-15.md)）：
  - 對標 Google Calendar：「即便文字長也能看到 2-3 個字」
  - 預約塊文字截斷規則：先截客名末字（保留前 3 字 + …）→ 再截服務名（保留前 2 字）
  - 服務縮寫對照表內建：剪髮→剪、染髮→染、燙髮→燙、漂髮→漂、護髮→護、瀏海→瀏
  - 預約塊高度低於 32px 時：只顯示客名前 2 字（不顯示服務）
  - 點預約塊 → tooltip 跳出完整資訊（避免徹底看不懂）
  - **不允許**橫向滑動（碩展朋友卡在頁面內的回饋）— 一律縱向流

**技術決策**：**不用 FullCalendar / schedule-x，繼續自建**。原因：
- 現有 [calendar/page.tsx](/Users/ryan/Documents/VS_code/理髮廳/src/app/(admin)/calendar/page.tsx) 已有三檢視框架，重構成本低於換新函式庫
- FullCalendar 樣式很難對齊品牌（強烈意見，難覆寫）
- 縮放 + 拖拉互動需要細控，自建比改造函式庫快
- Bundle size 敏感（PWA 行動體驗）

**檔案改動**：

**重構**：
- [src/app/(admin)/calendar/page.tsx](/Users/ryan/Documents/VS_code/理髮廳/src/app/(admin)/calendar/page.tsx) — 瘦身，改成三個子 view 元件的容器

**新元件**：
- `src/components/admin/calendar/day-view.tsx` — 單日時間軸，支援縮放
- `src/components/admin/calendar/week-view.tsx` — 7 欄時間軸
- `src/components/admin/calendar/month-view.tsx` — 月格線
- `src/components/admin/calendar/view-toggle.tsx` — 右上角 `⇄ 日/週/月` 切換
- `src/components/admin/calendar/week-strip.tsx` — 頂部週長條（日/週檢視共用）
- `src/components/admin/calendar/booking-block.tsx` — 可拖拉的預約塊元件
- `src/components/admin/calendar/zoom-controller.tsx` — 縮放 hook（`useZoom`）+ gesture handler
- `src/components/admin/calendar/current-time-line.tsx` — 現時線（auto-scroll on mount）
- `src/components/admin/calendar/reschedule-handler.tsx` — 拖拉改期 state machine

**拆解後的主檔案架構**：
```tsx
<CalendarPage>
  <WeekStrip />           {/* 頂部週長條 */}
  <ViewToggle />          {/* ⇄ 日/週/月 */}
  <ZoomController>
    {view === "day"   && <DayView />}
    {view === "week"  && <WeekView />}
    {view === "month" && <MonthView />}
  </ZoomController>
  <NewBookingSheet />      {/* 既有 */}
  <BookingDetailSheet />   {/* 既有 */}
  <UnacknowledgedModal />  {/* 既有 */}
</CalendarPage>
```

**API 變更**：
- [PATCH /api/bookings/[id]/reschedule](/Users/ryan/Documents/VS_code/理髮廳/src/app/api/bookings/[id]/reschedule/route.ts) 加 `requireBookingAuth()`（目前缺，在 V1.3 deferred TODO 裡）

**驗證**：
- 三檢視切換：每個檢視都能看到預約塊 + 現時線
- 縮放：pinch / scroll 縮放後，時段高度 / 寬度正確，文字不擠壓失敗
- 拖拉改期：拖動一筆 → 新時段 → 釋放 → DB 真的更新 + `adminAcknowledgedAt` 重置 → 跳 unack modal
- 公休日：週三 / 週日正常顯示、不能點空白加預約（行為待驗證：應該禁 or 提示「公休日」？ → 留在問題庫 E2）
- 手機 / 平板：分別驗證字級、觸控區、展開資訊密度

**預估工**：2-3 週

---

### 5. CRM 門檻調整

**目標**：
- `AT_RISK_DAYS`: 60 → **100**
- `LAPSED_DAYS`: 120 → **180**
- REGULAR：**60 天內 ≥ 6 次** 造訪（不只看 totalVisits，要加窗口限制）
- VIP：**60 天內 ≥ 12 次** 造訪

**程式碼改動**：
- [src/lib/utils/constants.ts:24-25](/Users/ryan/Documents/VS_code/理髮廳/src/lib/utils/constants.ts) — 改兩個常數
- [src/lib/crm/segmentation.ts:24-68](/Users/ryan/Documents/VS_code/理髮廳/src/lib/crm/segmentation.ts) — 重寫 REGULAR/VIP 判斷，引入「60 天內造訪次數」概念：
  ```ts
  // 新增函式
  async function countVisitsInWindow(userId: string, days: number): Promise<number>

  // REGULAR: countVisitsInWindow(60) in [1, 12) AND lastVisitAt within atRiskDate
  // VIP:     countVisitsInWindow(60) >= 12 AND lastVisitAt within atRiskDate
  ```

**驗證**：
- 單元測試：假資料 6 人，分別符合 NEW/REGULAR/VIP/AT_RISK/LAPSED/BLACKLISTED → 執行 `recalculateSegments()` → 檢查 segment 正確
- 部署後第一次週日 cron 跑完 → spot-check 10 位客人 segment 是否合理

**預估工**：半天

---

### 6. 付款對帳 UX（**老闆主動對帳模式**，2026-04-25 用戶澄清）

**目標**：老闆**隨時主動進後台對帳**（理髮結束當下 + 晚上 8-9 點皆可），不依賴系統 push 提醒。客戶端提供轉帳自助工具。

**為什麼這樣設計**：
- 用戶 2026-04-25 澄清：「老闆會在理髮結束當下或晚上主動進後台」
- 不需要「結束前 20 分推播」這層基礎設施
- 自動消除 E-12 Vercel Hobby plan 5 分鐘 cron 的限制

---

**老闆端對帳介面**：
- 在現有 `/admin/payments` 頁顯示「**今日待對帳**」區塊
- 每筆 booking 一個卡片，**兩個按鈕**：
  - 💵 **現金 [輸入金額]** → 直接點「確認」→ `payment.method=CASH, status=RECEIVED, amount=X`
  - 🏦 **轉帳已收到** → （客戶若已回報末五碼）顯示末五碼供 cross-check → 點「確認」→ `payment.status=RECEIVED`
- 老闆什麼時候對都可以（理髮結束當下 / 晚上）
- 對完一筆從「今日待對帳」消失，移到「今日已對帳」摺疊區

**客戶端 LIFF 轉帳流程**（融入 [碩展訪談 §三](/Users/ryan/Documents/VS_code/理髮廳/docs/用戶訪談-碩展-2026-04-15.md) + 用戶 2026-04-25 詳述）：
1. Rich Menu 點「💰 轉帳」按鈕（Rich Menu 4→6 重構，見 §11）
2. 跳 LIFF `/transfer` 頁，顯示：
   - 老闆銀行 + 帳號（**一鍵複製**到剪貼簿）
   - 應付金額（若 >1 筆 PENDING 顯示選擇器，**E-14 鎖定**）
3. 客戶完成轉帳後，回到 LIFF 頁面點「**我已匯款**」
4. 系統跳出輸入欄：「請輸入帳號末五碼」
5. 客戶輸入 → POST `/api/payments/[bookingId]/report-transfer`（**既有路由**）→ 狀態 PENDING → VERIFYING
6. 老闆後台看到 VERIFYING → 在後台對帳卡點「確認已收到」→ RECEIVED → **系統自動 LINE 推播客戶**「已收到您的轉帳，謝謝」

**ECPay ATM 既有流程**：
- 保留（綠界虛擬帳號入帳是自動的，不需老闆對帳）
- 加 `liff.closeWindow()` on success（修碩展訪談 1.2 bug）
- ❌ 不新增信用卡

**資料模型變更**：
- 不動 PaymentMethod enum
- 不加任何新欄位

**新路由**：
- `POST /api/payments/[bookingId]/quick-confirm` — 老闆一鍵確認現金 / 轉帳
  - body: `{ method: "CASH" | "BANK_TRANSFER", amount: number }`
- ❌ **不新增** cron `/api/cron/payment-reminder`（用戶澄清不需要）
- ❌ 不新增信用卡相關路由

**新元件**：
- `src/components/admin/payment-settlement-card.tsx` — 老闆對帳卡（**bottom sheet**，D-3 鎖定）
- `src/components/liff/transfer-info-card.tsx` — LIFF 匯款資訊卡（一鍵複製 + 末五碼輸入）
- `src/app/(liff)/transfer/page.tsx` — LIFF 匯款入口頁（從 Rich Menu 進入）
- 改 [src/app/(admin)/payments/page.tsx](/Users/ryan/Documents/VS_code/理髮廳/src/app/(admin)/payments/page.tsx) — 加「今日待對帳 / 已對帳」分區

**Cron 新增**：
- ❌ **無**（自動消除 E-12 Vercel 限制）

**驗證**：
- LIFF 客戶轉帳完整流程：Rich Menu → 複製帳號 → 完成轉帳 → 輸入末五碼 → 後台收到 VERIFYING
- 老闆對帳：開 /admin/payments → 看到今日待對帳 N 筆 → 各別點「現金 X 元」或「轉帳已收到」→ 觀察 RECEIVED 流轉 + 客戶收 LINE 通知
- ECPay ATM 付完 → LIFF 1.5 秒後自動關閉
- 多 PENDING 場景：客戶有 2 筆 PENDING → LIFF transfer 顯示選擇器（E-14）

**預估工**：3-4 天（砍掉 cron + push 基礎建設後比原案少 3-4 天）

**未來考量**：
- 如果 V3 上線後老闆覺得「主動進後台」太被動，再加結束前推播（屆時要付費 Vercel Pro）

---

### 7. 關鍵字自動回覆（含改/取消）

**目標**：

**A. 服務諮詢觸發（既有規劃）**：
- 客人在 LINE 打「燙」/「染」/「漂」 → 自動回 Flex 卡片詢問 A/B/C（現況照片、目標、上次染燙時間）
- 漂髮：Flex 卡片同時建立 `ConsultationRequest`（status = PENDING，priority = 1 往上推）
- 燙 / 染：客人回答後 admin 自行處理（或引導到 LIFF 勾選）

**🆕 B. 改期 / 取消觸發**（融入 [碩展訪談 1.2](/Users/ryan/Documents/VS_code/理髮廳/docs/用戶訪談-碩展-2026-04-15.md)）：
- 客人傳「改」/「改期」/「改時間」/「換時間」 → 自動回 Flex「您目前的預約：[日期 時間 服務]，[改時間] [取消] [我再想想]」按鈕
- 客人傳「取消」/「不約了」 → 自動回 Flex「您目前的預約：[...]，[確認取消] [改時間試試] [我再想想]」（先引導改期、不直接放取消）
- 點「改時間」/「取消」按鈕 → 跳對應 LIFF 頁（既有的 `/reschedule/[bookingId]` 和 `/cancel/[bookingId]`）

**程式碼改動**：
- [src/app/api/webhook/classify-intent.ts](/Users/ryan/Documents/VS_code/理髮廳/src/app/api/webhook/classify-intent.ts) — 加 3 個服務關鍵字 + 4 個改取消關鍵字 + 2 個新 intent (`service-inquiry`、`reschedule-cancel`)
  - 注意：classify-intent 已有 `cancel-reschedule` intent，要核對是否重複
- [src/lib/line/messages.ts](/Users/ryan/Documents/VS_code/理髮廳/src/lib/line/messages.ts) — 加 `serviceInquiryFlexMessage(serviceType)` + `rescheduleOrCancelFlexMessage(activeBooking)` builder
- [src/app/api/webhook/route.ts](/Users/ryan/Documents/VS_code/理髮廳/src/app/api/webhook/route.ts) — 若 intent=service-inquiry 且 type=漂 → 順便建 ConsultationRequest；intent=reschedule-cancel → 查 user 最近 1 筆 CONFIRMED booking，無則回引導訊息
- 🆕 Rich Menu 重構連動（在 §11 處理）

**驗證**：
- 手動傳「漂」→ 收到 Flex 卡 + admin /consultations 出現一筆新 PENDING
- 🆕 手動傳「改」→ 收到 Flex 顯示當前預約 → 點「改時間」→ 跳到 reschedule LIFF
- 🆕 手動傳「取消」→ 收到 Flex 優先引導改期 → 點「確認取消」→ 跳 cancel LIFF

**預估工**：1-2 天

---

### 8. 回購券 A/B Test（兩種期限策略並行，折扣固定 95 折）

**策略**（融入 [碩展訪談 4.4 + 4.6](/Users/ryan/Documents/VS_code/理髮廳/docs/用戶訪談-碩展-2026-04-15.md)；CEO review 後調整為**控制變因 = 期限長度**，折扣統一 95 折）：

| 策略 | 啟動時機 | 期限 | 折扣 | 提醒 |
|---|---|---|---|---|
| **A：急切型** | Booking COMPLETED | 30 天 | **95 折**（5% off）| 期前 7 天 |
| **B：理髮週期型** | Booking COMPLETED | **45 天** | 95 折（5% off）| 期前 7 天 |

**為什麼這樣改**：
- 折扣統一 95 折 → **單一變因設計**（只比較期限），統計上清晰
- 也避免 9 折深折扣對 margin 的衝擊
- A 組 = 強提示客戶「快回來」；B 組 = 配合自然理髮週期

**A/B 分配**：
- 客戶 by `userId.hashCode % 2` 分配到 A 組或 B 組（穩定性高，同客戶始終同一組）
- ⚠️ **CEO review 警告**：以 Ken 一個月 200-400 筆預約，分一半後每組 ~100-200，**統計效力可能不足以偵測 ±15% 的回訪率差異**
- 因此這個 A/B 視為「**探索性實驗**」而非「**confirmatory experiment**」：
  - 用來看趨勢（A 是不是明顯比 B 高 / 低？）
  - 不去推「statistical significance」
  - 3 個月後若沒明顯訊號 → 收斂到表現較好的那組（或都關）
  - 若一組嚴重表現差 → 隨時可關掉那一組

**資料模型**：
```prisma
model Coupon {
  id            String       @id @default(uuid())
  tenantId      String       @map("tenant_id")
  userId        String       @map("user_id")
  code          String       @unique

  type          CouponType                    // STRATEGY_A_30D_95OFF | STRATEGY_B_45D_95OFF
  discountPct   Int          @default(5)      // 95 折 = 5% off (兩組統一)
  experimentArm String?      @map("experiment_arm")  // "A" or "B" - for A/B analytics

  issuedAt      DateTime     @default(now()) @map("issued_at")
  expiresAt     DateTime     @map("expires_at")
  usedAt        DateTime?    @map("used_at")
  usedForBookingId String?   @map("used_for_booking_id")

  issuedReason  CouponReason @default(BOOKING_COMPLETED) @map("issued_reason")

  tenant        Tenant       @relation(fields: [tenantId], references: [id])
  user          User         @relation(fields: [userId], references: [id])

  @@index([tenantId, userId, usedAt])
  @@index([expiresAt, usedAt])
  @@index([experimentArm, issuedAt])  // for A/B analytics
  @@map("coupons")
}

enum CouponType {
  STRATEGY_A_30D_95OFF
  STRATEGY_B_45D_95OFF
  MANUAL
  CAMPAIGN
}
enum CouponReason { BOOKING_COMPLETED MANUAL CAMPAIGN }

// Tenant 加欄位
model Tenant {
  featureFlags Json? @default("{}") @map("feature_flags")
  // featureFlags.couponAbTest: boolean (master switch)
  // featureFlags.couponStrategyAOnly: boolean (force all to A — emergency)
  // featureFlags.couponStrategyBOnly: boolean (force all to B — emergency)
}
```

**新路由**：
- 改 `PATCH /api/bookings/[id]` 的 COMPLETED 分支：
  ```ts
  if (newStatus === "COMPLETED" && tenant.featureFlags?.couponAbTest) {
    const arm = pickArm(userId, tenant.featureFlags);  // "A" or "B"
    const config = arm === "A"
      ? { type: "STRATEGY_A_30D_95OFF", validDays: 30, discountPct: 5 }
      : { type: "STRATEGY_B_45D_95OFF", validDays: 45, discountPct: 5 };
    await issueCoupon({ userId, ...config, experimentArm: arm });
  }
  ```

**新 cron**：
- `/api/cron/coupon-expiry-reminder` — 每日 10:00 Taipei，掃「到期前 7 天」的 coupon → 推 LINE

**新 LIFF 頁**：
- `src/app/(liff)/my-coupons/page.tsx` — 客戶看自己的券
- 預約時若有未用 coupon，提示「使用這張折抵」

**Admin UI**：
- `src/app/(admin)/settings/page.tsx` — feature flag toggle + A/B 強制覆寫
- `src/app/(admin)/analytics/coupon-ab/page.tsx` — A/B 分析報表（兩組回訪率、ARPU、券使用率）+ **明確標註「樣本量限制 → 趨勢觀察為主」**

**驗證**：
- 單元測試：PATCH COMPLETED + abTest on → Coupon row 產生 + arm 分配穩定（同 userId 始終同 arm）
- Cron 測試：A 組 30 天到期前 7 天 / B 組 45 天到期前 7 天，分別觸發提醒
- 3 個月後資料分析：A vs B 回訪率趨勢、券使用率、ARPU

**預估工**：1 週（比原方案少半週，因兩組共用大部分邏輯，折扣固定一致）

---

### 9. 品牌設計規範全面套用

**目標**：把 V3 所有新 UI（行事曆、對帳卡、諮詢頁、coupons）都做到 [品牌設計規範.md](/Users/ryan/Documents/VS_code/理髮廳/docs/品牌設計規範.md) 100% 符合。

**關鍵 checkpoint**：
- [ ] 背景 `#FFF8F1`（不用 `#FFFFFF`）
- [ ] CTA `#003D2B` + 暖乳白字
- [ ] 所有圓角 ≤ 12px
- [ ] 圖示全部線性（Phosphor Icons / Lucide）
- [ ] 大字距的 Label（SERVICES / STEP 01 風格）
- [ ] 動效 ≤ 300ms，無彈跳 / 旋轉
- [ ] 卡片靠色塊區分，不靠陰影
- [ ] 狀態色用植物色系（苔蘚綠 / 琥珀陶 / 赤陶紅）

**執行方式**：
- 先把所有新元件樣式寫出來
- 每個 PR 跑 `/design-review` skill 做 QA
- 老闆在平板 dogfood 前跑 `/autoplan` 最後一關

---

### 10. 2025 歷史資料匯入 + 營收 / 營運分析報表（Demo 用）

**動機**：老闆下次 Demo 時要看到「如果這個系統用了半年，會長什麼樣」— 沒有歷史資料的空儀表板沒說服力，但灌入 2025 一整年真實資料後，每張圖表都有故事可說。

#### 10.1 Excel 匯入

**來源**：[docs/2025預約表Ken老師.xlsx](/Users/ryan/Documents/VS_code/理髮廳/docs/2025預約表Ken老師.xlsx)

**Excel 結構（已讀取確認）**：
- 13 個工作表：202501–202512（12 個月）+ 「模板」
- 每個月份工作表：
  - Row 1：`時間` | 星期一 (3 cols: 服務/客名/金額) | 星期二 | ... | 星期日（共 7 × 3 = 21 cols）
  - Row 2：`日期` | 該月對應的日期 datetime（部分欄為「掛陳健全門診」、「休假」、「太太體檢」等備註）
  - Row 3+：每整點時段（11:00–19:00），每 3 欄是一筆預約
- **每筆預約包含**：服務名 + 客戶名 + 金額
- **服務名前綴「新」** = 這間店面的新客（如「新男剪」「新染」「新學童剪」）
- **客戶名**有時包含電話：如「李0935624046」「簡0913928338」
- **時間覆寫**：有時客戶名前面寫「16：30 許俊宏」表示實際時間

**已觀察的服務 + 價格**（用於 seed 校準）：
- 男剪：700–1100（隨季節 / 客戶不同）
- 女剪：900–1400
- 學童剪：1100
- 染 / 新染：2600
- 燙：3200
- 漂髮：（資料中較少出現）
- 洗髮：500
- 護髮、瀏海：偶爾出現

**新 / 舊客判斷**：
- 服務名 前綴「新」→ 新客（這間店面，不是 LINE 帳號）
- 同名重複出現 → 視為同一客戶，後續預約即為舊客（即便沒寫「新」）

**匯入腳本**：
- 新建 `scripts/import-2025-excel.ts`（TypeScript + Prisma client）
- 邏輯：
  1. 用 `xlsx` npm package 讀取（已在 `package.json` 中？需確認；若沒則加）
  2. 跳過「模板」工作表
  3. 對每月工作表：找出「日期」row，建立 column → date 對映
  4. 走每個時段 row × 7 天，每筆 3 欄抽取 service/customer/amount
  5. **客戶 upsert**：以「tenantId + 姓名 normalize」為 key，產生 synthetic `lineUserId = legacy-{slugify(name)}-{idx}`
  6. **客戶 firstVisitAt**：服務名有「新」字首的那次
  7. **服務 match**：用模糊匹配把 Excel 的服務名對應到 V3 重構後的 Service ID（暫存映射表 `data/service-name-map.json`）
  8. **Booking 建立**：`status = COMPLETED`、`source = WALK_IN`、`adminAcknowledgedAt = importTime`
  9. **Payment 建立**：`status = RECEIVED`、`method = CASH` 預設（後續加紅字偵測）
  10. **紅字偵測**：第二輪掃描 with `data_only=False`，讀 `cell.font.color` 是否為紅色 → `method = BANK_TRANSFER`
  11. **特殊註記**保留為 `Booking.notes`（休假、體檢等）

**處理邊界**：
- 時間欄「16：30 許俊宏」這種特例：解析出時間覆寫
- 缺金額欄但有服務 + 客名 → 用服務預設價填補（log warning）
- 同一時段同一天有 2 筆 → log error，人工檢查

**dry-run 模式**：先跑 dry-run 印出統計（總筆數、客戶數、總營收）給用戶 review，確認後才寫 DB。

**等待依賴**：
- §1 服務項目重構必須先完成（service-name-map 才有目標）
- 老闆填完 [服務項目確認表.xlsx](/Users/ryan/Documents/VS_code/理髮廳/docs/服務項目確認表-給老闆-2026-04-24.xlsx) 才能完整對映「燙是不是含護」「染是不是綁護」等規則

**保險**：tenantId 用獨立的 demo tenant（如 `demo-2025-history`）匯入，不污染 production tenant。Demo 時切換 tenant 看效果。

#### 10.2 營收 / 營運分析報表

**設計哲學**：
- **錢字第一**：每張頁面最上面是「今天賺了多少 / 本月累計 / 同期比」
- **趨勢看得到**：折線、長條、熱力圖視覺化，避免純數字
- **差異最珍貴**：永遠對照（同比 / 環比 / 平均）— 單一數字沒意義
- **能 drill-down**：點報表的某個月 → 跳到行事曆顯示那個月
- **品牌一致**：色塊 #003D2B + 暖乳白底 + 線性圖示 + Manrope/Noto 字型

**同業設計參考**（先做 desk research，PRD 不展開）：
- **Square Appointments** Dashboard：頂端 KPI cards × 4，下方折線 + 長條
- **Vagaro** Reports：可深度過濾的表格 + 客戶 cohort retention
- **Booksy** Insights：日 summary 卡片 + 新舊客比例 ring chart
- **Mindbody** Reports：詳細 retention waterfall + customer LTV
- **Fresha** Analytics：每日 / 每週 summary + 服務 mix donut
- **Phorest Salon Software**：retention dashboards + appointment trends
- 共同模式 → 我們採用 7 個 widget 模組（見下表）

**Admin App 內的報表結構**：

```
/admin/analytics 重設計（既有 page）
├── 頂部：時間範圍選擇器（今天/本週/本月/本季/本年/自訂）+ 同期 toggle
│
├── KPI Strip（4 張卡片）
│   ├── 本期營收（含同期 ±%）
│   ├── 本期客數（含同期 ±%）
│   ├── 平均客單價（ARPU）
│   └── 時段占用率（X / Y 時段）
│
├── 主視覺區（兩欄 grid，手機改直排）
│   ├── 營收趨勢線（line chart，隨時間範圍切換）
│   └── 服務組合 donut（剪 / 染 / 燙 / 漂 / 其他 占比）
│
├── 客流與留存
│   ├── 新客 vs 舊客比例（季度 stacked bar）— 老闆訪談明確要求
│   ├── 客戶分層分布（NEW/REGULAR/VIP/AT_RISK/LAPSED 圓環）
│   └── 流失趨勢（每月 LAPSED 變化線）
│
├── 時段熱力圖（hour × day-of-week，7×9 格）
│
├── Top 客戶名單（VIP top 20，含累計消費 / 最後到訪）
│
└── 對帳分布（現金 / 轉帳 比例 ring chart）
```

**用什麼套件畫圖**：
- **Recharts**（React-native，輕量、可客製、與 Tailwind 對齊）— 推薦
- 或 **Tremor** —  專為 dashboards 設計，但意見較強，須客製較多以對齊品牌
- 不用 Chart.js（畫布渲染，難套品牌色 + 字型）

**新檔案 / 改檔案**：
- 改 [src/app/(admin)/analytics/page.tsx](/Users/ryan/Documents/VS_code/理髮廳/src/app/(admin)/analytics/page.tsx) — 重寫
- 新元件：
  - `src/components/admin/analytics/kpi-card.tsx`
  - `src/components/admin/analytics/revenue-trend-chart.tsx`
  - `src/components/admin/analytics/service-mix-donut.tsx`
  - `src/components/admin/analytics/new-vs-returning-bars.tsx`
  - `src/components/admin/analytics/segment-distribution.tsx`
  - `src/components/admin/analytics/timeslot-heatmap.tsx`
  - `src/components/admin/analytics/top-customers-list.tsx`
  - `src/components/admin/analytics/payment-method-ring.tsx`
  - `src/components/admin/analytics/date-range-picker.tsx`
- 新 API：
  - `GET /api/admin/analytics/summary?from=&to=` — 一次回傳上述所有 widget 需要的聚合資料
  - `GET /api/admin/analytics/revenue-trend?range=12months|year|quarter` — 折線圖資料
  - `GET /api/admin/analytics/timeslot-heatmap?from=&to=` — 7×9 矩陣
  - `GET /api/admin/analytics/top-customers?limit=20` — VIP 排行
- 新 SQL aggregation utilities：`src/lib/analytics/`
  - `aggregate-revenue.ts`
  - `aggregate-segment.ts`
  - `aggregate-timeslot.ts`
  - `aggregate-customer-ltv.ts`

**KPI 計算定義**：
| KPI | 公式 |
|---|---|
| 本期營收 | `SUM(payment.amount) WHERE status=RECEIVED AND booking.date IN [from, to]` |
| 同期營收 | 同上，但 [from, to] 平移一個 period（前月、前季、前年）|
| 客數 | `COUNT(DISTINCT booking.userId)` 同範圍 |
| ARPU | 營收 / 客數 |
| 時段占用率 | `COUNT(booking.slotsOccupied) / (open_days × 9)` 同範圍 |
| 新客比 | `COUNT(WHERE user.firstVisitAt IN [from,to]) / 客數` |
| 流失率 | `COUNT(WHERE segment 從 ACTIVE → LAPSED) / total_users` 同範圍 |

**對 Demo 的具體呈現策略**：
匯入 2025 整年資料後，給老闆看到的數字大致長這樣（基於 Excel 估算）：
- 12 個月趨勢線：可以看到淡旺季
- 服務組合：剪髮 ~70% / 染 ~15% / 燙 ~10% / 其他 ~5%
- 新客 vs 舊客：每季新客比例變化
- 時段熱力圖：14-18 點明顯紅熱，11-12 點偏冷
- VIP top 20：阿邦、有為、Bryant、宋小姐 這類常客排名
- 對帳：現金 vs 轉帳比例

老闆看到這些 → 「啊原來這樣」 → 系統價值具體化。

**驗證**：
- Excel 匯入 dry-run：印出總筆數、總營收、客戶數、月分布
- DB 灌入後對 SQL：`SELECT MONTH(date), SUM(amount) FROM bookings JOIN payments ...` 比對 Excel 手算數字
- 報表頁渲染：每個 widget 在 demo tenant 都有資料、空狀態正確處理
- 手機 + 平板 responsive：圖表縮放、文字不擠

**預估工**：
- Excel 匯入腳本：2-3 天
- 報表 UI 8 個 widget：1 週
- API 聚合：3-4 天
- 同業 desk research + design 對齊：1 天
- Demo tenant 切換 + 資料清理：半天
- **總共：約 2 週**

---

### 11. Demo 前 must-fix bug list（融入碩展訪談）

**動機**：碩展訪談 + 朋友實測抓出多個體驗問題，第三次 Demo 前必須清乾淨，否則老闆和朋友會 anchor 在同樣 bug 上反覆抱怨。

| 優先 | 問題 | 來源 | 修法 | 預估工 |
|---|---|---|---|---|
| **🔴 高** | **Rich Menu 4→6 格重構**：加「💰 匯款」「↻ 改/取消」 | 碩展 1.2 | 重新出 Rich Menu 圖檔；改 [docs/rich-menu/](/Users/ryan/Documents/VS_code/理髮廳/docs/rich-menu/) + 部署腳本 [docs/rich-menu-setup.md](/Users/ryan/Documents/VS_code/理髮廳/docs/rich-menu-setup.md) | 1 天 |
| **🔴 高** | **手動新增預約「送出」按鈕被遮** | 碩展 2.3 | 改 [src/components/admin/new-booking-sheet.tsx](/Users/ryan/Documents/VS_code/理髮廳/src/components/admin/new-booking-sheet.tsx) — sheet 加 `pb-safe` + sticky footer | 半天 |
| **🟡 中** | **後台密碼太長難輸入** | 碩展 2.1 | (a) 加 PWA「保持登入」延長 cookie 至 30 天 (b) 加 passkey/生物辨識 (V3.5)；先做 (a) | 半天 |
| **🟡 中** | **「我的服務」圖片太 AI 感** | 碩展 1.1 | 換素材：拍真實作品 / 用 unsplash 真人照；改 [prisma/seed.ts](/Users/ryan/Documents/VS_code/理髮廳/prisma/seed.ts) `imageUrl` 欄位 | 1 天（找圖 + 替換） |
| **🟢 低** | **「我的預約」按鈕 3 秒延遲** | 碩展 1.2 | profile + 加 SWR prefetch on Rich Menu hover；改 [src/app/(liff)/my-bookings/page.tsx](/Users/ryan/Documents/VS_code/理髮廳/src/app/(liff)/my-bookings/page.tsx) | 半天 |

**驗證**：
- 朋友實機回測（同一台手機跑一次 LIFF + 後台）— 確認上述 5 點都通
- 拿給老闆 dogfood 1 天 → 不能再卡這幾關

**預估工**：3 天（與 §4 / §6 平行）

---

### 12. V3.5 Backlog（明確延後，但記錄起來）

這幾項都是有價值但不進 V3 的功能，避免 scope 爆炸。記錄起來，V3 ship 後 dogfood 1-2 個月再啟動。

| # | 項目 | 來源 | 為何延後 |
|---|---|---|---|
| **12.1** | **椅效比 + 高毛利策略指引** widget — 推算未來週/月預估營收 + 引導提升高毛利占比 | 碩展 4.5 | 需要先有 V3 的「過去」報表（§10）才有 baseline 預測，且老闆可能還沒準備好接受「策略建議」這層抽象 |
| **12.2** | **Upsell 系統** — 客人 LIFF 預約剪髮時主動推薦護髮、染髮升級 | 碩展 4.6 | 需要先驗證 LIFF 預約完成率，避免 upsell 卡關降低主流程轉換 |
| **12.3** | **服務多選**（剪+護、剪+洗）| 碩展 1.2 | 朋友自己說大部分用不到；§1 的 bundle 規則已處理染必綁護 |
| **12.4** | **passkey / 生物辨識登入** | 碩展 2.1 | 先用「保持登入 30 天」cookie 滿足；passkey 整合需要 WebAuthn 實作 |
| **12.5** | **行業 benchmark 顧問模組** — 跨店匿名比較、行業均值 | 碩展 4.5 | 需要多店資料；屬 V4 多店 SaaS 的延伸 |

**啟動條件**：
- V3 上線 + dogfood 1 個月
- 老闆主動提出某項需求（pull > push）
- A/B test (§8) 結果出來，知道哪種行銷策略有效

---

## 依賴與排序（建議開發順序）

### Phase A：可並行 / 無阻礙（Week 1-2）
1. **CRM 門檻調整**（§5）— 半天
2. **關鍵字自動回覆（燙 / 染 + 改 / 取消）**（§7 部分）— 1.5 天
3. **預約確認機制 `adminAcknowledgedAt` 統一化**（§2）— 半天
4. **服務項目 seed.ts 重寫**（§1）— 等老闆填完 Excel；先以 V3 草案結構打底
5. **🆕 Demo 前 must-fix bug list 全部修完**（§11）— 3 天，與其他項並行
   - Rich Menu 4→6 格重構（§11 #1）— 1 天
   - 後台手動新增預約送出鈕修復（§11 #2）— 半天
   - 後台「保持登入 30 天」cookie（§11 #3a）— 半天
   - AI 感圖片替換（§11 #4）— 1 天
   - 「我的預約」按鈕效能優化（§11 #5）— 半天
6. 預備工作：行事曆子元件拆分架構（§4 準備）

### Phase B：資料模型 + 後端 + 歷史匯入（Week 2-3）
6. **諮詢流程 schema + API**（§3 骨架）
7. **回購券（A/B） schema + feature flag**（§8 骨架）
8. **付款 LIFF 匯款入口 + 結帳卡 + 自動關閉**（§6 後端，砍信用卡）
9. **🆕 2025 Excel 匯入腳本 + dry-run + 灌入 demo tenant**（§10.1）

### Phase C：行事曆 V3 核心 + 報表（Week 3-5）
10. **日檢視 + 縮放**（§4 最大塊）
11. **週檢視**（§4）
12. **月檢視**（§4）
13. **拖拉改期**（§4）
14. **🆕 營收 / 營運分析報表 8 個 widget**（§10.2）— 與行事曆並行

### Phase D：UI + 整合（Week 5-6）
15. **諮詢 admin UI + 首頁紅點**（§3 UI）
16. **漂髮關鍵字 → 自動建 consultation**（§7 漂髮分支）
17. **付款對帳卡 + 結束前 20 分推播**（§6 UI）
18. **回購券（A/B） LIFF + admin UI**（§8 UI）
19. **品牌設計規範全面套用 + /design-review**（§9）

### Phase E：測試 + Demo 準備 + dogfood（Week 6）
20. **全面 QA**（/qa, /design-review, /codex）
21. **Demo tenant 灌好 2025 全年資料，準備第三次訪談 Demo**
22. **老闆平板 dogfood 一週**

---

## 驗證總表（Verification）

### 自動化
- `npm run lint` — 所有新檔案通過
- `npm run test` — 新增單元測試覆蓋：confirmation 統一化、CRM 門檻、consultation flow、coupon 發放、Excel 匯入 parser、analytics SQL aggregation
- `npm run build` — 0 警告
- TypeScript `npx tsc --noEmit` — 0 錯誤

### 手動 / 整合
- 每個功能獨立 integration 測試（見各 §X 最後的驗證區塊）
- 三支主要 flow end-to-end：
  1. LIFF 客戶預約 → admin 收 push → ack → 行事曆顯示 → 結束前 20 分 → admin 收對帳 push → 確認付款 → COMPLETED → 回購券（A/B）發放
  2. LIFF 客戶諮詢（漂髮）→ admin 收 push → 回覆 → 轉預約 → 客戶收通知
  3. admin 在 /calendar 拖拉預約 → reschedule API → 客戶收通知 → ack 重置 → modal 再彈
- **Excel 匯入 + 報表 demo**：跑 `scripts/import-2025-excel.ts --tenant=demo-2025-history --dry-run` → review → 灌入 → 開 /admin/analytics 切到 demo tenant → 看 12 個月趨勢線 + 服務 mix + 熱力圖都有資料

### G-stack 審核
按順序跑：
1. `/plan-ceo-review` — 挑戰 scope（要不要砍 §8 回購券（A/B）？）
2. `/plan-design-review` — 行事曆 + 對帳卡 + 諮詢頁視覺評分
3. `/plan-eng-review` — 拖拉改期的 race condition、cron 時機、schema migration 安全性
4. `/autoplan` — 最後一道閘

### 老闆驗收
- 老闆平板實地 dogfood 1 週
- 每日老闆回饋 → 立刻修 → `/canary` 監控錯誤

---

## 開放問題（等第三次訪談前問老闆）

見 [docs/interview-questions/pending-after-interview-2.md](/Users/ryan/Documents/VS_code/理髮廳/docs/interview-questions/pending-after-interview-2.md)，主要未決：

- **服務項目**：A1-A8（等 Excel 回傳）
- **公休日顯示**：E2（灰階 vs 不顯示）
- **預約塊資訊密度**：E6（手機簡潔 vs 平板詳細）
- **月檢視計數 vs 營收**：E10（老闆說不要營收，但計數的顯示方式仍待 confirm）
- ~~**付款方式開放範圍**：C1（信用卡先開還先關）~~ → V3 已決定不做信用卡
- **諮詢回覆 UX**：D1 / D2

這些問題不阻礙 V3 動工，但會在 Phase D（UI 整合）前需要答案。

---

## 成功指標（老闆視角，1 個月後檢驗）

- [ ] 預約確認耗時：從 1-2 小時 → **< 5 分鐘**（訊息堆積不再）
- [ ] 諮詢回覆速度：漂髮客戶首次回覆 → 從「隔天」→ **同日完成**
- [ ] 對帳正確率：每日晚上對帳 Excel ↔ 系統，**差異 0 筆**
- [ ] 老闆滿意度：問老闆 1-10 分，**≥ 8**
- [ ] 客戶滿意度（隨機訪問 5 位）：**≥ 4/5**

若 回購券（A/B）功能開啟：
- [ ] 測試 1 個月後，實驗組 30 天回訪率 **+15% 以上**（否則考慮關掉）

---

## 成本 / 風險

### 成本
- 工時：**4.5-5.5 週**（1 人全職；信用卡砍掉 -0.5w，A/B 簡化 -0.5w）
- 基礎設施：無新服務（綠界 ATM 既有，信用卡延後）
- 新資料表 2 張：`ConsultationRequest`、`Coupon`（+ Tenant.featureFlags 欄位）

### 風險
- **Migration 風險**：`adminAcknowledgedAt` 欄位邏輯變更 → 既有 admin-created bookings 還是 ack 過的狀態，OK；但部署當下正在建立的預約可能處於中間狀態 → **部署時選在休息時段（週三 / 週日）**
- **行事曆縮放 + 拖拉**：觸控 gesture 在 iOS Safari 行為不一致 → 需實機測 iPhone + iPad
- **綠界信用卡 webhook 不穩**：參考現有 ATM 流程的 retry 機制
- **feature flag 洩漏**：tenant.featureFlags 須 sanitize 回傳（不要洩漏其他 flag 給客戶端）— 沿用 V1.3 安全加固的 `select` white-list 模式
- **Excel 匯入資料品質**：
  - 客名重複 / 同人多名（例：「Lisa wang 」尾端空白、「板橋小胖」vs「小胖」）→ 用 normalize（trim + 同義表）
  - 服務名前綴「新」判斷可能因老闆筆誤遺漏而誤判 → 第二輪用「該客戶首次出現」邏輯交叉驗證
  - 缺金額欄但有服務 + 客名 → 用服務預設價填補（log warning）
  - 紅字偵測 (`cell.font.color`)：合併儲存格、非全紅字（部分紅）要寫測試
  - **保險**：用 `demo-2025-history` 獨立 tenant，不污染 production
- **報表計算正確性**：聚合 SQL 寫錯會誤導老闆判斷 → 每個 KPI 要有單元測試 + 拿 Excel 手算數字對比

---

## 文件產出物

這個 PRD 交付後產生的 artifacts：

1. `docs/PRD-v3.md` — 這份 PRD 正式版（從 plan file copy 過去）
2. 更新 [CLAUDE.md](/Users/ryan/Documents/VS_code/理髮廳/CLAUDE.md) V3 新 libraries / routes 區
3. 新增 `docs/calendar-v3-interaction-spec.md` — 縮放 / 拖拉 / 手勢規格詳案（技術 PM 文件）
4. 新增 `docs/consultation-flow-spec.md` — 諮詢流程狀態機 + UI 規格
5. 新增 `docs/analytics-report-design.md` — 報表 widget 規格 + 同業 desk research 整理
6. 新增 `docs/excel-import-runbook.md` — 2025 匯入腳本 SOP + 客名 normalize 規則 + 服務對映表
7. Seed 重寫後把舊 seed 備份到 `prisma/seed.v1.bak.ts`

---

## /autoplan Phase 1 — CEO Review 結果

**執行時間**：2026-04-25
**雙聲音**：Codex (codex-cli 0.118.0) + Claude subagent (general-purpose)
**獨立性**：subagent 未看 codex 結果，反之亦然

### CODEX SAYS (CEO — strategy challenge)

12 項 findings（3× P0、8× P1、1× P2）。完整輸出見 conversation log。**核心 reframe**：

> The right problem is not "how do we look like a revenue partner." It is "how do we protect Ken's attention and prevent sellable chair hours from leaking out." If you solve that, revenue follows. If you don't, the dashboard just narrates the leakage.

**Codex 建議 V3 砍到 4 件事**：
1. Exception-based booking confirmation (智能 ack，不是全部 ack)
2. One-tap reschedule/cancel
3. Deposit/prepay for risky bookings (取代信用卡完整流程)
4. Minimal operator dashboard tied to utilization + retention

### CLAUDE SUBAGENT (CEO — strategic independence)

8 項 findings（2× CRITICAL、4× HIGH、2× MEDIUM）。**核心 reframe**：

> 你正在打造 Toyota Camry 但 Ken 需要的是電動滑板車。實際 job-to-be-done 是「停止每天花 1-2 小時在 LINE」。這由 §2（智能 ack）+ §7（關鍵字回覆）+ §6 LIFF 轉帳入口解決 — 大概 2 週工作。先 ship 那個，跟 Ken 收 NT$3000/mo，拿到簽約，再用他的錢 + 使用數據決定 §4/§8/§10 哪個值得做。現在的 PRD 是反過來：投機性建造一切、寄望 Ken 看到 demo 就簽。這跟 YC「在建造前先收費」的原則完全相反。

**Subagent 建議 V3 砍到**：
- 砍 §8（A/B coupon）
- 砍 §10.2 到 1 個 KPI + 1 chart
- 砍 §10.1 到 dry-run only
- 砍 §4 縮放 + 拖拉
- 砍 §6 信用卡
- 保留：§1, §2 (with smart-ack), §3, §5, §7, §9, §11
- 新增 §0：跟 Ken 簽 NT$10K setup + NT$3K/mo 才開始 Phase B

### CEO DUAL VOICES — CONSENSUS TABLE

| # | Dimension | Claude Subagent | Codex | Consensus |
|---|---|---|---|---|
| 1 | 「營收成長夥伴」定位是否站得住腳？| ❌ 友人意見、未市場驗證 | ❌ 是 positioning inflation | **DISAGREE WITH PLAN** |
| 2 | 5-6 週時程是否實際？| ❌ 應為 2.5 週（砍掉 60%）| ❌ Fiction，多個產品塞一起 | **DISAGREE WITH PLAN** |
| 3 | 強制 ack 每筆預約方向是否正確？| ⚠️ 應做 smart-ack（VIP 自動）| ❌ 跟 automation goal 矛盾 | **DISAGREE WITH PLAN** |
| 4 | 行事曆自建（縮放 + 拖拉）是否值得？| ❌ Over-engineering，先 spike schedule-x | ❌ Founder vanity | **DISAGREE WITH PLAN** |
| 5 | A/B 回購券（A/B）測試是否有統計效力？| ❌ 數據量太小、需 1500/arm | ❌ 「margin leakage dressed up as science」| **DISAGREE WITH PLAN** |
| 6 | §10 Excel 匯入 + 8 widget 報表是否值得？| ❌ Demo theater、Ken 不會用 | ❌ Synthetic data 不是 decision-grade | **DISAGREE WITH PLAN** |
| 7 | 是否該有商業 gate（簽約才 ship）？| ✅ 必要：簽 LOI + 收 setup fee | ⚠️ 沒明說但暗示要先驗證 | **CONFIRMED** (新增建議) |
| 8 | 訪談決策「鎖定」是否成立？| ⚠️ 應該根據資料調整 | ❌ Governance failure | **DISAGREE WITH PLAN** |

**6 / 8 維度兩個模型獨立達成「PRD 方向需要重大調整」共識。1 維度新增「商業 gate」共同建議。1 維度（governance）兩者都警告。**

### Cross-Phase Critical Theme

- **「砍 V3 至少 60% scope」獨立收斂**：兩個模型沒看彼此卻提出近乎相同的砍項清單（§4 縮放/拖拉、§8 A/B、§10 完整版）
- **「V3 應該先 ship 解決核心痛點 → 收費 → 再擴」獨立收斂**：兩個模型都提出「先 ship 2-3 週的 MVP → 簽約 → 再決定其他要不要做」

### Phase 1 User Challenge — 解決紀錄

**用戶（Ryan）2026-04-25 拍板**：

| 審核建議 | 用戶決定 | PRD 變動 |
|---|---|---|
| 砍 §6 信用卡 | ✅ 採納 | §6 移除 ECPay 信用卡；In Scope 註記；out-of-scope 加項；估工 -0.5w |
| §8 A/B 折扣統一 95 折（單變因）| ✅ 採納 | §8 A 從「30天 9 折」改「30天 95 折」；schema enum 改名 |
| 砍 §4 縮放/拖拉 | ❌ 不採納 | 保留 |
| 砍 §10 報表完整版 | ❌ 不採納 | 保留 |
| 砍 §2 強制 ack 改 smart-ack | ❌ 不採納 | 保留全部 ack |
| 5-6 週時程縮減 | ❌ 不採納 | 砍信用卡 + A/B 簡化後新估 4.5-5.5w |
| 商業 gate（簽約才動工）| ❌ 不採納 | 不加 |

### Phase 1 完成狀態

- ✅ Codex CEO 跑完
- ✅ Claude subagent CEO 跑完
- ✅ 共識表產出
- ✅ User Challenge 已解決
- ✅ PRD scope 已調整
- → 進 Phase 2 (Design Review)

---

## /autoplan Phase 2 — Design Review 結果

**執行時間**：2026-04-25
**雙聲音**：Codex (codex-cli 0.118.0) + Claude subagent (general-purpose)

### CODEX SAYS (design — UX challenge)

「**Implementation-heavy, UX-light**」— 6 大 findings：

1. IA 服務實作者非使用者（§3 schema 在前 / §4 component 在前 / §10.2 widget 為 demo spectacle）
2. Interaction states (loading/empty/error/partial) **大多 hand-waved**
3. Responsive 策略只在 §4 算 intentional，但仍未完成
4. **Accessibility barely specified**（無 keyboard、無 focus、無 touch target、無 contrast）
5. UI 規格混雜：好的（週檢視截斷規則 + LIFF 匯款）vs 壞的（"Google Calendar style" / "圈圈 App" 是 reference 不是 spec）
6. 致命模糊：默認 view、view toggle icon、closed-day 行為、modal vs sheet for settlement、consultation reply UX

### CLAUDE SUBAGENT (design — independent review)

11 項 findings（3× CRITICAL、4× HIGH、4× MEDIUM）。Top 3 ambiguities：
1. **Calendar zoom + drag**：無 min/max px、無 collision UI、無 failure animation → senior eng 會猜 3 天還做錯
2. **Settlement card form factor**：「modal 或 bottom sheet」不是 footnote，決定整個互動模型
3. **Analytics empty/loading/error states**：8 widgets × 4 states = 32 個未規範 UI，demo tenant 看起來漂亮但 Ken 第一天進新 tenant 會壞掉

具體修復建議（精煉）：
- Calendar zoom: 32-96px row, 4 stops, 預設 56px
- Drag: snap-to-15min, ghost 60% 不透明森林綠 outline, collision 用赤陶紅 border + haptic, drop on 公休拒絕 + toast
- Settlement → bottom sheet (品牌 §4.5 對齊), peek mode 60px banner
- Empty/loading 用 Soft Sand 骨架，禁 spinner（品牌規範）
- §10.2 砍 8 widget → **4 widget + drill-down**（KPI / 趨勢 / 服務 mix / segment donut）
- Consultation upload: 最多 5 張、client-side 壓 1080px、預期回覆視窗 copy「通常 4 小時內回覆」、REPLIED push
- Touch target ≥ 44×44pt
- Rich Menu 6-grid: 3 cols × 2 rows，row1 = 預約/我的預約/諮詢，row2 = 匯款/改取消/服務介紹

### DESIGN DUAL VOICES — CONSENSUS TABLE

| # | Dimension | Subagent | Codex | Consensus |
|---|---|---|---|---|
| 1 | Interaction states 是否規範完整？| ❌ 缺 4 種 × 多元件 | ❌ Hand-waved | **CONFIRMED 缺失** |
| 2 | Calendar zoom/drag 是否有具體數值？| ❌ 全沒有 | ❌ 全沒有 | **CONFIRMED 缺失** |
| 3 | Settlement modal vs bottom sheet 拍板？| ❌ 未拍 → 應 bottom sheet | ❌ "重大不該模糊的選擇" | **CONFIRMED 缺失** |
| 4 | IA 是否服務 user？| ⚠️ §3 schema 在前 | ❌ §10.2 demo 為主 | **CONFIRMED 須改善** |
| 5 | Accessibility 是否規範？| ❌ 全缺 | ❌ 全缺 | **CONFIRMED 缺失** |
| 6 | Closed day 行為是否拍板？| ❌ 未拍 | ❌ 仍 open | **CONFIRMED 缺失** |
| 7 | §10.2 widget 數是否合適？| ❌ 應砍至 4 | ❌ Demo spectacle | **CONFIRMED 須減量** |

**7 / 7 維度兩個模型獨立達成「設計缺漏，需補規格」共識。沒有彼此衝突的點。**

### Phase 2 自動決策（無 user challenge，全部 P1+P5 補規格）

依 6 原則自動決策，**只新增規格不改 scope**：

| # | 補進 PRD | 原則 | 鎖定值 |
|---|---|---|---|
| D-1 | Calendar zoom 範圍 | P5 explicit | min 32px / max 96px row 高 / 4 stops / 預設 56px |
| D-2 | Drag interaction | P1 completeness | snap-to-15min / ghost 60% 森林綠 outline / collision 赤陶紅 + haptic / drop on 公休拒絕 + toast / undo toast 5s |
| D-3 | Settlement form factor | P5 explicit | **bottom sheet**（對齊品牌 §4.5）+ peek mode 60px banner（Ken 在其他畫面時）|
| D-4 | Default calendar view | P3 pragmatic | **日檢視**（最常用）/ 持久化於 localStorage `admin.calendar.lastView` |
| D-5 | Closed day（週三 / 週日）行為 | P5 explicit | 灰階背景顯示、空白格不可點、拖入時 reject + toast「公休日」 |
| D-6 | View toggle icon | P3 pragmatic | 文字 `日 / 週 / 月` 三選擇 segment（不用 icon，icon 不夠清晰）|
| D-7 | §10.2 8 widget → 4 widget + drill-down | P1+P5 | 主視圖：KPI strip + 營收趨勢 + 服務 mix donut + 客戶分層 ring。其他（熱力圖 / Top 客戶 / 對帳分布）→ `/admin/analytics/<sub>` 子頁 |
| D-8 | Empty / Loading / Error states 全規格 | P1 | 新附錄「§A1 全 UI 狀態規格」（loading=Soft Sand 骨架、empty=插圖+CTA、error=赤陶紅 banner+重試）|
| D-9 | Touch targets | P1 | min 44×44pt 強制；calendar block < 32px → 只允 tap 不允 drag |
| D-10 | Consultation upload UX | P1 | 最多 5 張、client-side 壓 1080px、預期回覆 copy「通常 4 小時內回覆」、REPLIED 自動 LINE push |
| D-11 | Rich Menu 6-grid layout | P5 explicit | 3 cols × 2 rows: 預約/我的預約/諮詢 + 匯款/改取消/服務介紹 |
| D-12 | Accessibility baseline | P1 | sheet/modal focus trap + ESC 關閉 + 開啟前 focus 返回 / contrast WCAG AA / 鍵盤可達所有按鈕 |

**這 12 項加進 §4 / §6 / §3 / §10.2 / §11 對應位置 + 新增「§A1 UI 狀態規格附錄」。Phase 3 Eng review 時這些將被視為固定規格（不再質疑）。**

### Phase 2 完成狀態

- ✅ Codex Design 跑完
- ✅ Claude subagent Design 跑完
- ✅ 共識表產出
- ✅ 12 項自動決策補進 PRD（待 Phase 3 後一併執行）
- → 進 Phase 3 (Eng Review)

---

## /autoplan Phase 3 — Eng Review 結果

**執行時間**：2026-04-25
**雙聲音**：Codex (codex-cli 0.118.0) + Claude subagent (general-purpose)

### CODEX SAYS (eng — architecture challenge)

8 項 findings（2× CRITICAL、6× HIGH、1× MEDIUM）。重點：
1. **CRITICAL**：§2 ack stale data race（reschedule 重置 ack，但 ack API 沒檢查版本，跨裝置可能 ack 到「沒看過的新版」）
2. **CRITICAL**：§4 drag-reschedule last-write-wins race（route 只鎖目標 slot，不鎖 booking row，兩個 admin 同時拖會兩邊都成功）
3. **HIGH**：§3 convert-to-booking 缺 transaction boundary（兩 admin 同時轉 = 雙建）
4. **HIGH**：§4 month view 在 1k+ booking 沒 windowing
5. **HIGH**：§5 CRM N+1（per-user 60-day window 在 1500 客戶 × 週 cron 會炸）
6. **HIGH**：§6 settlement cron 沒 server-side idempotency（跟既有 past-due-modal 重複觸發）
7. **HIGH**：§8 `userId.hashCode % 2` 不是 JS primitive；deploy 換 hash arm 會翻轉
8. **HIGH**：§10 Excel import — `xlsx` 不在 package.json；fuzzy 客名 + 服務匹配 = demo data corruption
9. **MEDIUM**：§11 Rich Menu deploy 沒 atomic switch + 沒 429 retry

### CLAUDE SUBAGENT (eng — independent review)

12 項 findings（2× CRITICAL、5× HIGH、5× MEDIUM）+ Top 3 architectural risks + recommended pre-implementation work + riskiest deploy. Highlights：

1. **CRITICAL**：§2 ack reset race + reschedule 與 violation 不在同 transaction（部分失敗 → 違規漏記）
2. **CRITICAL — 新發現**：§2 walk-in body-supplied `preAcknowledged` 是 **auth-bypass 漏洞**，跟 V1.3 修的 `lineUserId` impersonation 同類！必須 server-side 強制 strip + pin to (admin auth AND source=WALK_IN)
3. **HIGH**：§4 drag-reschedule 6+ side effects 沒 rollback contract；undo toast 必須 call `/reschedule-undo` 真 endpoint，不是只 revert client state
4. **HIGH**：§3 ConsultationRequest 沒 rate limit / 沒 photo storage 決策（提案 Supabase Storage RLS）/ 沒 EXIF strip
5. **HIGH**：§5 CRM 60-day window 用單一 CTE 替代 N+1；demote VIP 行為要明確（要不要 push？）
6. **HIGH — 新發現**：§6 cron `*/5 * * * *` **超出 Vercel Hobby plan 限制**（你之前 ecpay-sweeper 已遇過）。要嘛升 Pro，要嘛改寫進既有 `notifications` 表 + 既有 hourly cron（resolution 變 60 min）
7. **HIGH**：§8 `experimentArm` 應該 persist 到 `User` row（不是 hash 算）
8. **MEDIUM**：§10.1 import 沒 idempotency（重跑會雙倍）；**xlsx 套件不能讀儲存格 font color**（要改 `exceljs` 或呼叫 Python `openpyxl`）
9. **MEDIUM**：§11 Rich Menu LINE API 順序：upload → verify → setDefault → 留 24h → delete old
10. **MEDIUM**：Schema migration 順序風險（不要用 `db:push`，要分 additive vs destructive 兩 deploy）
11. **MEDIUM**：§6 LIFF「最近 1 筆 PENDING」歧義（>1 PENDING 時要讓客人選）
12. **MEDIUM**：Web Push 不可靠（iOS PWA 背景 30 min 後失效）→ §6 settlement 不能只靠 push，需 admin 開頁時 banner fallback

### ENG DUAL VOICES — CONSENSUS TABLE

| # | Dimension | Subagent | Codex | Consensus |
|---|---|---|---|---|
| 1 | §2 ack 與 reschedule 競態安全？| ❌ Race + 不同 transaction | ❌ Stale ack | **CONFIRMED CRITICAL** |
| 2 | §4 drag-reschedule 競態安全？| ❌ 6 side effects 沒 rollback | ❌ Last-write-wins race | **CONFIRMED CRITICAL** |
| 3 | §3 convert-to-booking transaction boundary？| ❌ 缺 | ❌ 缺 + photo security | **CONFIRMED HIGH** |
| 4 | §5 CRM 60-day window 性能？| ❌ N+1 | ❌ N+1 | **CONFIRMED HIGH** |
| 5 | §6 settlement cron idempotent？| ❌ + Hobby plan 限制 | ❌ 重複觸發 | **CONFIRMED HIGH** |
| 6 | §8 A/B arm 穩定？| ❌ Persist to User | ❌ Persist to User | **CONFIRMED HIGH** |
| 7 | §10 Excel import 安全？| ❌ + xlsx 不能讀色 | ❌ Demo data corruption | **CONFIRMED HIGH** |
| 8 | Schema migration 安全？| ❌ 不要 db:push | (未明說) | **subagent CONFIRMED HIGH** |
| 9 | §2 walk-in preAcknowledged 安全？| ❌ Auth-bypass 漏洞 | (未抓到) | **subagent CRITICAL — 安全回歸** |

**8 / 9 維度兩個模型獨立收斂在「重大架構漏洞」共識上。Subagent 額外抓到 1 個 CRITICAL 安全漏洞（V1.3 修過類似的，這次又新增）。**

### Phase 3 自動決策（無 user challenge，全部 P1+P5 補架構規格）

| # | 補進 PRD（執行前必做的架構修正） | 原則 | 鎖定值 |
|---|---|---|---|
| E-1 | §2 ack API 加版本檢查（updatedAt token）| P1 完整 | `POST /acknowledge` body 加 `expectedUpdatedAt`，DB `WHERE id=? AND updatedAt=?`，mismatch → 409 + 重 fetch |
| E-2 | §2 reschedule 只在 date/time 變才清 ack | P1 | 加 `ackResetReason: enum`（"rescheduled" / "manual"），modal 顯示「已改期，請重新確認」|
| E-3 | §2 reschedule + violation 同 transaction | P1 | `prisma.$transaction([reschedule, violationIncrement])` |
| E-4 | §2 walk-in preAcknowledged 防 auth bypass（**安全回歸**）| P1 完整 | Zod refinement strip on non-admin auth；server-side 加 `&& source==='WALK_IN'`；加 integration test 覆蓋 |
| E-5 | §4 drag-reschedule 加 idempotency key + 真 undo endpoint | P1 | POST 帶 `idempotencyKey: ${bookingId}-${targetSlot}`；`/reschedule-undo` API 30s 內可呼叫，restore 前一個 slot + 通知客戶「老闆改期取消」 |
| E-6 | §4 booking-level mutex（防止跨 drag race）| P1 | reschedule API 加 `acquireLock("booking:reschedule:{id}")` 之外的 booking lock；或用 Postgres `SELECT FOR UPDATE` |
| E-7 | §3 photo storage = **Supabase Storage with RLS** | P5 explicit | `currentPhotoUrls` 存 storage key，回傳時轉 signed URL（1h 有效）；每張 ≤ 5MB；最多 5 張 |
| E-8 | §3 consultation rate limit | P1 | 每 lineUserId 同時 PENDING ≤ 3；超過回 429「您已有諮詢待回覆」；EXIF strip on upload |
| E-9 | §3 convert-to-booking 單一 transaction + double-convert 防護 | P1 | `consultation.status='CONVERTED'` 用 unique partial index 或 `WHERE status='PENDING'` 條件更新 |
| E-10 | §5 CRM 用單一 CTE 取代 N+1 | P1 | 改寫 `recalculateSegments()` 用 `WITH visits AS (SELECT userId, COUNT(*) FILTER ...) GROUP BY userId`；加 `bookings(tenantId, userId, status, date)` index |
| E-11 | §5 CRM VIP 降級行為明確化 | P5 explicit | VIP → REGULAR 不推 LINE（默默降）；REGULAR → AT_RISK 推 LINE（再行銷觸發點）|
| E-12 | §6 settlement cron — **不用 5 分鐘 cron** | P3+P6 | 改用既有 `notifications` 表：booking 建立時插入「結束前 20 分推播」notification，由既有 hourly cron 派送（resolution 60 min 可接受；60 min 內 Ken 不會「正在收下一個錢」）|
| E-13 | §6 Web Push fallback：admin 開頁 banner | P1 | 進 admin 任何頁時跑「missed settlements」query（payment.status PENDING + booking.endTime < now）→ 顯示頂端 banner，連到對帳卡 |
| E-14 | §6 LIFF 多 PENDING 時讓客人選 | P1 | `transfer/page.tsx` 若 `pendingBookings.length > 1` → 顯示選擇器；未滿足前不顯示帳號 |
| E-15 | §8 experimentArm persist to `User` row | P1 | `User` 加 `couponExperimentArm String?`；首次發券時寫入；後續一律讀 |
| E-16 | §10.1 Excel parser 改 `exceljs`（取代 xlsx，能讀 font color）| P5 explicit | `package.json` 加 `exceljs`；移除 `xlsx` 計畫；test 覆蓋紅字偵測 |
| E-17 | §10.1 Booking.id 用 `(tenantId+date+startTime+normalizedName)` 的 deterministic hash | P1 | 重跑 import 不會雙倍；upsert by id |
| E-18 | §10.1 import 加「only demo tenant」guard | P1 | 預設拒絕 production tenant；`--force-prod` 才允許；CLI prompt 二次確認 |
| E-19 | §11 Rich Menu atomic swap | P5 explicit | 順序：upload new → verify GET → setDefault → 留 24h grace → delete old；加 429 backoff（exponential, max 5 retries）|
| E-20 | Schema migration 改用 Prisma migrate（不用 db:push）| P1 | 三個新 schema 分 2 deploy：(a) additive 表/欄位 → (b) §5 CRM 常數翻轉。每 deploy 寫 rollback SQL |
| E-21 | 全新功能加 tenant.featureFlags | P1 | `forcedAck` / `dragReschedule` / `consultationFlow` / `settlementCard` / `couponAbTest` 全部預設 off；Ken tenant 啟用後 dogfood 1 週才推其他 |

### Phase 3 完成狀態

- ✅ Codex Eng 跑完
- ✅ Claude subagent Eng 跑完
- ✅ 共識表產出
- ✅ 21 項自動決策補進 PRD（執行前要在每個 § 對應位置展開）
- ✅ 1 個新發現的 CRITICAL 安全漏洞（E-4）已標註
- → 進 Phase 4 (Final Gate)

---

## /autoplan Phase 3.5 — DX Review

**狀態**：跳過。這是消費者產品（LINE 預約系統），不是開發者工具或 SDK。Phase 0 偵測 DX scope 雖達 50 matches，但實際是因為 PRD 引用很多內部 API 路由跟 G-stack skill 名稱，並非真正的開發者面向產品。

---

## /autoplan Phase 4 — Final Approval Gate

**Plan Summary**：1008 Hair Studio 預約系統 V3 改版，融合 Ken 老闆訪談 + 碩展顧問訪談；包含服務重構、強制 ack、諮詢流程、行事曆 V3、CRM 調整、付款 UX、關鍵字回覆、回購券 A/B、品牌套用、報表、bug 修。**Phase 1 用戶已決定砍信用卡 + 簡化 A/B**。

### 自動決策摘要
- **CEO Phase 1**：1 個 user challenge 已解（用戶 2026-04-25 拍板）
- **Design Phase 2**：12 項規格補完（UI states、zoom 數值、bottom sheet 拍板等），全部 P1/P5 自動決策
- **Eng Phase 3**：21 項架構/安全修正（含 1 個新 CRITICAL 安全漏洞 E-4），全部 P1 自動決策

### 仍待用戶最終拍板的事項

雖然 CEO Phase 1 user challenge 已解，但 Eng Phase 3 又出現 **1 個 critical 安全發現** 跟 **1 個基礎設施限制**，這 2 件不能 silently auto-decide：

1. **E-4 walk-in `preAcknowledged` 安全漏洞**：原 PRD 設計讓 admin 可在新預約時設此 flag pre-ack，但 subagent 指出這是 V1.3 修過的 `lineUserId` 同類 auth-bypass。**強烈建議拿掉這個 walk-in 例外**（讓 walk-in 也走 ack queue），或加上嚴格 server-side 防護。
2. **E-12 Vercel Hobby plan cron 限制**：§6 設想的「每 5 分鐘掃 booking 推結帳卡」**超出免費方案**（你之前 ecpay-sweeper 已碰過）。三個選項：(a) 升級 Pro plan ($20/mo) (b) 改用既有 hourly cron（resolution 變 60 min）(c) 不做這個推播，改靠 admin 開頁 banner（E-13）。

### Cross-Phase Themes

- **「scope vs safety」**：CEO 說 scope 太大、Eng 說每個項目都缺安全層 → 信號一致，**V3 動工前必先有 schema migration plan + 每功能 feature flag**
- **「狀態管理是隱性 hot spot」**：3 個 phases 都圍繞 `adminAcknowledgedAt` 出問題（Design 沒規範 / Eng 有 race / CEO 質疑必要性）→ 動工第一件事應該畫狀態圖 + 寫 invariants

### Phase 4 完成狀態

- ✅ Pre-gate verification 全項過（除略過的 DX）
- ✅ E-4 已解決（用戶澄清：拿掉 walk-in 例外、§2 改為「認知通知」語意、自動消除安全漏洞）
- ✅ E-12 已解決（用戶澄清：不需要結束前 20 分推播；§6 改為老闆主動進後台對帳；自動消除 Vercel Hobby plan 問題）

### autoplan 整體成果摘要

**3 phase 跑完，scope 跟架構雙重收斂**：

| Phase | 自動決策 | 用戶 challenge 決策 |
|---|---|---|
| Phase 1 CEO | — | 砍 §6 信用卡、§8 A/B 改 95 折統一 |
| Phase 2 Design | 12 項補規格（zoom 數值、bottom sheet、IA 改善等）| — |
| Phase 3 Eng | 21 項補架構（race 防護、idempotency、CTE 等）| 釐清 §2 認知通知語意、釐清 §6 主動對帳模式 |

**新時程**：原 5-6 週 → **4-4.5 週**（砍信用卡 -0.5w、A/B 簡化 -0.5w、§6 cron 砍 -0.5w、§2 簡化 -0.5d）

**關鍵安全 / 架構防護**（必做）：
- E-1 ack 版本 token（防 stale ack）
- E-5 drag-reschedule idempotency key + 真 undo endpoint
- E-7 Supabase Storage RLS for consultation photos
- E-10 CRM CTE（單一 SQL 取代 N+1）
- E-15 experimentArm persist to User row
- E-16 改用 exceljs 取代 xlsx（讀紅字）
- E-17 Excel import deterministic id（防雙倍）
- E-18 import only-demo-tenant guard
- E-20 Prisma migrate（不用 db:push）
- E-21 全功能 tenant.featureFlags

**最後執行順序**（PRD § 依賴與排序保留）：Phase A → B → C → D → E

---

## /autoplan 結束。可以進 Phase A 開始寫 code。


