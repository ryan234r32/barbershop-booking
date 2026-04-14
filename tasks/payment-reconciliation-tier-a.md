# Payment Reconciliation — Tier A 實作計畫

Generated: 2026-04-14
Status: DRAFT（待 /plan-eng-review）
Tier: A（末五碼 + 金額雙重人工對帳；非 Tier S 金流串接）

---

## 目標

把「銀行轉帳」改為**末五碼雙重驗證**對帳流程，並提供老闆端專屬對帳頁，取代目前只能在 booking detail 單筆核對的土法。

**核心 UX 信念**：老闆對帳的真實動線是「銀行 App 推播末五碼 → 貼到系統搜尋框 → 秒找到對應預約」，所以搜尋框是這個頁面的主角，不是列表。

## 已確認規格（2026-04-14）

- **Q1**：末五碼送出後**鎖死不能改**（防詐騙 + 逼客戶認真填一次）
- **Q2**：客戶跳過 choose-method 直接回報末五碼時，系統**自動建 Payment(BANK_TRANSFER)**
- **Q3**：舊 screenshot 上傳功能**完全移除**（UI 拿掉 + `/api/payments/upload` route 刪除），`screenshotUrl` 欄位保留標 deprecated，舊資料不動

## State Machine

```
   ┌─────────┐  客戶選現金     ┌─────────┐
   │ (none)  │──────────────►│ PENDING │─┐ 到店 past-due→COMPLETED
   └─────────┘                └─────────┘ │
       │                           │      │
       │ 客戶選轉帳+填末五碼        │ 客戶改選轉帳+填末五碼
       ▼                           ▼      │
   ┌───────────┐   老闆確認     ┌──────────┐
   │ VERIFYING │───────────────►│ RECEIVED │
   └───────────┘                └──────────┘
       ▲                             ▲
       │ 改填末五碼？**禁止**         │
       └─────────────────────────────┘
```

規則：
- `VERIFYING → VERIFYING` 覆蓋：**擋掉**，回 409
- `RECEIVED → any`：**擋掉**（終態）
- 任何狀態 → `WAIVED`：admin only

---

## 範圍（In Scope）

1. Schema 調整（Payment + PaymentStatus enum）
2. 客戶端付款頁兩階段流程（看資訊 → 回填末五碼）
3. 老闆端新頁面 `/admin/payments`（末五碼搜尋 + 狀態列表）
4. Past-due modal 對接新狀態
5. 自動 LINE 推播（客戶回報、老闆確認兩個節點）

## 範圍外（Out of Scope，需另議）

- Tier S 虛擬帳號（ezPay/綠界）串接 → 見 `docs/boss-tier-s-gateway-pitch.md`
- 訂金機制
- 截圖上傳（本次**移除**依賴；欄位保留但 UI 不主推）
- 推播排程 / 催繳自動化
- CSV 匯出

---

## Schema 變更

```prisma
enum PaymentStatus {
  PENDING    // 待付款：客戶尚未回報
  VERIFYING  // 待對帳：客戶已回報末五碼，等老闆確認（新增）
  RECEIVED   // 已收款
  WAIVED
}

model Payment {
  // 既有欄位保留...
  transferLastFive String?   // 新增：客戶轉出帳號末 5 碼（純數字 5 位）
  verifiedAt       DateTime? // 新增：客戶回報時間
  // screenshotUrl 保留（backward compat）但 UI 不再強調
}
```

Migration：新增欄位皆 optional，無資料遷移成本。

---

## 客戶端：`src/app/(liff)/payment/[bookingId]/page.tsx`

### 流程（兩階段）

**階段 1 — 付款資訊卡**
- 銀行名稱 / 戶名 / 帳號 / 金額，**全部從 `Tenant` 拉**（不再 hardcode）
- 每欄位右側 `[複製]` 按鈕（navigator.clipboard.writeText）
- 倒數計時條：距離預約 <24h 才顯示（避免太早建立心理壓力）
- 主按鈕：`[我已完成轉帳]`

**階段 2 — 回填末五碼**
- 5 個獨立數字輸入格（iOS numeric keyboard，autocomplete off）
- 下方說明文字：「請至銀行 App 查詢您轉出帳戶的後 5 位數字」
- `[送出對帳]` → POST `/api/payments/[bookingId]/verify`
- 送出成功 → toast「✓ 已收到，老闆確認後會通知您」+ 回 `/my-bookings`

### 現金付款
維持現狀：選了現金 → Payment.status = PENDING（到店時 past-due modal 處理）。

### 新 API：`POST /api/payments/[bookingId]/verify`
```ts
body: { transferLastFive: string /* 5 digits */ }
- 驗證：booking 屬於該 LIFF user（requireBookingAuth）
- 驗證：booking 狀態為 CONFIRMED
- 驗證：transferLastFive 為 5 位數字
- Upsert Payment: status=VERIFYING, method=BANK_TRANSFER, transferLastFive, verifiedAt=now
- LINE push 老闆：「{客戶名} 回報末五碼 {12345}，請核對」
- 回 200
```

---

## 老闆端：`/admin/payments`

### UI 結構

```
┌──────────────────────────────────────┐
│ 付款對帳                              │
├──────────────────────────────────────┤
│ 🔍 輸入末 5 碼快速對帳                │
│ ┌────────────────────────────────┐   │
│ │  [ ][ ][ ][ ][ ]               │   │
│ └────────────────────────────────┘   │
│ ← 輸入後即時 filter + autofocus       │
├──────────────────────────────────────┤
│ 待對帳 (2)   待付款 (5)   今日收 $2.4k│
├──────────────────────────────────────┤
│ 🔵 待對帳                             │
│ ┌────────────────────────────────┐   │
│ │ 陳小華・4/14 14:00・男士剪髮    │   │
│ │ 末5碼: 12345 · $500 · 10 分前  │   │
│ │       [✓ 已收款] [金額不符]     │   │
│ └────────────────────────────────┘   │
│                                       │
│ 🟡 待付款（客戶尚未回報）             │
│ ┌────────────────────────────────┐   │
│ │ 李大明・4/15 15:00・染髮        │   │
│ │ $1200 · 預約 2h 前建立          │   │
│ │                        [聯絡]   │   │
│ └────────────────────────────────┘   │
└──────────────────────────────────────┘
```

### 行為細節

- **搜尋框**：頁面載入時 autofocus，輸入 5 碼自動 filter（client-side，資料量小）
- **單鍵已收款**：點 `✓ 已收款` → PATCH `/api/payments/[bookingId]/mark-received` → 無確認彈窗、直接 toast
- **金額不符**：點 → 彈 modal 讓老闆填 note → status 保持 VERIFYING，但標記 `flagged`（新欄位？暫時用 note 欄就好）
- **聯絡客戶**：若 LINE userId 非 manual-synth → 顯示 `line://ti/p/~{userId}`；否則顯示電話

### 新 API：`PATCH /api/payments/[bookingId]/mark-received`
```ts
- requireAdmin
- Payment.status = RECEIVED, receivedAt = now
- LINE push 客戶：「✓ 已確認收款，期待您光臨」
- 回 200
```

### 資料查詢：`GET /api/admin/payments`
```ts
query: { status?: 'VERIFYING' | 'PENDING' | 'RECEIVED' | 'all', from?, to? }
- requireAdmin
- Join booking + user + service
- 預設範圍：today + future pending/verifying
- Return: [{ bookingId, customerName, slot, serviceName, amount, method, transferLastFive, status, verifiedAt }]
```

---

## Tenant 銀行資訊管理

**問題**：`Tenant.bankInfo/bankAccountName/bankAccountNumber` 欄位存在但沒後台 UI。

**方案**：新增 `/admin/settings/payment` 最小頁面
- 三個 input：銀行（含代碼）、戶名、帳號
- Save → PATCH `/api/admin/tenant`
- 客戶端付款頁讀取這三欄取代 hardcode

---

## Past-due Modal 整合

目前：`PATCH /api/bookings/[id]` with `action=complete, paymentMethod=CASH|BANK_TRANSFER` → 才會更新 Payment.status。

調整：
- 若 Payment 已是 VERIFYING 或 RECEIVED → `complete` 時不強制要 paymentMethod
- 若 Payment 仍是 PENDING → 維持現狀（老闆手動選現金/轉帳）

---

## 實作順序（PRs）— 已壓縮為 4 個

**PR 1：Schema + API 基礎（無 UI 變更）**
- Prisma migration：加 `VERIFYING` enum + `transferLastFive` + `verifiedAt`，標 `screenshotUrl` @deprecated
- `POST /api/payments/[bookingId]/report-transfer`（客戶回報末五碼；Payment 不存在時自動建）
- `PATCH /api/payments/[bookingId]/mark-received`（admin 確認收款；idempotent）
- `GET /api/admin/payments`（tenant 隔離 + status filter + 預設 today-7d）
- **刪除** `/api/payments/upload` route 與 Supabase 上傳 client
- 單元測試（state 轉移、zod、tenant 隔離、idempotency）

**PR 2：客戶端付款頁改版**
- 兩階段 UI（看資訊 → 回填末五碼）
- 複製按鈕（帳號、金額）
- 從 Tenant 拉銀行資訊（移除 hardcode）
- 移除上傳截圖 UI
- 末五碼送出後鎖死（UI 顯示「已送出，需聯絡老闆修改」）

**PR 3：`/admin/payments` 頁面 + Tenant 付款設定**
- 搜尋框（autofocus、頂部）
- 三段列表（待對帳 / 待付款 / 已收款）
- 摘要卡
- 單鍵 ✓ 已收款
- 同頁上方 tab 或 settings 子路徑：銀行資訊設定（戶名 / 銀行 / 帳號）

**PR 4：整合 past-due modal + 清理**
- past-due modal 標 COMPLETED 時自動處理 Payment 狀態
- 刪除 `/api/payments/[bookingId]/confirm` 舊 route（或保留重新命名）

---

## 測試計畫

1. **單元**：status 轉移規則（PENDING → VERIFYING → RECEIVED）、末五碼驗證（必須 5 位數字）
2. **整合**：`verify` API 身份驗證（LIFF token）、`mark-received` admin 驗證
3. **E2E（手動）**：
   - 客戶端完整流程：建立預約 → 前往付款 → 複製帳號 → 回填末五碼 → 看到 VERIFYING
   - 老闆端：收到 LINE 通知 → 開 /admin/payments → 搜尋末五碼 → 標記已收款 → 客戶收到 LINE 通知
4. **邊界**：
   - 客戶兩次回報末五碼（第二次覆蓋第一次？還是擋掉？→ 擋掉，已 VERIFYING 不能再改）
   - 老闆標記已收款後客戶又想改末五碼（擋掉）
   - 兩筆不同預約末五碼相同（搜尋顯示兩筆，老闆用金額區分）

---

## 風險 / 未解

1. **末五碼碰撞**：10^5 = 100k 組合，理論上會撞。Mitigation：搜尋同時顯示金額 + 時段，讓老闆眼球比對。
2. **客戶忘記末五碼 / 銀行 App 查不到**：Tier A 沒解。要不要加「我不知道」退路？→ 建議**不加**，強制查詢，否則破功。
3. **Race condition**：客戶回填末五碼 + 老闆同時在看？→ 實務上不會撞，verify API 的 upsert 保證原子性。
4. **多 Tenant 情境**：目前單店，Tenant 設定頁只改自己的。日後 SaaS 化再處理。

---

## Success Criteria

- [ ] 客戶能在 LIFF 內完成「看帳號 → 複製 → 轉帳 → 回填末五碼」不跳出
- [ ] 老闆打開 `/admin/payments`，輸入末五碼 2 秒內找到對應預約
- [ ] Payment.status 三階段流轉正確，每階段都推 LINE
- [ ] 銀行資訊改從 Tenant 讀，不再 hardcode
- [ ] 28+ 個現有測試全綠，新增至少 6 個測試（status 轉移 + API auth）

---

## 後續（Tier S 升級路徑）

見 `docs/boss-tier-s-gateway-pitch.md` — 若老闆同意串 ezPay/綠界虛擬帳號，Tier A 的 `/admin/payments` 頁面可保留，只是大部分項目自動變 RECEIVED，老闆端變成「異常處理」頁面而非「日常對帳」頁面。
