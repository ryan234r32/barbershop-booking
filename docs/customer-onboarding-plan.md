# 顧客導入與系統切換 Plan

> **建立日期：** 2026-05-06
> **觸發討論：** session `docs/session-log-and-helper-2026-05-06`
> **目標：** 從 Ryan 測試帳號切換到老闆正式 LINE 官方帳號上線時，讓**新加入用戶 + 既有 LINE 好友**都能順暢補登資料、學會使用新系統、找到關鍵功能（特別是取消/改期）。

---

## 1. 背景與動機

### 1.1 切換情境
- 目前系統綁在 Ryan 個人測試 LINE 帳號開發中
- 上線當天會把整個 codebase「穿」到老闆既有的 LINE 官方帳號（已有數百名好友）
- 既有好友習慣用「打字訊息+老闆口頭回覆」預約，從沒用過 LIFF

### 1.2 三大顧慮（Ryan 提出）
1. **資料補登時機** — 既有客戶沒填過手機/性別/生日，何時介入收集才不勸退
2. **舊用戶適應問題** — 公告就算發了，他們未必知道從何下手
3. **介面不直覺** — 例如「取消預約」藏在「我的預約」裡，沒人會自己摸出來

### 1.3 Ryan 的初步直覺（已採納為設計原則）
- 在「按確認預約」那一刻才擋（沉沒成本最大化，符合 progressive disclosure 業界標準）
- 性別用「生理男/生理女」+ 第三選項以兼顧兩性平等
- Rich Menu 從 4 格擴充 6 格

---

## 2. 設計原則（貫穿所有 phase）

| 原則 | 含義 |
|---|---|
| **Just-in-time form** | 不在用戶剛進來就要資料；要在沉沒成本最高、放棄率最低的瞬間擋 |
| **三層引導** | 廣播（被動接觸）→ Intro modal（首次主動探索）→ FAB（隨時救援） |
| **冗餘容錯不是冗餘** | Rich Menu 多放「取消/改期」入口，雖然功能 `/my-bookings` 也有，但雙入口降低學習成本 |
| **品牌一致** | 所有新元件對齊 `docs/品牌設計規範.md`（暖乳白 / 深森林綠 / 線性圖示 / 大呼吸感） |
| **既有客戶不騷擾** | 已填過手機+真名+生日的客戶，絕不再彈表單 |

---

## 3. Phase 與分工

### Phase 0：Profile Gate + 性別欄位 ✅ 已完成（2026-05-06）
**修改範圍：**
- `src/lib/utils/validation.ts` — `createBookingSchema` 加 `gender` enum（MALE/FEMALE/OTHER/PREFER_NOT_TO_SAY）
- `src/app/api/bookings/route.ts` — POST 時把 gender 寫入 user profile
- `src/components/liff/booking/user-info-sheet.tsx` — 生日上方加 3 格 segmented control（生理男/生理女/略）
- `src/app/(liff)/booking/page.tsx` — userInfo state + handleSubmit 帶 gender 進 API body

**驗收：**
- [x] 第一次預約客戶按「確認預約」→ 跳 sheet → 必填手機+真名+生日，性別選填
- [x] 已填過資料的回頭客直接送出，不跳 sheet
- [x] preflight (typecheck + lint + 1210 tests) 全綠

---

### Phase 1：LIFF 首次進入 Intro Modal ✅ 已完成
**目的：** 解決顧慮 #2 + #3 — 用戶第一次進 LIFF 任何頁面時，跳 3 步教學卡。

**檔案：** `src/components/liff/intro-modal.tsx`（新增） + `src/app/(liff)/client-providers.tsx`（掛載）

**內容：**
- Step 1（WELCOME）— 「歡迎使用新版預約系統，30 秒帶你逛一圈」
- Step 2（STEP 01）— 「想取消或改期？點下方選單『我的預約』」
- Step 3（STEP 02）— 「找不到功能？右下角的『？』按鈕」（呼應 Phase 2 的 FAB）

**機制：**
- localStorage `liff-intro-seen-v1` = "1" 後永不再彈
- 略過按鈕 + 進度小圓點 + 下一步/開始使用 CTA
- 失敗開放：localStorage 被禁用（隱私模式）→ 不彈，不報錯

**驗收：**
- [x] 第一次進 LIFF 任何頁面 → 看到 modal
- [x] 點略過或走完三步 → localStorage 寫入 → 重整不再彈
- [x] 視覺對齊品牌規範（#FFF8F1 底、深森林綠 CTA、線性圖示、無陰影）

**Owner：** Claude（程式）

---

### Phase 2：HelpFab + FAQ 半屏 ✅ 已完成（文案可再替換）
**目的：** 解決顧慮 #3 的長尾 — Intro modal 看過就忘，但浮動 ? 永遠在那邊救援。

**檔案：** `src/components/liff/help-fab.tsx`（新增） + 掛在 `client-providers.tsx`

**位置：** 每個 LIFF 頁面右下角 fixed `bottom-20 right-4`（避開 booking page 的 sticky bottom bar）

**FAQ 內容（待 Ryan 提供文案，先用合理預設）：**
1. 怎麼取消預約？
2. 怎麼改期？
3. 沒收到 LINE 提醒訊息？
4. 預約後要怎麼匯款？
5. 違規 3 次會怎樣？
6. 預約失敗怎麼辦？

**機制：**
- 點 ? → 半屏 BottomSheet 滑出 → 手風琴展開每題答案
- 永遠可見（不像 intro modal 看過就消失）

**驗收：**
- [x] FAB 在所有 LIFF 頁可見、不擋按鈕
- [x] 點開 → FAQ 列表，可手風琴展開
- [x] 視覺對齊品牌規範

**Owner：** Claude（框架）+ Ryan（文案）

---

### Phase 3：Rich Menu 6 格改版 🔄 圖 + 腳本完成，等正式上線
**目的：** 解決顧慮 #3 的根因 — 直接讓「取消/改期」變成 Rich Menu 一級入口。

**6 格佈局：**
```
┌──────────┬──────────┬──────────┐
│ 立即預約  │ 聯絡電話  │ 我的預約  │
├──────────┼──────────┼──────────┤
│ 服務項目  │ 取消／改期│ 匯款資訊  │
└──────────┴──────────┴──────────┘
```

> 最新視覺方向：上排全深森林綠 `#003D2B`，下排全暖乳白 `#FFF8F1`。`scripts/upload-rich-menu.ts` 預設對應此最終 6 格順序（`--layout handoff6`）：立即預約 / 聯絡電話 / 我的預約 / 服務項目 / 取消／改期 / 匯款資訊。若最終圖片回到舊 plan 順序，可改用 `--layout plan6` dry-run 檢查。

**Sub-tasks：**

| # | 動作 | Owner | 狀態 |
|---|---|---|---|
| 3.1 | 用品牌對齊 prompt 在 GPT 生 2500×1686 PNG | Ryan | ✅ `docs/rich-menu/rich-menu.png` |
| 3.2 | LINE Messaging API 上傳 Rich Menu image + 設定 area mapping | Codex | ✅ 腳本完成，等正式執行 |
| 3.3 | 「取消/改期」按鈕 deep link 路由 → `/my-bookings` | Codex | ✅ 腳本完成 |
| 3.4 | 「聯絡電話」→ `tel:` URI；若 tenant 無電話則 fallback message `電話` | Codex | ✅ 腳本完成 |

**上線指令：**
```bash
# 先 dry-run：驗證圖片尺寸、大小、area mapping，不會改 LINE
npm run rich-menu:upload -- \
  --image docs/rich-menu/rich-menu.png

# 確認無誤後發布：建立 Rich Menu、上傳圖片、設為 default
npm run rich-menu:upload -- \
  --image docs/rich-menu/rich-menu.png \
  --commit
```

**Area action：**
- 立即預約 → `https://liff.line.me/{liffId}/booking`
- 聯絡電話 → `tel:{tenant.phone}`；若 tenant 無電話則發訊息 `電話`
- 我的預約 → `https://liff.line.me/{liffId}/my-bookings`
- 服務項目 → message `服務`
- 取消／改期 → `https://liff.line.me/{liffId}/my-bookings`
- 匯款資訊 → message `匯款`

> 注意：正式上線請使用 `docs/rich-menu/rich-menu.png`，並在 dry-run 確認座標後才加 `--commit`。`docs/rich-menu/large-*` / `small-*` 是同一版 6 格圖的預覽輸出。

**驗收：**
- [ ] LINE 主畫面 Rich Menu 顯示 6 格
- [ ] 點「取消/改期」→ 進 LIFF `/my-bookings`，最近一筆預約預設展開取消按鈕
- [ ] 點「聯絡電話」→ 直接撥電話或 fallback 到客服訊息

**Owner：** Ryan（圖）+ Claude（程式）

---

### Phase 4：切換日 Flex Carousel 廣播 ✅ 已完成
**目的：** 解決顧慮 #2 — 系統穿到老闆帳號當天，主動推 Flex Carousel 給所有既有好友。

**檔案：** `src/app/api/admin/launch-carousel/route.ts` + `src/lib/line/messages.ts`

**Flex Carousel 內容（4 卡）：**
1. **歡迎使用新系統** — 簡介升級了什麼 + 行動 CTA「開始預約」
2. **想線上預約？** — 圖示 + 一句話 + 按鈕「立即預約」（LIFF deep link）
3. **想取消或改期？** — 圖示 + 一句話 + 按鈕「我的預約」（LIFF deep link）
4. **找不到功能？** — 提示右下角 ? 按鈕，並附上店家聯絡電話

**執行：**
- Ryan 上線當天以 admin token 呼叫 `POST /api/admin/launch-carousel`
- 先送 `{"dryRun": true}` 看會推播幾人，再正式送 `{}`
- 使用 per-user `pushMessage`，個別失敗記 log，不使用 LINE broadcast endpoint

**驗收：**
- [x] Carousel builder 已完成
- [x] 每張卡按鈕能跳回對應 LIFF 頁面
- [x] 廣播 endpoint 回傳 sent / failed / total

**Owner：** Claude（腳本+文案）+ Ryan（執行時機 + 文案最終確認）

---

### Phase 5（建議補做，Ryan 漏提的）：Follow Webhook 自動歡迎 ✅ 已存在
**目的：** Phase 4 解決既有好友，但**未來新加入的好友**也需要歡迎流程。

**檔案：** `src/app/api/webhook/route.ts`（既有 `follow` event handler）

**機制：**
- 用戶加好友 → LINE 觸發 webhook `follow` event → 系統自動推一張歡迎 Flex Message
- 內容：店家簡介 + 「立即預約」按鈕（LIFF deep link）

**為何單獨拉 phase：** 這是「未來新好友」的問題，跟切換日不衝突。可在 Phase 4 之後或同步做。

**Owner：** Claude，視 Ryan 是否要做

**Audit 結論：** webhook 路徑不是 `src/app/api/line/webhook/route.ts`；實際 handler 在 `src/app/api/webhook/route.ts`，已支援 `follow` event（抓 profile、upsert user、推歡迎文字與 Flex 卡片）。

---

### Phase 6（建議補做）：Admin 手動補登入口 ✅ 已完成
**目的：** 對於完全不會用手機的長輩客，老闆現場剪髮時可在 admin 後台直接幫他補登資料。

**檔案：** `src/components/admin/customers/basic-profile-editor.tsx`、`src/app/(admin)/customers/page.tsx`、`src/app/(admin)/customers/[id]/page.tsx`、`src/components/admin/new-booking-sheet.tsx`

**機制：**
- 既有 `BasicProfileEditor` 已可編輯 realName / phone / gender / birthday
- 客戶列表新增「只看缺資料的顧客」篩選 + 缺欄位 badge
- 客戶詳情頁新增完整度 banner，點擊可進編輯
- admin 新增預約成功後，若該客缺 phone/gender/birthday，跳「順便補登」prompt

**Owner：** Codex / Claude 已完成

---

## 4. 執行順序（依阻塞關係）

```
Phase 0 ✅ → Phase 1 → Phase 2 (框架) → 等 Ryan 給 FAQ 文案 → Phase 2 (補文案)
                ↓
       Ryan 並行生 Rich Menu 圖
                ↓
       Phase 3 (Claude 上傳+路由) → Phase 4 (廣播腳本) → 上線當天 Ryan 執行
                                          ↓
                              Phase 5 (follow webhook，可同步)
                              Phase 6 (admin 補登 audit)
```

---

## 5. 待 Ryan 回覆的決策

| # | 問題 | 影響 |
|---|---|---|
| Q1 | FAQ 6 題的文案要怎麼寫？（先用預設） | Phase 2 完整度 |
| Q2 | Phase 5 follow webhook 要不要做？ | 未來新好友體驗 |
| Q3 | Phase 6 admin 補登 — 要不要審核既有 UI？ | 長輩客回流 |
| Q4 | 切換日什麼時候？需不需要先 dry-run 廣播給 Ryan 自己看 carousel 效果？ | Phase 4 上線時機 |

---

## 6. 開放風險

| 風險 | 緩解 |
|---|---|
| GPT 生 Rich Menu 中文字跑掉 | Prompt 末段已寫死中文字串；若仍跑掉 → fallback 用 Figma/Canva 拼字疊上 |
| LINE 廣播觸及好友太多 → 帳號被風控 | 使用 multicast 而非 broadcast，分批 500 人/次 |
| 既有客戶看到 modal 嫌煩 | 已加略過按鈕 + localStorage gate，看過不再彈 |
| LIFF localStorage 被清（用戶手動清快取） | 重新看一次 modal — 影響小，可接受 |

---

## 7. 變更記錄

| 日期 | 變更 |
|---|---|
| 2026-05-06 | 初版建立。Phase 0 完成。Phase 1 (intro modal) 程式已寫，待 Phase 2 + preflight |
