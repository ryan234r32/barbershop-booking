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

## 2.5 顧客引導策略（研究後收斂版）

### 2.5.1 核心判斷
不要做「一次講完所有功能」的新手教學。預約客戶不是來學系統的，是來完成一件事：**約到時間**。引導應該跟著任務發生：

1. 在 LINE 聊天室用 Rich Menu 給「下一步入口」
2. 在 LIFF 預約流程中用每一步頁面標題、摘要、提醒文案給「當下需要知道的資訊」
3. 在確認預約前才要求補登資料
4. 預約成功後用 LINE Flex message 把付款 / 我的預約 / 改期取消帶回同一個自助流程

### 2.5.2 Rich Menu 應該怎麼教
Rich Menu 不要只當六個按鈕；它要被設計成「新系統操作地圖」。

| Rich Menu | 教學方式 | 使用情境 |
|---|---|---|
| 立即預約 | 直接進 LIFF `/booking`；切換日廣播第一張卡也放同一個 CTA | 新客與舊客都從這裡開始 |
| 我的預約 | 直接進 `/my-bookings`；IntroModal 特別提醒「取消 / 改期都在這裡」 | 查詢、取消、改期、確認付款狀態 |
| 取消／改期 | 也是進 `/my-bookings`，但 Rich Menu 獨立放一格 | 降低「取消藏在哪」的學習成本 |
| 匯款資訊 | 發 message `匯款`，讓 webhook 回銀行帳號與待付金額 Flex | 老客以前會傳訊息問帳號，現在讓他按一格 |
| 服務項目 | 發 message `服務`，讓 webhook 回價目 / 服務 carousel | 先看價格再預約 |
| 聯絡電話 | `tel:` action；保留人工出口 | 長輩、當天取消、特殊髮況 |

重點：Rich Menu 的每一格都要能「直接完成下一步」，不要只是教學文字。教學文字放在切換日 Flex Carousel、首次進入 IntroModal、FAQ 裡。

### 2.5.3 預約流程每一步要呈現什麼資訊
預約流程要像一個短 wizard，而不是一個表單。每一步只給當下決策需要的資訊。

| 步驟 | 頁面要呈現 | 不要呈現 |
|---|---|---|
| 選服務 | 服務名稱、價格區間、預估時間、是否需現場評估 | 不要要求先填手機 |
| 選日期 | 可預約日期、休假 / 滿檔狀態、最多可約幾天後 | 不要顯示過多內部排班資訊 |
| 選時段 | 可點時段、不可點原因（已滿 / 休息 / 已過） | 不要讓使用者點了才說不能約 |
| 取消政策 | 24 小時前可線上取消 / 當天請電話聯絡 / no-show 規則 | 不要放長篇法律條文 |
| 確認預約 | 服務 + 日期 + 時段 + 金額摘要；按下確認時若缺資料才補登 | 不要在前面打斷流程 |
| 補登資料 | 真名、手機、生日必填；性別選填；說明用途「預約聯絡 / 生日優惠」 | 不要包裝成會員註冊，不要要密碼 |
| 預約成功 | 成功狀態、下一步付款、我的預約入口、改期取消入口 | 不要只顯示「成功」就結束 |
| 付款 / 匯款 | 銀行、帳號、金額、複製帳號、完成匯款後輸入後五碼 | 不要要求客人自己回頭找匯款資訊 |
| 結尾 | LINE 確認訊息 + 我的預約入口；提醒到店時間 | 不要讓客人不知道後續在哪查 |

### 2.5.4 舊習慣轉換：從「傳訊息給老闆」到「線上預約」
轉換期不要期待客人一次改習慣。要讓舊行為也能被系統接住，再慢慢導向線上化。

**第一層：Rich Menu 常駐入口**
- 最常用的動作放在第一層，讓客人不必打字問老闆
- 「取消／改期」獨立一格，降低舊客焦慮

**第二層：關鍵字 fallback**
- 客人仍然傳「我要預約」→ webhook 回「點這裡線上預約」
- 客人傳「取消 / 改時間」→ webhook 回「我的預約」Flex
- 客人傳「匯款 / 帳號」→ webhook 回匯款 Flex

**第三層：切換日廣播**
- 不發純公告；發 Flex Carousel
- 每張卡一個任務：「要預約」「要取消改期」「要匯款」「找不到怎麼辦」
- 每張卡都放按鈕，不讓客人自己去找

**第四層：人工出口保留**
- 對於長輩、當天取消、特殊服務諮詢，保留「聯絡電話」
- 但人工出口不是主要入口；主要入口仍是 Rich Menu 的線上流程

### 2.5.5 顧客資訊補登具體方案
顧客資訊補登分成三條路徑，不是只靠一個表單。

#### A. 新客 / 未填資料客：在確認預約時補登
觸發點：
- 客人完成選服務、選日期、選時段、讀取消政策
- 點「確認預約」
- 系統檢查 `phone + realName + birthday`
- 缺任一欄位 → 彈出補登 sheet，填完後繼續送出預約

欄位策略：
- 必填：真名、手機、生日
- 選填：性別（生理男 / 生理女 / 略）
- 文案要說用途：手機用於預約聯絡，生日用於生日優惠，不要說「請註冊會員」

為什麼放在這裡：
- 客人已經投入時間，願意完成最後一步
- 不會在一進來就嚇跑舊客
- 手機能保證預約聯絡與老闆現場辨識

#### B. 舊客 / 長輩客：admin 後台補登
觸發點：
- 老闆現場服務時打開顧客詳情
- 客戶列表能篩「只看缺資料」
- 顧客詳情 banner 顯示缺哪些欄位
- admin 建預約成功後，若該客缺資料，跳「順便補登？」提示

執行方式：
- 老闆問一句：「我幫你補一下手機跟生日，之後預約跟生日優惠比較方便」
- 在 admin 客戶詳情頁補真名 / 手機 / 生日 / 性別
- 不強迫每個人當場補完，先補手機，生日其次，性別最後

#### C. 切換日舊好友：廣播引導但不強迫
觸發點：
- 系統切換當天推 Flex Carousel
- 引導「以後請從下方選單預約」
- 提醒下次預約時可能需要補資料

不建議：
- 不建議切換日直接叫所有舊客先填資料
- 不建議在 LIFF 首頁一進來就擋 onboarding 表單
- 不建議把補登包裝成會員註冊

### 2.5.6 成效判斷指標
切換後要看四個數字：

| 指標 | 目的 |
|---|---|
| Rich Menu 點擊後進入 `/booking` 的比例 | 判斷 Rich Menu 是否讓人知道怎麼開始 |
| 開始預約 → 成功預約轉換率 | 判斷流程中是否有卡點 |
| 確認預約 → 補登完成率 | 判斷資料補登是否太硬 |
| 客人傳「預約 / 改期 / 匯款」文字的數量 | 判斷舊習慣是否逐漸被 Rich Menu 取代 |

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
│ 立即預約  │ 取消／改期│ 我的預約  │
├──────────┼──────────┼──────────┤
│ 服務項目  │ 聯絡店家  │ 匯款資訊  │
└──────────┴──────────┴──────────┘
```

> 最新實際圖片順序：立即預約 / 取消／改期 / 我的預約 / 服務項目 / 聯絡店家 / 匯款資訊。`scripts/upload-rich-menu.ts` 預設對應此圖片順序（`--layout image6`）。若之後圖片改回原本規劃，可改用 `--layout handoff6` 或 `--layout plan6` dry-run 檢查。

**Sub-tasks：**

| # | 動作 | Owner | 狀態 |
|---|---|---|---|
| 3.1 | 用品牌對齊 prompt 在 GPT 生圖並轉成 LINE 規格 | Ryan + Codex | ✅ `docs/rich-menu/rich-menu.jpg` |
| 3.2 | LINE Messaging API 上傳 Rich Menu image + 設定 area mapping | Codex | ✅ 腳本完成，等正式執行 |
| 3.3 | 「取消/改期」按鈕 deep link 路由 → `/my-bookings` | Codex | ✅ 腳本完成 |
| 3.4 | 「聯絡店家」→ `tel:` URI；若 tenant 無電話則 fallback message `電話` | Codex | ✅ 腳本完成 |

**上線指令：**
```bash
# 先 dry-run：驗證圖片尺寸、大小、area mapping，不會改 LINE
npm run rich-menu:upload -- \
  --image docs/rich-menu/rich-menu.jpg

# 確認無誤後發布：建立 Rich Menu、上傳圖片、設為 default
npm run rich-menu:upload -- \
  --image docs/rich-menu/rich-menu.jpg \
  --commit
```

**Area action：**
- 立即預約 → `https://liff.line.me/{liffId}/booking`
- 取消／改期 → `https://liff.line.me/{liffId}/my-bookings`
- 我的預約 → `https://liff.line.me/{liffId}/my-bookings`
- 服務項目 → message `服務`
- 聯絡店家 → `tel:{tenant.phone}`；若 tenant 無電話則發訊息 `電話`
- 匯款資訊 → message `匯款`

> 注意：正式上線請使用 `docs/rich-menu/rich-menu.jpg`，並在 dry-run 確認座標後才加 `--commit`。`docs/rich-menu/large-*` / `small-*` 是另一版 6 格圖的預覽輸出，不是本次 ChatGPT 圖。

**驗收：**
- [ ] LINE 主畫面 Rich Menu 顯示 6 格
- [ ] 點「取消/改期」→ 進 LIFF `/my-bookings`，最近一筆預約預設展開取消按鈕
- [ ] 點「聯絡店家」→ 直接撥電話或 fallback 到客服訊息

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
