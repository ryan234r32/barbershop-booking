# 夯客風格 v3.5 行事曆改版 Plan

**狀態**: PLANNING — 等下次 session 開始實作
**參考**: 1008 老闆觀察夯客 (HangKe) app 後的需求
**範圍**: 行事曆 + booking 詳情 + 結帳 + 每日現金流 + 首頁 IA
**估時**: 全做 5–8 個工作天，分 4 phase

---

## 1. 用戶需求總覽（從對話濃縮）

### 1.1 夯客做對的 5 件事

1. **日曆作為應用根基**（首頁 IA）
   - 日曆是常駐底層，其他功能（報表、現金流、會員）都是「拉出來 → 關掉回日曆」
   - 比現在的 4-tab bar（日曆／訊息／報表／更多）更貼合「老闆 80% 時間都在看日曆」的事實

2. **狀態三段式**（尚未到來 / 已報到 / 爽約）
   - 取代我們現在「完成現金 / 完成轉帳 / 改時間 / 取消 / 未到」5 顆按鈕
   - **狀態**和**動作**分開：上面三段選狀態，下面「進行結帳」是唯一動作
   - 「已報到」才解鎖結帳按鈕 — UX 強引導：先確認客人來了，再收錢

3. **多支付方式合計**（一筆訂單可拆現金 + 信用卡）
   - 我們現在只能選一種 method
   - 夯客直接讓你分項輸入金額，自動加總對齊總額

4. **「帳單與業績計入日期」分離**（**用戶決定不做**，永遠等於服務日期）
   - 場景：4/27 服務但 4/30 才付款 → 業績算到 4/30
   - 用戶說：「不太會有那種今天消費明天付的狀況，就算發生也算當天」→ 砍掉這個欄位

5. **每日現金流頁面**
   - 一頁看「今日收了多少 + 怎麼來的」（現金 / 信用卡 / 匯款 / LINE Pay）
   - 每個 method 細分「結帳收款 vs 預收定金」
   - 老闆每天晚上 8 點對帳的最佳介面

### 1.2 用戶補充的關鍵流程

- **客戶到達**：老闆**手動**點「已報到」（不要自動）
- **客戶遲到**：老闆 15-20 分鐘確認後**手動**點「爽約」
- **遺漏報到**：客人沒先點已報到、老闆直接點結帳 → 系統**自動先補點已報到**再進結帳流程
- **預約時間到還沒按已報到**：放著就好，老闆自己決定何時按（不要自動標）

### 1.3 用戶要的全螢幕跳轉行為

- **點 FAB「+」**：開全螢幕新增頁，左上角 X 關閉回日曆
- **點預約 block**：開全螢幕詳情頁，左上角 X 關閉回日曆
- 動畫風格：**iOS bottom sheet**（從底部上推、頂部圓角、留 ~50px 顯示日曆）

---

## 2. 已鎖定的設計決策

| # | 問題 | 鎖定值 | 理由 |
|---|---|---|---|
| A1 | 「已報到」=？ | 客人到場、老闆**手動**標 | 用戶明確選擇 |
| A2 | 預約時間過了還在尚未到來？ | **不自動轉**狀態，老闆自己決定 | 用戶明確選擇 |
| A3 | Walk-in fast path? | 走標準路徑（FAB → 新增 → 預設已報到 → 結帳） | 不另開捷徑（過度設計） |
| B1 | 業績計入日期 | **砍** — 永遠 = 服務日期 | 用戶說 1008 用不到 |
| B2 | 多支付方式拆分 | **Phase 2** 才做 | 1008 真實混付率低 |
| C1 | 結帳按鈕在「尚未到來」與「爽約」狀態 | **隱藏**（不是 disabled） | 視覺乾淨 |
| C1b | 結帳但狀態還是「尚未到來」 | **自動補點已報到**再進結帳 | 老闆遺漏保險 |
| C2 | 切換狀態要不要彈 dialog？ | 「已報到」**不彈**（可逆）；「爽約」**彈**（會 +1 violation） | 平衡誤觸風險 vs 操作流暢 |
| C3 | 全螢幕動畫風格 | **iOS bottom sheet**（圓角、上方留 ~50px） | 配合夯客觀察 |

### 待 demo 後再決定

| # | 問題 | 候選 |
|---|---|---|
| D1 | 首頁 IA 改革 | 保守（保留 tab bar）vs 激進（砍 tab bar 純日曆 + modals） |
| D2 | 多 staff 支援 | Hardcode Ken 一人 vs schema 設計多 staff |
| D3 | 報表頁 vs 每日現金流 | 分開兩頁 vs 報表頁加 tab |

---

## 3. Schema 改動

### 3.1 Booking 表
```prisma
model Booking {
  // ... 既有欄位

  // NEW (v3.5)
  checkedInAt DateTime? @map("checked_in_at")
  // 客人實際到場時間。null = 尚未到來；NOT null = 已報到
  // 「爽約」走既有 status = NO_SHOW 路徑，不存 checkedInAt

  // 不加 accountingDate（用戶決定 = service date）
}
```

**狀態邏輯**：
| 顯示 | status | checkedInAt |
|---|---|---|
| 尚未到來 | CONFIRMED | NULL |
| 已報到 | CONFIRMED | NOT NULL |
| 爽約 | NO_SHOW | NULL |
| 已完成 | COMPLETED | NOT NULL（一定有結帳記錄） |
| 已取消 | CANCELLED / CANCELLED_BY_ADMIN | irrelevant |

### 3.2 Payment 表（Phase 2 才動）
Phase 1 維持單一 method（現金 / 轉帳 / ECPay）。Phase 2 拆細表：

```prisma
// Phase 2 only
model PaymentEntry {
  id        String  @id @default(uuid())
  paymentId String  @map("payment_id")
  method    PaymentMethod
  amount    Int
  payment   Payment @relation(fields: [paymentId], references: [id])
}
```

Migration 注意：既有 Payment 走「主 method + amount」單筆，新模型「多 entry」，要寫 backfill script。

---

## 4. API 改動

### 4.1 新增 endpoint

**`PATCH /api/bookings/[id]/checkin`**
```ts
// body: {} (no body needed, just toggle)
// 行為：
//   if checkedInAt is NULL → set to now()
//   if checkedInAt is NOT NULL → set to NULL（取消已報到）
// 防誤觸：
//   - 同前 idempotency / row lock 模式
//   - 跨裝置 stale check 走 expectedUpdatedAt（沿用 ack 模式）
// 權限：admin only
```

**`PATCH /api/bookings/[id]/no-show`**
```ts
// body: {}
// 行為：
//   set status = NO_SHOW
//   user.violationCount += 1（跨表 transaction）
//   reset checkedInAt = NULL
//   cancel reminders
// 權限：admin only
// 注意：不可逆（dialog 確認在 client 端做）
```

**`POST /api/bookings/[id]/checkout`**（取代既有 `complete` action）
```ts
// body: { method: PaymentMethod, amount: number, notes?: string }
// 行為：
//   if checkedInAt is NULL → 自動 set checkedInAt = now() (auto-checkin)
//   create Payment row
//   set booking.status = COMPLETED
//   schedule coupon issuance (if applicable)
//   notify customer LINE「已完成」
// Phase 2:
//   body 改 { entries: [{ method, amount }, ...], notes }
```

**`GET /api/admin/cash-flow?date=YYYY-MM-DD`**
```ts
// 回傳：
//   {
//     date: "2026-04-27",
//     totalReceived: 4000,    // 今日總收款
//     fromCheckout: 4000,      // 來自結帳
//     fromDeposit: 0,          // 預收定金（reschedule fee？）
//     byMethod: {
//       CASH: { fromCheckout: 2000, fromDeposit: 0, total: 2000 },
//       CREDIT_CARD: { fromCheckout: 1000, fromDeposit: 0, total: 1000 },
//       BANK_TRANSFER: { ... },
//       LINE_PAY: { ... },
//       ECPAY_ATM: { ... }
//     }
//   }
// 權限：admin only
```

### 4.2 既有 endpoint 改動

- **既有 `POST /api/bookings/[id]/complete`** → 重定向至新 `/checkout`，或保留向後相容
- 既有 BookingDetailSheet 「完成（現金）」「完成（轉帳）」按鈕 → 移除，改走結帳 sub-flow

---

## 5. UI 改動

### 5.1 新元件

**`<BookingDetailFullPage>`** （取代 BookingDetailSheet）
```
┌───────────────────────────────────┐
│ X                  手機版APP・時間  │
├───────────────────────────────────┤
│  [客戶頭像]  電話                   │
│             客戶名                  │
│             上次預約姓名: ...       │
├───────────────────────────────────┤
│ ┌─────┬──────┬──────┐              │ ← 三段狀態 segment
│ │尚未  │ 已報到 │ 爽約 │              │   點「爽約」彈 dialog 確認
│ └─────┴──────┴──────┘              │
├───────────────────────────────────┤
│ ┌───────────────────────────────┐ │ ← 已報到時才出現
│ │ 💰 進行結帳         明細 ⋯  │ │   點 → 開 CheckoutFullPage
│ └───────────────────────────────┘ │
├───────────────────────────────────┤
│ 店家 / 日期 / 時長 / NT$1000        │
│ 服務人員 ▶                         │
│ 服務 ▶                             │
│ 數量 1 位                          │
│ 筆記（僅商家可見）▶                │
└───────────────────────────────────┘
[發送訊息] [編輯] [取消] [複製] [更多]
```

**`<NewBookingFullPage>`**（取代 NewBookingSheet）
- 同樣 layout 風格
- 預設狀態 = 尚未到來
- 從 FAB「+」開啟

**`<CheckoutFullPage>`**（新）
```
┌───────────────────────────────────┐
│ X         結帳                    │
├───────────────────────────────────┤
│ 👤 [客戶選擇]               ▶    │
│ 📅 帳單日期 = 服務日期      ▶    │ ← 永遠等於服務日期，不可改
├───────────────────────────────────┤
│ 服務                      ▶      │
│   • 男性剪髮          1,000      │
│   --------------                  │
│   整筆票券/折扣 ▼                │
└───────────────────────────────────┘
                   合計 NT$1,000
[結帳 NT$1,000 →]
```

點「結帳」→ 「**選擇支付方式**」次頁：
```
Phase 1（單一 method）：
  ◯ 現金   ◯ 信用卡   ◯ 匯款   ◯ LINE Pay   ◯ 街口   ◯ 其他
  [結帳 NT$1,000]

Phase 2（多 method）：
  現金     [_____] 找零計算
  信用卡   [_____]
  匯款     [_____]
  LINE Pay [_____]
  ...
  合計 vs 應付 對齊提示
  [結帳 NT$1,000]
```

**`<DailyCashFlowPage>`**（新）
```
┌───────────────────────────────────┐
│ X       每日現金流          ⓘ    │
├───────────────────────────────────┤
│ 4 月 27 日, 2026 ▼      今天      │
│ [週五24] [週六25] ... [週四30] →  │
├───────────────────────────────────┤
│ 今日總收款        NT$4,000        │
├───────────┬───────────────────────┤
│ 來自結帳  │ 預收定金              │
│ $4,000    │ $0                    │
├───────────┴───────────────────────┤
│ 現金                              │
│   來自結帳收款           $2,000 ▶ │
│   預收定金               $0     ▶ │
│   合計                   $2,000   │
├───────────────────────────────────┤
│ 信用卡                            │
│   ...                             │
└───────────────────────────────────┘
```

### 5.2 全螢幕 Sheet 動畫規格

- **進入**：bottom-up 從底部推進，250ms ease-out
- **頂部**：留 ~50px 顯示後方日曆模糊，sheet 上方圓角 16px
- **狀態列**：保留系統狀態列在最上（不被覆蓋）
- **退出**：
  - 點左上 X → 250ms ease-in 滑下消失
  - 滑下手勢（drag down on top edge）→ 跟隨手指、放開回彈
- **背後日曆**：模糊度 8px + 暗 30%

技術實作：用既有的 `vaul` (Drawer) library + `snapPoints={[0.92]}` 接近全螢幕但留 8% 給後方。

### 5.3 首頁 IA 改革（Phase 4，最後做）

**選項 1（保守，建議先這樣）**：
- 保留 4-tab bar（日曆／訊息／報表／更多）
- 只是把「日曆」變成預設 landing
- 點報表 → 進報表頁，左上 X 回日曆

**選項 2（激進，demo 後考慮）**：
- 砍 tab bar
- 日曆是唯一根頁
- 右上漢堡選單開抽屜（訊息／報表／設定／⋯）
- 浮動按鈕只有 FAB「+」

→ Phase 4 才動，先觀察用戶用 phase 1-3 後的回饋再決定。

---

## 6. Phase 拆分

### Phase 1：核心狀態流（demo 後 1-2 天可做）
**包含**：
- Schema：Booking.checkedInAt
- API：checkin / no-show
- UI：BookingDetailSheet → BookingDetailFullPage
- 三段狀態 segment + 「進行結帳」按鈕（Phase 1 仍走既有「完成」flow）
- 「結帳前自動補已報到」邏輯
- 爽約確認 dialog

**估時**：3-4 天
**Demo 衝擊**：老闆能看到「報到 → 結帳」乾淨流程，立刻有感

### Phase 2：結帳重構
**包含**：
- POST /api/bookings/[id]/checkout 新 endpoint
- CheckoutFullPage + 選擇支付方式 sub-page
- 多支付方式 PaymentEntry schema
- Backfill 既有 Payment 資料

**估時**：2-3 天

### Phase 3：每日現金流頁
**包含**：
- GET /api/admin/cash-flow
- DailyCashFlowPage UI
- date picker + week strip
- 各支付方式分組顯示

**估時**：1-2 天

### Phase 4：首頁 IA 改革（demo 後決定要不要做）
- 純日曆 + modals（激進選項）
- 或保守：tab bar 留著但日曆優先

**估時**：2 天

---

## 7. 還沒答的關鍵問題

### 7.1 等用戶補的截圖
- **「報表篩選 session」** — 夯客那邊的報表頁長怎樣，要評估「報表 vs 每日現金流」要不要合併

### 7.2 待答的次要問題
- **多 staff 設計**：1008 現在是 Ken 一人，但夯客 schema 有「服務人員」欄位。我們要不要 schema 預留多 staff 還是 hardcode Ken？
- **紅利點數 / 額外業績**：夯客結帳頁底下有這兩個欄位。1008 要不要做 loyalty program？
- **預收定金**：夯客每日現金流區分「結帳收款 vs 預收定金」。我們既有 ECPay ATM 預付走哪邊？

---

## 8. Migration / 既有資料

- **既有 booking**（status = COMPLETED 但沒有 checkedInAt）：grandfather 處理，視為「已報到 + 已結帳」
- **既有 payment**：Phase 2 做 schema migration 時要 backfill 成 PaymentEntry 單筆

---

## 9. 開新 Session 時的接手指南

1. 開新 session，**把這份 plan 整份貼進去**
2. 跟 Claude 說：「按照 phase 1 開始實作，每個 sub-step 先 commit + push + 我親手 merge」
3. 第一個 commit 應該是 schema migration（Booking.checkedInAt 加欄位）
4. 第二個 commit 是 PATCH /api/bookings/[id]/checkin endpoint + test
5. 第三個 commit 是 BookingDetailFullPage UI（取代 BookingDetailSheet）

---

## 10. 風險與假設

| 風險 | 機率 | 影響 | 緩解 |
|---|---|---|---|
| 全螢幕 sheet 動畫在 iOS PWA 不夠順 | 中 | 中 | 用 vaul library，已驗證 iOS 兼容 |
| Phase 1 改 BookingDetailFullPage 動到太多既有 flow | 高 | 中 | 開 feature flag `useFullPageBookingDetail`，預設 false 漸進 rollout |
| 多支付方式 schema migration 出錯 | 中 | 高 | Phase 2 才做，Phase 1 不動 schema → 風險集中於 Phase 2，可選擇延後 |
| 首頁 IA 改革砍 tab bar 老闆不適應 | 中 | 高 | Phase 4 demo 後再決定，feature flag 可隨時切回 |

---

**Plan 結束。下一個 session 看到這份就能無痛接手。**
