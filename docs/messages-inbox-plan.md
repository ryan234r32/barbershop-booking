# 📩 LINE 訊息收件匣 — PWA 整合 Plan (v2)

**目標：管理員不用開 LINE OA App，所有顧客訊息都在 PWA 後台收發。**

建立日期：2026-04-14
狀態：**v2 鎖定 — 實作中**
審核：`/plan-eng-review` ✅ CLEARED (10 issues resolved)

---

## 0. Context

### 現況
- 顧客透過 LINE 傳訊息 → `/api/webhook/route.ts` 接收 → 關鍵字自動回覆 → 訊息**用完即丟**（沒存 DB）
- 管理員要看顧客傳什麼訊息 → 只能開 LINE Official Account App 手機查看
- Tab bar：日曆 / 報表 / 更多

### 目標
- 所有顧客傳進來的訊息（文字、貼圖、圖片等）都**存進 DB**
- PWA 後台加一個「訊息」分頁，列出對話、已讀/未讀、可直接回覆
- 新訊息進來 → Web Push 到管理員手機（跟新預約通知同一機制）

---

## 1. 最終使用者體驗（MVP）

```
┌─────────────────────────────────────┐
│  1008 Hair Studio 後台              │
├─────────────────────────────────────┤
│                                      │
│  💬 訊息        未讀 3               │
│  ──────────────────────              │
│  王小明       今天可以取消嗎?   2 分鐘 │
│  🔴           [已讀]                 │
│  ──────────────────────              │
│  陳美麗       有停車位嗎?      10 分鐘 │
│  🔴                                  │
│  ──────────────────────              │
│  張大強       [貼圖]            1 小時 │
│  🔴                                  │
│  ──────────────────────              │
│  李先生       謝謝              昨天   │
│                                      │
├─────────────────────────────────────┤
│  📅 日曆  💬 訊息  📊 報表  ⋯ 更多    │
└─────────────────────────────────────┘
```

點進某對話 → 看完整訊息歷史 → 底部輸入框回覆 → 後端透過 LINE API `pushMessage` 送出。

---

## 2. 技術設計

### 2.1 Prisma Schema（新增）

```prisma
model Message {
  id              String   @id @default(uuid())
  tenantId        String   @map("tenant_id")
  userId          String?  @map("user_id")              // 對應 User（null 表示未註冊顧客）
  lineUserId      String   @map("line_user_id")
  lineMessageId   String?  @map("line_message_id")      // LINE event.message.id，去重用
  clientMessageId String?  @map("client_message_id")    // 前端產生 UUID，admin 重送去重
  direction       MessageDirection
  type            MessageType
  content         String?  @db.Text                     // 文字內容或 altText
  // raw: LINE 原始 payload — 僅供 debug/貼圖資料讀取，"禁止 JSON query"
  // 以後要查內容請加專屬欄位，不要 where raw->>'xxx'
  raw             Json?
  isRead          Boolean  @default(false) @map("is_read")
  createdAt       DateTime @default(now()) @map("created_at")

  tenant Tenant @relation(fields: [tenantId], references: [id])
  user   User?  @relation(fields: [userId], references: [id])

  @@unique([lineUserId, lineMessageId])                 // 重送去重
  @@unique([tenantId, clientMessageId])                 // admin idempotency
  @@index([tenantId, lineUserId, createdAt(sort: Desc)])
  @@index([tenantId, isRead])
  @@map("messages")
}

enum MessageDirection {
  INBOUND
  OUTBOUND
}

enum MessageType {
  TEXT
  STICKER
  IMAGE
  VIDEO
  AUDIO
  LOCATION
  FILE
  OTHER
}
```

User + Tenant 各加 `messages Message[]` relation。

### 2.2 Webhook 改動

在 [src/app/api/webhook/route.ts](../src/app/api/webhook/route.ts) 的 `message` event handler：
1. **Fire-and-forget 存入 DB**（INBOUND）— **不 await**，不阻塞 LINE 1s timeout
2. 自動回覆送出後 → **也 fire-and-forget 存 OUTBOUND**
3. 新訊息進來 → 觸發 Web Push 通知管理員（未讀數 +1）

實作 pattern：
```ts
prisma.message.create({ data: {...} }).catch(err =>
  logger.error("Failed to persist inbound message", err, "webhook")
);
```

LINE webhook 重送時，靠 `@@unique([lineUserId, lineMessageId])` 自然去重（`create` 失敗 catch 掉即可）。

### 2.3 新增 API Routes

| Method | Path | 用途 |
|---|---|---|
| GET | `/api/admin/messages` | 列對話清單（按 lineUserId 分組，含 `totalUnread` 全域未讀數） |
| GET | `/api/admin/messages/[lineUserId]` | 取特定顧客完整對話歷史（分頁） |
| POST | `/api/admin/messages/[lineUserId]/reply` | 管理員回覆 → LINE pushMessage + 存 OUTBOUND |
| PATCH | `/api/admin/messages/[lineUserId]/read` | 標記整串為已讀 |

**Security requirements：**
- 全部 `getAdminFromCookie` 保護
- **POST /reply 跨 tenant guard**（CRITICAL）：送訊息前必須 `prisma.user.findFirst({ where: { lineUserId, tenantId: admin.tenantId }})`，不是本租戶的顧客 → 403
- **Idempotency**：POST /reply 接受前端傳的 `clientMessageId` (UUID)，後端若發現 DB 已有同 `clientMessageId` 的 OUTBOUND → 直接回原結果不重送
- Reply 失敗（LINE API 500）→ 不寫 DB、回 500，前端顯示紅色 toast

**移除：** 原本的 `GET /unread-count` 併入 list response 的 `totalUnread` 欄位（DRY）。

### 2.4 新增 UI

- [src/app/(admin)/messages/page.tsx](../src/app/(admin)/messages/page.tsx) — 對話清單
- [src/app/(admin)/messages/[lineUserId]/page.tsx](../src/app/(admin)/messages/[lineUserId]/page.tsx) — 對話詳情 + 回覆輸入框
- [src/components/admin/tab-bar.tsx](../src/components/admin/tab-bar.tsx) — 加「訊息」tab，含未讀紅點

設計風格延續現有植物系極簡：off-white 底、卡片、軟陰影。訊息泡泡：顧客左邊淺灰、管理員右邊品牌綠。

**資料同步策略：**
- SWR `revalidateOnFocus: true`（回到分頁自動刷）
- Web Push 進來 → `mutate()` 觸發重刷
- **不做** 15 秒固定 poll（省電 + 省 Vercel 調用數）

### 2.5 Web Push 整合（Step 2 的延伸）

Web Push 完成後，新訊息事件也觸發推播：
```
sendWebPushToAdmin(tenantId, {
  title: `${user.displayName} 傳來訊息`,
  body: truncate(text, 60),
  url: `/messages/${lineUserId}`,
  tag: `message-${lineUserId}`, // 同一人多則訊息會合併
});
```

---

## 3. 實作拆解（建議 commit 順序）

1. **Schema + Migration**（15 min）
   - 加 `Message` model、enums、relations
   - `npx prisma db push` 套用到 Supabase
   - 跑 `npm run db:generate` 重生 client

2. **Webhook 存訊息**（30 min）
   - 在 webhook 裡寫 INBOUND + OUTBOUND
   - 失敗用 try/catch 吞錯
   - 加 vitest 測試：收到一則文字訊息後，DB 多一筆 INBOUND

3. **Admin API**（45 min）
   - 5 個 route，每個配 1 個 integration test

4. **Admin UI**（60 min）
   - 對話清單、詳情、回覆、tab bar、未讀紅點
   - useSWR 每 15 秒 revalidate（或搭 Web Push 推）

5. **Web Push 串接**（20 min）
   - 新訊息 → 送 Web Push

6. **文件更新**（10 min）
   - CLAUDE.md 加 Message model 說明

**總工時預估：~3 小時（CC 時間，人類團隊 3-5 天）**

---

## 4. 範圍界定（不做的事）

| 不做 | 為什麼 |
|---|---|
| 圖片/貼圖全文搜尋 | MVP 用不到 |
| 顧客端的對話視圖 | 顧客本來就在 LINE App，不需要 |
| AI 智慧回覆建議 | V2 再考慮 |
| 多管理員訊息分派 | 你目前單人店 |
| 訊息歷史匯出 | V2 再做 |
| 已讀回條（讓顧客看到你已讀） | LINE OA 的已讀機制走自己的，不干擾 |

---

## 5. Edge Cases / 風險

1. **Webhook 重送**：LINE 可能同一則訊息送兩次。用 `messageId`（LINE event 自帶）去重，schema 加 `@@unique([lineUserId, lineMessageId])`。
2. **訊息太長**：LINE 單則最多 5000 字。DB 用 `@db.Text` 處理。
3. **貼圖/圖片**：先只存 metadata（`packageId`, `stickerId` 或 `contentProvider.originalContentUrl`），不下載二進位。UI 顯示「[貼圖]」或縮圖 + 點擊連原圖。
4. **未註冊顧客**：`userId` 可為 `null`（例如有人剛加好友還沒開過 LIFF），只有 `lineUserId`。UI 顯示 `LINE User (末四碼)`。
5. **OUTBOUND 推播失敗**：回覆送不出去（網路錯、配額滿）→ 不存 DB、回 500 給前端，讓使用者可重試。
6. **跨 tenantId 隔離**：所有 query 都強制帶 `tenantId`。

---

## 6. 驗收標準（v2 鎖定）

**功能（MVP）**
- [ ] 顧客傳文字 → DB 多一筆 INBOUND
- [ ] 顧客傳貼圖 → DB 多一筆 STICKER type
- [ ] Webhook 關鍵字自動回覆 → DB 多一筆 OUTBOUND
- [ ] 管理員後台能看到所有未讀
- [ ] 點進對話 → 看到完整歷史、依時序排序
- [ ] 管理員輸入回覆 → 顧客 LINE 收到、DB 新增 OUTBOUND
- [ ] 新訊息進來 → 管理員手機 Web Push 彈窗
- [ ] Quick Reply 模板（4 則預設）
- [ ] 紅點 `1-9` 顯示數字、`≥10` 顯示 `9+`

**安全 & 穩定性（CRITICAL）**
- [ ] 所有 API 都過 `getAdminFromCookie`
- [ ] **POST /reply 跨 tenant guard**（tenant A 的 admin 無法送到 tenant B 顧客）
- [ ] **Idempotency**：admin 重送同 `clientMessageId` → 顧客只收到一則
- [ ] Webhook 存 DB fire-and-forget，DB 失敗不阻塞 webhook 回應
- [ ] LINE 重送同 `lineMessageId` → DB 不重複寫
- [ ] Reply 失敗 → 前端紅色 toast、DB 不寫入

**測試（18 paths）**
- [ ] Webhook: 文字訊息 → DB INBOUND
- [ ] Webhook: 貼圖 → DB STICKER type
- [ ] Webhook: 重送 messageId → 去重不報錯
- [ ] Webhook: DB 寫入失敗 → webhook 仍回 200
- [ ] Webhook: 自動回覆送出 → DB OUTBOUND
- [ ] API: list 返回正確（含 totalUnread）
- [ ] API: list **跨 tenant 隔離** 🔴 CRITICAL
- [ ] API: list 空 → 200 + []
- [ ] API: detail 返回完整對話時序
- [ ] API: detail 不存在 lineUserId → 200 + []
- [ ] API: reply 成功 → pushMessage + DB OUTBOUND
- [ ] API: reply LINE 失敗 → 500 + DB 不寫
- [ ] API: reply **跨 tenant** → 403 🔴 CRITICAL
- [ ] API: reply 重複 clientMessageId → 回原結果
- [ ] API: read 標記整串為已讀
- [ ] UI: 紅點即時更新（Web Push 整合）
- [ ] UI: 收送訊息 E2E
- [ ] UI: 離線送訊息 → toast + 重試

**最終**
- [ ] `npm run build` ✅
- [ ] `npm run test` 228/228 ✅
- [ ] `npm run lint` 0 errors ✅

---

## 7. 優先順序 vs 其他待辦

目前 /review + /cso 找出的 P0 待辦：
1. ✅ JWT fallback secret — **已修**
2. ✅ Payment IDOR — **已修**
3. ⏸️ Web Push wire up（Step 2，等這份 plan 確認）
4. ⏸️ 訊息 inbox（本 plan）
5. ⏸️ npm audit / rate limit（Step 3+）

**建議實作順序：Web Push 先做完（Step 2 原計畫）→ 接著做訊息 inbox（本 plan）**。這樣 Web Push 先 wire 好，訊息 inbox 直接重用，少一次整合。

---

## 8. 設計決策（已確認 2026-04-14）

- ✅ **訊息泡泡配色**：完全沿用植物系色票
  - 顧客訊息：左側、淺 sand 背景（`var(--color-surface)`）、深綠文字
  - 管理員訊息：右側、品牌綠背景（`var(--color-brand)`）、白色文字
- ✅ **Quick Reply 模板**：內建常用回覆，一鍵發送
  - MVP 模板：「收到，稍後回覆」「感謝預約」「已為您保留時段」「請撥打電話 02-xxxx」
  - 存在 Tenant 的一個 `quickReplies` JSON 欄位（admin 可編輯）
- ✅ **訊息保留期限**：**永久**（Supabase Postgres 儲存成本低，歷史資料對客戶分析有用）
- ✅ **未讀紅點顯示**：`>0` 顯示數字，**`>9` 顯示 `9+`**

---

## 9. 延後事項（TODOS）

這些確認不在本 plan 內，但 eng review 指出需要記錄：

- **LINE 配額監控 UI**：後台顯示每月剩餘 pushMessage 額度（500/月免費）。V2 做。
- **訊息歸檔策略**：6 個月後若訊息量 >5000 筆，評估歸檔 1 年以上資料到冷表。
- **LINE Postback event 支援**：目前 Flex 卡沒用 postback，未來若加按鈕互動要補 MessageType。

---

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | Skipped (內部工具、無產品方向決策) |
| Codex Review | `/codex review` | Independent 2nd opinion | 0 | — | Skipped (context budget) |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | ✅ CLEARED | 10 issues, 2 critical — all resolved in v2 |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | — | Skipped (沿用現有設計系統) |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | N/A (內部工具) |

**UNRESOLVED:** 0

**VERDICT:** ENG CLEARED — ready to implement ✅
