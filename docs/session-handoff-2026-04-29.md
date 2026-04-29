# Session Handoff — 2026-04-29

> 本 session 已完成的事 + 三個拆分 session 的接手 spec

---

## ✅ 本 session 已 ship（合 main）

| PR | 內容 | Commit |
|---|---|---|
| #50 | V3.6 reports Pass 1 — daily bugs / 中文化 / DateStrip / KPI 三階 / YoY 重做 | `a428894` |
| #52 | V3.6 reports Pass 2 — 全月滑動 + calendar modal + optimistic settle + 漸變進度條 + 大字 hero | `c9a47ad` |

---

## 📊 資料匯入完成

| | 筆數 | 營收 | 來源 |
|---|---|---|---|
| 2024 | 1,216 | NT$1,346,800 | `docs/2024預約表.xlsx` (`hist-` prefix) |
| 2025 | 1,169 | NT$1,348,900 | 之前 PR #24 已匯入 (`hist-` prefix) |
| 2026 | 394 | NT$459,850 | `docs/2026預約表.xlsx`（剛匯，至 4 月） |

**YoY 圖在 monthly view** 應該已 unblock — 4 月那欄會看到 2024 / 2025 / 2026 同月對比。

---

## 🧹 測試資料清理（剛完成）

刪除了 17 筆假 booking + 配套 23 筆 notification + 15 payment + 2 個 orphan user：

- 「陳昶龍 Ryan」(`Ufb5e..`) 的 15 筆（4/27-4/30）
- 「碩展」manual- 的 2 筆（4/29 + 4/30）

「陳昶龍 Ryan」LINE user 帳號**保留**（你下次還能用同個 LINE 測試預約）。

未來測試預約建議手動在 `notes` 加 `[TEST]` 前綴（NewBookingSheet 加 checkbox 留給下個 session 做）。

---

## ❓ V3.7 plan 開放問題 — 我答覆 + 你最新回覆

### Q1. Rich Menu 連動，C1/C2/C3 是什麼意思？

我提的 3 個解讀（plan §2 Story C）：

| 代號 | 意思 |
|---|---|
| **C1** | 客戶被「對帳完成」後，下次按 LINE Rich Menu 看到「上次消費已對帳完成」訊息 |
| **C2** | 對帳完成觸發 Rich Menu 圖案切換（例如「轉帳資訊」按鈕替換成「下次預約」按鈕） |
| **C3** | 對帳完成的同時，**LINE 訊息中包含 Rich Menu shortcut 按鈕**（快速重新預約 / 留評論） |

→ **你之前說「另一個 session 已做」對帳完發 Flex Card 訊息（V3.7 §F），可能本來就解決了 C3** — 如果那個 Flex 卡裡已經有「再次預約」按鈕，C3 就完成。

**請新 session 接手前**：先去看那個 session 的 PR，confirm 訊息已含 CTA 按鈕。如果有 → 全部已完成，C 可以結案。

### Q2. 對帳完發 LINE 訊息（Flex Card）→ **已完成（你說的）**

V3.7 plan §F = 對帳 → 發 LINE 確認訊息給客戶。**你說已在另外 session 做完**，那這 Story F 可以**從 V3.7 plan 移除**。新 session 只要做剩下的 Story A/B/D/E（source badge / 末五碼整合 / 客戶頁付款歷史）。

### Q3. 老闆手建 booking 對帳時要不要 push？我建議：

**不發 push**，理由：
- 大多數老闆手建是「沒 LINE 對應」的客人（電話客 / walk-in），`lineUserId` 開頭 `manual-` 是合成的，沒人收得到訊息
- 強發會 silently fail / log error
- **例外**：如果手建時老闆**手動連結到一個真實 LINE user**（例如為「陳昶龍 Ryan」手建），這時 lineUserId 是 U 開頭真 ID，**那就應該發**

**規則建議**：「**有真 LINE userId（U 開頭）就發，否則跳過**」。簡單、無歧義。

你問的 (b) 「老闆手動處理對帳完，要確認客戶端收到通知」— 這是 admin UI 的一個 UX：
- 對帳完 daily view 顯示 ✓「LINE 已通知」/ ⊝「無 LINE，未通知」icon
- 失敗則顯示 ⚠️「通知失敗，可重試」
- 這是 V3.7 §F 的補充，建議併入

### Q4. 客戶頁顯示付款歷史 + 可編輯？

**你的提議**：客戶頁顯示「付款歷史」+ 可編輯
**我的擔憂**：可編輯 = 破壞 audit trail（末五碼歷史本來是不可變記錄）

**建議妥協**：
- 顯示完整付款歷史 ✓（金額、方式、末五碼、日期）
- **不開放普通編輯**，但提供「修正」入口 — 點某筆 → 跳出 modal 寫修正原因 → 寫進 `Payment.notes`，不改 `transferLastFive` 本體
- 這樣保留 audit trail（原 5 碼還在），但容錯（客戶輸錯了，老闆能 annotate「實際是 67890」）

如果你還是要直接編輯 → 加 `Payment.editedBy` + `editedAt` + `editReason` 欄位記錄誰改、為什麼，當作低度 audit。

### Q5. 「解除對帳」是什麼？

`DELETE /api/bookings/[id]/settle` — 把 `Booking.settledAt` 設回 null。

**用途**：
- 老闆按錯「確認」按到別筆 booking → 想撤回
- 對帳發現金額不對，要重新對

**現在已實作**（V3.6 ship 的時候做的），daily view 上沒 expose UI（隱藏功能，只 API 層）。如果要加 UI，daily view 「✓ 已對」的 row 加 hover 顯示「↶ 撤回對帳」按鈕。

**配套警告**：撤回對帳**不撤回 LINE 訊息**（LINE API 不支援撤回）— 客戶已經收到「您 NT$X 已收款」訊息，老闆得手動發更正。

→ V3.7 §F 的補充：撤回對帳時自動發**補正訊息**（「先前對帳記錄已撤銷，敬請見諒」）。

---

## 🔀 拆分 session 策略（你問的）

### 為什麼拆？

- 同一 session 開太久 cache 失效、context 膨脹
- 多 session 平行做不衝突的事 = 整體時間 ÷ N
- 不同領域用不同 session（前端 vs 後端 vs 資料庫）讓 cache 命中率最高

### 怎麼拆才不衝突？

**衝突原則**：兩個 session **不能同時改同一個檔案**，但可以改**同一個 feature 的不同檔案**。

### 建議拆成 3 個並行 session：

#### 🅰️ Session A — V3.7 對帳整合（後端為主）

**範圍**：V3.7 plan §A/B/D/E（不含 F，已別 session 做完）
- `src/lib/reports/v3.6/aggregates.ts` — daily view 加 source badge + transferLastFive
- `src/app/(admin)/reports/views/daily.tsx` — UI 顯示 source / 末五
- `src/app/api/customers/[id]/route.ts` — response 加 payments[]
- `src/app/(admin)/customers/[id]/page.tsx` — 「付款記錄」section
- `/api/bookings/[id]/settle` — 串 Payment.status RECEIVED（小改）

**衝突風險**：低（你說對帳完 LINE push 那 session 已 ship，不會再改 settle endpoint）

**onboarding**：`docs/v3.7-booking-reconciliation-flow-plan.md` + 上面 Q1-Q5 答案

#### 🅱️ Session B — Pass 3 視覺微調（前端為主）

**範圍**：未來實機看到的小毛病集合
- KPI 卡 benchmark 標籤位置 / 配色微調
- 月度 / 年度視角的視覺一致性
- 修任何 Pass 2 還沒 catch 的 UI bug
- `[TEST]` 前綴 checkbox 加進 NewBookingSheet

**衝突風險**：中（如果跟 Session A 同時改 daily.tsx 會 conflict）→ **建議 Session A 先 ship，B 再開**

#### 🅲️ Session C — V3.6 Phase H 推播啟用（runtime / cron）

**範圍**：等老闆答 plan §14.8 6 題後，啟用 retention-push cron
- `vercel.json` 加回 cron entry
- 答案寫進 `RETENTION_RULES`
- 加 admin 監控 widget 到 `/dashboard`

**衝突風險**：無（完全獨立檔案）

### 推薦執行順序

```
Now ─┬─ Session A (V3.7 後端) ──────────► merge
     │
     ├─ Session C (Phase H 啟用) ─────────► merge  (要老闆先答 6 題)
     │
     └────► A 合進 main ──► Session B (Pass 3 視覺) ─► merge
```

A + C 可並行（不同檔案）；B 等 A merge 後再開（避免 daily.tsx conflict）。

### 開新 session 時怎麼 onboard

直接給新 session 看：
1. 本檔（**這份 handoff**）
2. `docs/v3.7-booking-reconciliation-flow-plan.md`
3. `MEMORY.md` + `CLAUDE.md`

新 session 看完就上手，不用我重新解釋。

---

## 📌 還沒做的事（給未來自己）

- [ ] V3.7 plan 把 §F「LINE push」標為已完成（如果你 confirm 另一 session 已 ship）
- [ ] V3.7 plan §C 三選一決定（C1 / C2 / C3 / 其他）
- [ ] NewBookingSheet 加「[TEST] 標記為測試」checkbox
- [ ] daily view「✓ 已對」row 加 hover「↶ 撤回對帳」按鈕（解除對帳 UI）
- [ ] V3.6 Phase H 6 題（B1-B6）老闆 confirm 後啟用 retention-push cron
- [ ] 2026-05-12 自動跑 routine（已排）評估 Phase H

---

## 🎯 給接手 session 的人

**不要**：
- 動 settle endpoint 的 LINE push 邏輯（已別 session 做完）
- 重做 V3.6 daily view 大架構（Pass 1 + Pass 2 已穩定）

**可以**：
- 在 daily.tsx 加新 section（例如 source badge）
- 改 aggregates.ts 加新欄位
- 加新 component（例如 `payment-history-section.tsx`）
- 動客戶詳細頁 / V3.7 plan 列出的範圍

**請先讀**：
- 本 handoff
- V3.7 plan
- 看最新 main `git log` 確認沒衝突
