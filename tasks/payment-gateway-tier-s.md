<!-- /autoplan restore point: /Users/ryan/.gstack/projects/ryan234r32-barbershop-booking/main-autoplan-restore-20260415-000728.md -->
# Payment Gateway Tier S — 綠界 ECPay 虛擬帳號自動對帳

Generated: 2026-04-14 (updated 2026-04-15)
Status: DRAFT v2（含頂尖美業系統研究啟示；待 /autoplan 四輪審核）
Vendor: **綠界 ECPay**（比較結果見對話紀錄；選擇理由：個人戶可用、文件最完整、社群 SDK 成熟、月費 0、ATM 1% 最低 10 元）

---

## 🌟 頂尖美業系統研究啟示（2026-04-15）

研究對象：Booksy / Fresha / GlossGenius / Vagaro / Square Appointments / Treatwell / HotPepper Beauty / Minimo / LineBooking / StyleMap

### 核心發現
1. **歐美頂尖（Fresha/Booksy/GlossGenius）玩「綁卡 + no-show 才扣」**——用 Stripe/Adyen 的 authorization hold。**台灣金流做不到**（綠界/藍新 pre-auth 支援極弱），別追這個幻想。
2. **日本 HotPepper / 台灣 LineBooking 主流「到店付」**——東亞文化對「預約就要先付錢」抗拒度高，強制訂金會直接流失 30-50% 新客。
3. **我們現行的「違規記點 → 下月電話預約」是文化最合適的武器**——面子文化下比扣錢更有嚇阻力，且 0 客訴風險。
4. **Fresha 的分層設計最值得學**：新客 + 高單價才收訂金；老客 / 低單價免訂金。

### 本 plan 直接採用的啟示
- ✅ **到店付為預設**：付款方式預設選「現金」，ATM 是可選項，不強推
- ✅ **Tier A + Tier S 共存**：客人自己選（免手續費 vs 自動對帳）
- ✅ **不強制訂金**：沿用現有違規記點制，不走歐美 pre-auth 路線
- 🆕 **未來可選：分層策略**（V2.x）——新客燙染才提示「建議先付訂金」；VIP 老客付款頁直接預選「到店付」
- 🆕 **未來可選：VIP 禮遇 UX**（V2.x）——付款頁顯示「您是 VIP 老客，免訂金直接預約」

---

## 0. 哲學 / 核心信念

**Tier S 與 Tier A 並存，不是取代**。
- 客戶在付款頁可以選「**自己轉帳填末五碼**」（Tier A，免手續費）或「**系統產生專屬帳號**」（Tier S，扣 1%）
- 老闆預設開啟兩種，客戶自己選
- 選 Tier S 的客戶，錢真的到了系統才亮 → `/admin/payments` 自動變綠，老闆完全不用動手
- 選 Tier A 的客戶沿用現在流程

**為什麼並存而不取代**：
1. 小額剪髮 500 元 × 1% = 5 元，但最低 10 元 = 2% → 有些客戶不想被扣
2. 老熟客習慣自己轉帳 + LINE 跟老闆確認，不想被改流程
3. Tier S 撥款 T+10，老闆若要現金流快可以引導老客戶走 Tier A
4. 分散風險：綠界出包時 Tier A 仍可用

### 已確認的政策決策（2026-04-15 與 Ryan 對齊）

| 決策 | 選項 | 理由 |
|---|---|---|
| **哪些服務開 ATM** | **全部服務都開** | 客人自由選；小額被扣 2% 客人自己認；Tier A 保留讓想省的人走 |
| **付款期限** | **預約當天營業開始前一刻（11:00）** | 客人不會忘；老闆開店前就知道誰真的會來；過期 fallback 成 PENDING（現金到店付） |
| **預設付款方式** | **現金** | 東亞客人習慣「先約再說」；ATM 是選項不是強推 |
| **新客 / VIP 分層** | **MVP 不做，V2 再議** | 先驗證核心自動對帳流程；分層要先有「標 VIP」後台 UI |
| **訂金** | **不做** | 沿用違規記點制，這是我們的文化護城河 |
| **退款** | **MVP 不做自動退款** | 老闆手動退 + 標 WAIVED 夠用 |

---

## 1. 架構總覽

```
┌──────────────────────────────────────────────────────────────────┐
│  客戶端 LIFF：/payment/[bookingId]                                │
│  ┌────────────────────┐        ┌────────────────────┐            │
│  │  選項 A：           │        │  選項 B：           │            │
│  │  自己轉帳 + 末五碼  │        │  系統產生專屬帳號   │            │
│  │  （Tier A 現流程）  │        │  （Tier S 新流程）  │            │
│  └────────────────────┘        └────────┬───────────┘            │
│                                         │ POST                   │
└─────────────────────────────────────────┼────────────────────────┘
                                          ▼
            ┌──────────────────────────────────────────┐
            │  POST /api/payments/[bookingId]/         │
            │       ecpay/create-order                 │
            │  - 檢查 booking + auth                   │
            │  - 建 ECPayOrder 記錄                    │
            │  - 呼叫綠界 AioCheckOut API              │
            │  - 取得虛擬帳號 + 到期時間               │
            │  - 更新 Payment(status=AWAITING_BANK)    │
            │  - 回傳虛擬帳號給客戶端                  │
            └────────────────┬─────────────────────────┘
                             ▼
            ┌──────────────────────────────────────────┐
            │  客戶看到：銀行代碼 + 虛擬帳號 + 金額 +   │
            │  到期時間，按鈕「複製帳號」              │
            └──────────────────────────────────────────┘
                             │
                             │ 客戶去銀行 App 匯款
                             ▼
            ┌──────────────────────────────────────────┐
            │  綠界伺服器收到入帳                      │
            │  ├─► POST 回來：ReturnURL                │
            │  │   /api/webhooks/ecpay/return          │
            │  └─► 驗簽 → 更新 Payment(status=RECEIVED)│
            │      → push 客戶「已收款」               │
            │      → push 老闆「自動對帳完成」         │
            │      → 回「1|OK」給綠界                  │
            └──────────────────────────────────────────┘
```

### 關鍵設計決策

1. **Tier S 產生的 Payment 狀態流**：
   - `AWAITING_BANK`（新 enum 值）→ 客戶拿到虛擬帳號、尚未匯款
   - `RECEIVED` → webhook 確認入帳後
   - 不經過 `VERIFYING`（Tier A 才需要人工對）
2. **一個 Booking 一個 ECPayOrder**：重試時新的 order 會取代舊的（舊的還沒付就作廢）
3. **ECPay MerchantTradeNo**：格式 `TS{bookingId前8碼}{timestamp後6碼}`，需 ≤20 字元、英數字、全域唯一
4. **Webhook 用 Node.js runtime**（不是 Edge），綠界 POST 是 `application/x-www-form-urlencoded`

---

## 2. DB Schema 變更

```prisma
// 新增到 PaymentStatus enum
enum PaymentStatus {
  PENDING         // 待付款（Tier A）
  AWAITING_BANK   // 已產生虛擬帳號、等待入帳（Tier S，新）
  VERIFYING       // 待對帳（Tier A）
  RECEIVED        // 已收款
  WAIVED          // 免收
  EXPIRED         // 虛擬帳號過期未入帳（Tier S，新）
}

// 新增到 PaymentMethod enum
enum PaymentMethod {
  CASH
  BANK_TRANSFER      // Tier A：客戶自己轉
  ECPAY_ATM          // Tier S：綠界虛擬帳號（新）
}

// 新增 model：記錄綠界訂單
model ECPayOrder {
  id              String    @id @default(uuid())
  tenantId        String    @map("tenant_id")
  bookingId       String    @map("booking_id")
  paymentId       String    @map("payment_id")

  // 綠界資訊
  merchantTradeNo String    @unique @map("merchant_trade_no")  // 我們送給綠界的訂單號
  merchantTradeDate String  @map("merchant_trade_date")        // 綠界要求格式 yyyy/MM/dd HH:mm:ss
  tradeNo         String?   @map("trade_no")                   // 綠界回傳的交易編號（webhook 才有）

  amount          Int
  bankCode        String?   @map("bank_code")                  // 虛擬帳號銀行代碼，例 "008"
  vAccount        String?   @map("v_account")                  // 虛擬帳號
  expireDate      DateTime? @map("expire_date")                // 虛擬帳號過期時間

  status          ECPayOrderStatus @default(CREATED)
  rawResponse     Json?     @map("raw_response")               // 綠界建單回應
  rawWebhook      Json?     @map("raw_webhook")                // 綠界 webhook payload

  createdAt       DateTime  @default(now()) @map("created_at")
  updatedAt       DateTime  @updatedAt @map("updated_at")

  booking         Booking   @relation(fields: [bookingId], references: [id])
  payment         Payment   @relation(fields: [paymentId], references: [id])

  @@index([tenantId, status])
  @@index([bookingId])
  @@map("ecpay_orders")
}

enum ECPayOrderStatus {
  CREATED        // 已建立，尚未呼叫綠界 API
  PENDING        // 綠界已產生虛擬帳號，等客戶匯款
  PAID           // 已收款（webhook 確認）
  EXPIRED        // 逾期未付
  FAILED         // 建單失敗
}

// Payment model 加 relation
model Payment {
  // ... existing fields
  ecpayOrders ECPayOrder[]
}

model Booking {
  // ... existing fields
  ecpayOrders ECPayOrder[]
}
```

**Migration 成本**：純加欄位 + 加 enum 值 + 新 table，零資料遷移。

---

## 3. API 路由清單

| 方法 | 路徑 | 用途 | 認證 |
|---|---|---|---|
| POST | `/api/payments/[bookingId]/ecpay/create-order` | 客戶選 Tier S 後呼叫，產生虛擬帳號 | `requireBookingAuth` |
| GET | `/api/payments/[bookingId]/ecpay/status` | 客戶端輪詢是否入帳（或 LINE push 觸發） | `requireBookingAuth` |
| POST | `/api/webhooks/ecpay/return` | 綠界 webhook：入帳通知 | CheckMacValue 驗簽 |
| POST | `/api/webhooks/ecpay/client-return` | 綠界前景導回（顯示結果頁） | CheckMacValue 驗簽 |
| GET | `/api/admin/ecpay/orders` | 老闆端：看所有綠界訂單（含 raw payload） | `requireAdmin` |

### 3.1 `POST /api/payments/[bookingId]/ecpay/create-order`

```ts
// Input: （無 body，從 URL params + auth 取）
// 1. requireBookingAuth → 取 lineUserId or adminId
// 2. 找 booking（tenant 隔離）+ 驗證 status === 'CONFIRMED'
// 3. 檢查是否已有 Payment.status === 'RECEIVED' → 擋（409）
// 4. 檢查是否已有 PENDING 的 ECPayOrder → 回舊的（idempotent）
// 5. Upsert Payment(method=ECPAY_ATM, status=AWAITING_BANK)
// 6. 建 ECPayOrder(status=CREATED, merchantTradeNo=生成)
// 7. 呼叫綠界 AioCheckOut API（ChoosePayment=ATM）
// 8. 解析回應，取得 BankCode + vAccount + ExpireDate
// 9. 更新 ECPayOrder(status=PENDING, bankCode, vAccount, expireDate, rawResponse)
// 10. 回傳 { bankCode, vAccount, expireDate, amount }

// 錯誤處理：綠界 API 失敗 → ECPayOrder.status=FAILED + Payment.status 回 PENDING
```

### 3.2 `POST /api/webhooks/ecpay/return`

```ts
// 綠界 POST application/x-www-form-urlencoded
// 1. await request.formData() 取所有欄位
// 2. 取出 CheckMacValue，用我們的 HashKey/HashIV 重新計算驗簽
// 3. 驗簽失敗 → log + 回 "0|ErrorMessage"（不要 throw，綠界會一直重送）
// 4. 用 MerchantTradeNo 找 ECPayOrder（unique）
// 5. 若找不到 → log + 回 "1|OK"（避免綠界重送；但 alert 老闆）
// 6. 若 status 已是 PAID → 直接回 "1|OK"（idempotency）
// 7. RtnCode === 1 → PAID：
//    - ECPayOrder.status=PAID, tradeNo, rawWebhook
//    - Payment.status=RECEIVED, receivedAt=now
//    - LINE push 客戶「✓ 已收款」
//    - LINE push 老闆「自動對帳完成 {客戶名} ${amount}」
// 8. RtnCode !== 1 → 記錄失敗理由，不動 Payment
// 9. 回 "1|OK"（純文字，不是 JSON）

// 必做 idempotency：整個 handler 用 DB transaction + ECPayOrder.status 當 guard
```

---

## 4. Webhook 驗簽（CheckMacValue）

綠界用 `HashKey + 參數排序 + HashIV + SHA256 大寫`：

```ts
// src/lib/ecpay/checksum.ts
export function generateCheckMacValue(
  params: Record<string, string>,
  hashKey: string,
  hashIV: string
): string {
  // 1. 排除 CheckMacValue 自己
  const filtered = Object.entries(params).filter(([k]) => k !== 'CheckMacValue');
  // 2. 按 key 字母順序排序（大小寫敏感？→ 不敏感，全轉小寫排序）
  const sorted = filtered.sort(([a], [b]) => a.toLowerCase().localeCompare(b.toLowerCase()));
  // 3. 組成 HashKey=xxx&K1=V1&K2=V2&...&HashIV=yyy
  const raw = `HashKey=${hashKey}&${sorted.map(([k, v]) => `${k}=${v}`).join('&')}&HashIV=${hashIV}`;
  // 4. urlEncode（綠界自訂 encode 表，不是 encodeURIComponent！）
  const encoded = ecpayUrlEncode(raw).toLowerCase();
  // 5. SHA256 大寫
  return crypto.createHash('sha256').update(encoded).digest('hex').toUpperCase();
}

// 綠界 URL encode 例外表：
// encodeURIComponent 會 encode 但綠界不 encode 的字：- _ . ! * ( )
// 直接抄官方 Node.js 範例的 encode 函式，不要自己寫
```

**驗證**：建 sandbox 訂單 → 用綠界回的 CheckMacValue 反算，對得上才對。

---

## 5. 退款流程

Tier S MVP **不做自動退款**。原因：
1. 綠界虛擬帳號退款要走他們的退款 API，需額外簽約
2. 小店實務上退款頻率極低（客人不會要退款，頂多改期）
3. 老闆手動退款（銀行 App 匯回去）+ `/admin/payments` 標 `WAIVED` + 備註 → 夠用

**若未來要做**：新增 `POST /api/admin/ecpay/orders/[id]/refund` 呼叫綠界 AioChargeback API（另一個獨立任務）。

---

## 6. 客戶端 UI 變更

### 6.1 `/payment/[bookingId]` 付款方式選擇（現有頁改）

```
┌────────────────────────────────────────┐
│ 選擇付款方式                            │
├────────────────────────────────────────┤
│ ◉ 現金（到店付）                        │
│ ○ 自己轉帳（免手續費，需回填末五碼）    │
│ ○ 系統產生專屬帳號（自動對帳，+$10）    │
└────────────────────────────────────────┘
```

選「系統產生專屬帳號」→ 呼叫 `create-order` API → 顯示：

```
┌────────────────────────────────────────┐
│ 請匯款至以下帳號：                      │
│                                         │
│ 銀行：玉山銀行 (008)       [複製]       │
│ 帳號：1234-5678-9012-3456  [複製]       │
│ 金額：$500                 [複製]       │
│                                         │
│ ⏰ 請在 2026-04-15 20:00 前完成         │
│                                         │
│ 💡 匯款後系統會自動確認，無需回報        │
└────────────────────────────────────────┘
```

### 6.2 等待頁（客戶匯款後）

不強制輪詢——LINE push 通知就夠了。但保留「我已匯款」按鈕讓客戶手動 refresh 狀態（呼叫 `status` API）。

---

## 7. 老闆端 UI 變更

**`/admin/payments` 頁面加一個 tab**：

```
[🏦 ATM 自動對帳]  [✋ 末五碼手動對帳]  [💵 現金]
     ↑ 新增          （現有）
```

ATM tab 顯示：
- 待入帳（客戶拿到虛擬帳號、還沒匯）
- 已入帳（webhook 自動標綠 → 滾動列表）
- 逾期未付（ECPayOrder.status=EXPIRED）

**完全不用點「已收款」按鈕**，這就是 Tier S 的價值。

---

## 8. 測試策略

### 8.1 單元測試
- `generateCheckMacValue()`：用綠界官方文件的範例 input/output 驗證
- `ecpayUrlEncode()`：覆蓋 `- _ . ! * ( )` + 中文 + 空格
- `merchantTradeNo` 生成：長度 ≤20、英數字、不重複
- Webhook handler：
  - RtnCode=1 → 狀態轉換
  - RtnCode≠1 → 不動狀態
  - 重複收到同一 MerchantTradeNo → idempotent
  - CheckMacValue 錯 → 回 "0|..."
  - MerchantTradeNo 找不到 → 回 "1|OK"（避免重送）

### 8.2 整合測試（sandbox）
1. 用 `ngrok` 或 Vercel Preview URL 當 webhook URL
2. 綠界公開測試卡/帳號文件：https://developers.ecpay.com.tw/?p=2856
3. 手動跑一次完整流程：LIFF 下單 → 取虛擬帳號 → 用綠界 sandbox 的模擬入帳工具觸發 webhook → 確認 DB 狀態 + LINE push
4. 測試 webhook 重送：手動 POST 同一 payload 兩次，確認只處理一次

### 8.3 E2E（手動）驗收
- [ ] 客戶選 Tier S → 拿到虛擬帳號
- [ ] 客戶模擬匯款 → 30 秒內收到 LINE「已收款」
- [ ] 老闆同時收到 LINE「自動對帳完成」
- [ ] `/admin/payments` 自動顯示綠色已收款
- [ ] 綠界 sandbox vendor 後台能看到對應訂單

---

## 9. Rollout 分期（PR 切分）

### PR 1：Schema + ECPay 基礎 lib（無 UI）
- Prisma migration：`AWAITING_BANK`, `EXPIRED` enum、`ECPAY_ATM` method、`ECPayOrder` table
- `src/lib/ecpay/checksum.ts`（CheckMacValue + urlEncode）+ 完整測試
- `src/lib/ecpay/client.ts`（`createAtmOrder()`, `parseWebhook()`）+ mock 測試
- 環境變數：`ECPAY_MERCHANT_ID`, `ECPAY_HASH_KEY`, `ECPAY_HASH_IV`, `ECPAY_ENDPOINT`（sandbox/prod 切換）

### PR 2：create-order API
- `POST /api/payments/[bookingId]/ecpay/create-order`
- `GET /api/payments/[bookingId]/ecpay/status`
- 單元 + 整合測試（mock 綠界）
- 錯誤處理：綠界 down → fallback 訊息給客戶「服務暫時異常，請改用末五碼方式」

### PR 3：Webhook
- `POST /api/webhooks/ecpay/return`（ReturnURL，背景通知）
- `POST /api/webhooks/ecpay/client-return`（OrderResultURL，前景導回）
- Node.js runtime + formData parsing
- 驗簽 + idempotency + LINE push
- 測試：伪造綠界 payload + 正確/錯誤 CheckMacValue

### PR 4：客戶端 UI
- `/payment/[bookingId]` 加付款方式選單
- 虛擬帳號顯示頁（複製按鈕、倒數到期）
- 「我已匯款」refresh 按鈕
- 移除 hardcode，從 API 動態取

### PR 5：老闆端 UI
- `/admin/payments` 加 ATM tab
- 即時狀態顯示（SWR + 5 秒 poll，或 SSE 之後再做）
- 逾期訂單處理 UI

### PR 6：Sandbox → Production 切換
- 綠界正式帳號設定（**老闆動作**：註冊 + 提供 key）
- Vercel 環境變數更新
- 真實小額測試（自己匯 100 元測試）
- 監控前 10 筆訂單

---

## 10. 踩雷清單（從研究 + 社群血淚）

1. **`encodeURIComponent` ≠ 綠界 encode**：`- _ . ! * ( )` 處理不同。**抄官方 Node 範例的 encode 表**，或用 `node-ecpay-aio` SDK
2. **Next.js App Router 收 webhook**：綠界送 `application/x-www-form-urlencoded`，必須 `await request.formData()`，不是 `request.json()`
3. **Edge Runtime 不行**：crypto + formData 在 Edge 會壞，webhook route 加 `export const runtime = 'nodejs'`
4. **回應給綠界必須是純文字 `1|OK`**：不是 JSON、不加引號、不加 newline
5. **Idempotency 必做**：綠界會重送直到拿到 `1|OK`；DB 用 `merchantTradeNo` unique + status guard
6. **MerchantTradeNo 限制**：≤20 字元、只能英數字；UUID 不能直接用，要截取 + timestamp
7. **撥款 T+10**：老闆要心理準備，錢不是即時進戶頭
8. **個人戶 30 萬/月上限**：你們店剛好在邊緣，要在 admin dashboard 加個「本月累計」指示器
9. **綠界 sandbox 重送間隔**：失敗後 5, 10, 30, 60 秒遞增，要在 log 看得到
10. **測試卡號沒 ATM**：ATM 要用「模擬入帳」工具（綠界後台）觸發 webhook
11. **時區**：`MerchantTradeDate` 綠界要 `yyyy/MM/dd HH:mm:ss` 台灣時間，全系統已是 Asia/Taipei 沒問題
12. **IP 白名單**：綠界 webhook 來源 IP 有文件，可選擇性加驗證；但 Vercel 是 serverless IP 不固定，我們只靠 CheckMacValue 就好
13. **測試環境 vs 正式環境 endpoint 不同**：`payment-stage.ecpay.com.tw` vs `payment.ecpay.com.tw`
14. **bankAccountNumber 欄位**：Tier S 不用 Tenant 的銀行帳號（綠界代收），但 Tier A 還是要，UI 別搞混

---

## 11. 環境變數（新增）

```bash
# 綠界金流
ECPAY_MERCHANT_ID=2000132                      # Sandbox 公開測試值
ECPAY_HASH_KEY=5294y06JbISpM5x9                # Sandbox 公開測試值
ECPAY_HASH_IV=v77hoKGq4kWxNNIS                 # Sandbox 公開測試值
ECPAY_ENDPOINT=https://payment-stage.ecpay.com.tw  # 切正式改 payment.ecpay.com.tw
ECPAY_RETURN_URL=https://<prod-domain>/api/webhooks/ecpay/return
ECPAY_CLIENT_RETURN_URL=https://<prod-domain>/api/webhooks/ecpay/client-return
ECPAY_ATM_EXPIRE_STRATEGY=booking_day_open     # 虛擬帳號到預約當天營業開始（非固定天數）
ECPAY_ATM_EXPIRE_FALLBACK_DAYS=1               # 保險值：距預約 <1 天仍用此（避免 ExpireDate<now）
```

**首次 sandbox 測試**：用上面綠界官方公開的 test ID/Key，老闆零動作。

---

## 12. Success Criteria

- [ ] 客戶在 LIFF 選「系統產生專屬帳號」→ 3 秒內看到帳號 + 金額
- [ ] 客戶匯款（sandbox 模擬）→ 30 秒內收到 LINE「已收款」
- [ ] 老闆 `/admin/payments` ATM tab 自動顯示綠色入帳，零手動操作
- [ ] Webhook idempotent：同一入帳收到 3 次 = 狀態只變一次、客戶只收到一次 LINE
- [ ] 驗簽錯誤回 `0|...`、找不到訂單回 `1|OK`（避免綠界堆積重送）
- [ ] Tier A 末五碼流程完全不受影響（回歸測試通過）
- [ ] 測試覆蓋：CheckMacValue + urlEncode + create-order + webhook 四個單元、一個整合

---

## 13. 風險 / 未解

1. **綠界 sandbox 偶發 500**：只能 retry，業界常態
2. **客戶匯款但 webhook 卡在 Vercel cold start**：Vercel Fluid Compute 應該 OK，但第一筆可能慢；有重送機制，最終一致
3. **個人戶 30 萬/月上限**：接近時如何提醒？→ admin dashboard 加累計條、超過自動切 Tier A only（後期）
4. **客戶選了 Tier S 但沒匯錢**：Payment 卡在 `AWAITING_BANK` → 到期自動轉 `EXPIRED`（cron 每日檢查 `ECPayOrder.expireDate < now`）
5. **綠界 key 外洩**：僅能建單不能提款，風險有限；但仍要放 Vercel 環境變數 + 日後定期輪替
6. **退款需求**：MVP 不做，明確寫在 FAQ「退款請聯絡老闆」

---

## 14. 老闆需要做什麼（彙整給 Ryan）

| 階段 | 老闆要做的事 | 花多久 | 花錢？ |
|---|---|---|---|
| Sandbox 草稿 | 無 | 0 | 0 |
| Sandbox 帳號（想看真實 flow） | 綠界 vendor-stage 註冊 + 提供 3 個 key | 5 分鐘 | 0 |
| 正式上線 | 綠界正式帳號（個人戶） | 30 分鐘審核 1-3 天 | 0 開通費，按筆抽 |
| 上線後維護 | 每月撥款對帳（綠界後台匯出） | 5 分鐘/月 | 每筆 1% 或最低 10 元 |

---

## GSTACK REVIEW REPORT (via /autoplan, 2026-04-15)

| Review | Trigger | Runs | Status | Findings |
|--------|---------|------|--------|----------|
| CEO Review | Claude subagent (codex timeout) | 1 | **issues_open** | **USER CHALLENGE**: premise questioned |
| Design Review | auto (UI scope) | 0 | deferred | pending premise decision |
| Eng Review | Claude subagent (codex timeout) | 1 | **issues_open** | 15 findings: 2 CRITICAL, 6 HIGH, 7 MEDIUM |
| DX Review | — | 0 | skipped | no developer-facing scope |

### CEO — USER CHALLENGE (premise questioned)

> **You said**: build Tier S now (ECPay virtual account auto-reconciliation)
> **Independent CEO voice recommends**: reconsider / defer / reframe
>
> **Why** (paraphrased):
> 1. At 50-200 bookings/month with 現金 as default and Tier A handling bank transfers, Tier S adoption likely <10% (5-30 bookings/month). Time saved: 15-60 min/month for 6 PRs of engineering.
> 2. **NT$300k/month personal-seller cap = structural blocker.** Shop is already at the cap (200 × $1500 = $300k). Hitting it mid-month = ECPay rejects 建單 → customer sees error → confidence destroyed. Plan §13.3 only waves at this.
> 3. **Dismissed alternatives underexplored**:
>    - **Amount-randomizer auto-match** (1 PR, 0 fees): add NT$1-9 to each booking's amount → reconciliation becomes trivial 1-to-1 matching via bank SMS parsing. Solves 80% of Tier A pain.
>    - **LINE Pay only**: zero friction inside LIFF, 秒到, 3% (vs ECPay ATM minimum 2% on small). Better UX, worse economics.
>    - **Delay Tier S**: instrument Tier A pain for 2-4 weeks first. <30min/week → Tier S not worth it.
> 4. **6-month regret scenario**: 6 PRs shipped, <5 Tier S bookings/month, `ECPayOrder` table becomes dead code, meanwhile competitors shipped no-show protection / waitlist / SMS reminders that actually move bookings.
>
> **What we might be missing**: owner's expected growth trajectory, owner's subjective pain (maybe reconciling末五碼 is more annoying than the data suggests), strategic value of "we have gateway support" for future commercial-entity upgrade.
>
> **If we're wrong, the cost is**: 1-2 weeks shipped on Tier S that 95% of customers never use, while Tier A already solved 80% of the problem.

### Eng — technical findings (if you choose to build)

| # | Severity | Finding | Fix |
|---|---|---|---|
| F4 | 🔴 CRITICAL | Webhook idempotency guard is shallow: if duplicate arrives with different amount (ECPay bug or replay after key leak), we silently accept | Assert `rawWebhook.Amount === ecpayOrder.amount` before short-circuit; on mismatch log + alert admin, don't mark PAID |
| F9 | 🔴 CRITICAL | Hand-rolled CheckMacValue has locale-dependent sort (`localeCompare`) + encode table bugs | Use `ecpay_aio_nodejs` SDK — do NOT hand-roll |
| F2 | 🟠 HIGH | Missing indexes on `expireDate`, `paymentId` | Add `@@index([expireDate, status])`, `@@index([paymentId])` |
| F5 | 🟠 HIGH | Race: webhook arrives before create-order DB commits → "找不到訂單" swallows payment | Commit ECPayOrder row BEFORE calling ECPay; on not-found respond `0\|NotFound` (let ECPay retry) not `1\|OK` |
| F7 | 🟠 HIGH | Concurrent tabs race — two virtual accounts issued, customer pays old one | Redis lock `ecpay:create:{bookingId}` (reuse `@upstash/lock`) |
| F8 | 🟠 HIGH | ECPay API timeout leaves ECPayOrder stuck in `CREATED` forever | Explicit 8s HTTP timeout + cron sweeper moves stale CREATED → FAILED |
| F13 | 🟠 HIGH | No rollback plan | `ECPAY_ENABLED=true\|false` feature flag; 503 + UI hides when false |
| F14 | 🟠 HIGH | No observability — can't tell if webhooks are flowing | Counters + daily health cron + structured logging per webhook |
| F3 | 🟡 MEDIUM | "One booking one ECPayOrder" ambiguous with retry semantics | Partial-unique via Redis lock in create path |
| F6 | 🟡 MEDIUM | LINE push inside webhook handler → duplicate/lost | Enqueue Notification record, existing cron processes |
| F10 | 🟡 MEDIUM | Webhook forgery if key leaks | Optional ECPay IP allowlist (defense-in-depth) |
| F11 | 🟡 MEDIUM | No key rotation strategy | Dual-key window for 24h rotation |
| F12 | 🟡 MEDIUM | Admin ATM tab likely N+1 | Prisma `include` + pagination |
| F15 | 🟡 MEDIUM | NT$300k monthly cap guard not enforced in create-order | `SUM` check, return 409 at 280k |
| Tests | 🟠 HIGH | Missing test cases: amount-mismatch, create/webhook race, concurrent create, timeout, Chinese encoding, Tier A regression | Add 8+ tests per §8 revision |

### Phase execution notes
- Codex (external voice) failed to return within 5 min — retried once, killed. Tagged `[subagent-only]`.
- Design + DX phases not run (gated on premise decision).

### VERDICT: **NEEDS USER DECISION**

The plan is technically buildable. But CEO voice raises a valid premise challenge.

### ✅ DECISION (Ryan, 2026-04-15): **Option D — proceed with original plan**

- 接受 CEO 挑戰但仍要推進
- **前置條件**：開 PR1 前將 Eng 15 個問題整合進規格（完成於 §16）
- **風險自承**：若 Tier S 採用率 < 10% 或 30 萬上限觸頂，回頭評估

---

## 16. Eng 審核修正整合（D 方案前置）

### 16.1 Schema 修正（F2, F3）
加索引：`@@index([paymentId])`、`@@index([expireDate, status])`（cron 掃 EXPIRED 不走全表）。併發控制用 **Redis lock `ecpay:create:{bookingId}`**（TTL 15s），不靠 DB unique constraint。

### 16.2 SDK（F9 — CRITICAL）
**不手寫 CheckMacValue**。用 `ecpay_aio_nodejs` SDK，驗簽/encode 全部交給它。`src/lib/ecpay/` 只做薄 wrapper。

### 16.3 Create-order flow 更新（F5, F7, F8, F15）
```
1. requireBookingAuth
2. 取 Redis lock ecpay:create:{bookingId} (TTL 15s)
3. 驗 booking / Payment 狀態
4. 檢查 NT$280k 月度上限 (SUM RECEIVED ECPayOrder this month)
5. DB tx: upsert Payment + insert ECPayOrder (COMMIT 在呼叫 ECPay 前)
6. 呼叫 ECPay (HTTP timeout 8s)
7. 成功 → update; 失敗 → status=FAILED, Payment 回 PENDING
8. 釋放 lock
```
Cron sweeper：每 15 分鐘掃 `PENDING AND vAccount IS NULL AND createdAt < now-5min` → FAILED。

### 16.4 Webhook flow 更新（F4, F6）
```
1. formData → SDK 驗簽 → 失敗回 "0|CheckMacValueError"
2. 找 ECPayOrder；找不到 → "0|NotFound"（讓 ECPay retry，不是 "1|OK"）
3. 金額驗證：webhook.TradeAmt !== order.amount → log CRITICAL + alert admin + "1|OK"（不處理）
4. status===PAID → "1|OK"（idempotent）
5. RtnCode===1 → DB tx: 更新 + enqueue Notification records（不在 webhook 內推 LINE）
6. "1|OK"
```

### 16.5 Feature Flag（F13）
`ECPAY_ENABLED=true|false` → false 時 create-order 回 503、UI 隱藏 ATM 選項。

### 16.6 觀測（F14）
- `logger` 每個 webhook event（含 `merchantTradeNo`、`rtnCode`、`action`）
- 新 cron `/api/cron/daily-ecpay-health`：掃 stuck PENDING → push 老闆
- structured log 作為指標：`ecpay.webhook.{received|sigfail|notfound|amount_mismatch}`

### 16.7 N+1 修正（F12）
Admin 頁用 `include: { booking: { include: { user, service } } }` + pagination。

### 16.8 Security（F10, F11）
- `ECPAY_HASH_KEY` 只放 Vercel Sensitive env
- Prod 可選擇性加 ECPay IP allowlist（defense-in-depth）
- Key rotation 文件化，手動年度

### 16.9 測試新增
- Webhook amount-mismatch
- Webhook not-found → `0|NotFound`
- Create-order 並發 → Redis lock
- Create-order ECPay timeout
- Payment RECEIVED 時 create-order → 409
- NT$280k 上限 → 409
- **Tier A 回歸**：末五碼流程完全不受影響

### 16.10 PR 切分更新（6 → 5）
- **PR1**：SDK + Schema + `src/lib/ecpay/` wrapper + feature flag + 單元測試 ← 現在開工
- **PR2**：create-order API + Redis lock + 月度上限 + 測試
- **PR3**：webhook + amount-guard + Notification enqueue + cron sweeper + 測試
- **PR4**：客戶端付款 UI + 老闆 ATM tab
- **PR5**：Production 切換 + 觀測儀表板

---

## 15. 後續擴充

- **信用卡支付**：同一個 ECPay 帳號就能開，改 `ChoosePayment=Credit`
- **LINE Pay 作為輔助**：客戶 LIFF 內付款，3% 手續費但秒到
- **自動退款**：串 AioChargeback API
- **多商店（SaaS 化）**：每個 Tenant 存各自的 ECPay key；webhook 用 MerchantID 判斷 tenant
- **AIR(會員儲值金)**：若老闆想推會員儲值 → ECPay `PeriodAmount` 可做定期扣款
