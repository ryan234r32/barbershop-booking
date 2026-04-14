# LIFF 頁面設計 Prompt — for Google Stitch

> **用途：** 將以下 prompt 貼到 Google Stitch，讓 AI 設計 1008 Hair Studio 的所有 LIFF 頁面
> **技術背景：** 客人端 LINE LIFF（在 LINE App 內的 WebView）
> **設計原則：** 風格與配色讓 Stitch 自由發揮，以下只規範結構、功能與互動
> **日期：** 2026-04-11

---

## 使用方式

1. 打開 [Google Stitch](https://stitch.withgoogle.com/)
2. 選 Mobile（iPhone size，375px 或 430px）
3. 貼上下方 **English Prompt**
4. Stitch 會產出多張螢幕，每張對應一個頁面
5. 產出後下載 → 作為後續實作的視覺參考

---

## 建議操作方式

**選擇 A：一次性整份貼上**
把下方「Master Prompt」全部貼進去，Stitch 會理解這是一個產品，產出多個頁面。

**選擇 B：逐頁分次貼**
如果 Stitch 一次產不出這麼多頁，把每個 Page 的區塊分別貼。這樣每次只生一頁，品質會比較穩定。

**推薦流程：** 先用選擇 A 一次跑看看整體方向，再用選擇 B 針對有問題的頁面重做。

---

## Master Prompt（貼這整段）

```
Design all LIFF (LINE in-app browser) screens for a premium hair salon booking system in Taiwan called "1008 Hair Studio". This is a customer-facing product embedded inside the LINE messaging app. All screens render inside LINE's mobile WebView.

## PROJECT CONTEXT

**Product:** Booking system for a solo premium hair salon
**Target user:** Taiwanese LINE users, age 20-50, booking a haircut/color/perm
**Device:** Mobile phones only (iPhone + Android), viewport 375-430px wide
**Language:** Traditional Chinese (繁體中文)
**Brand feeling:** Premium but approachable, clean, modern, minimal, trustworthy — think Apple Store meets Aesop skincare, NOT trendy or cartoony

**Core services offered:**
- 男士剪髮 (Men's Haircut) — 60 min — NT$1,000
- 女士剪髮 (Women's Haircut) — 60 min — NT$1,100
- 染髮 (Hair Color) — 180 min — NT$2,600
- 溫塑燙 (Soft Perm) — 240 min — NT$4,000
- 縮毛矯正 (Hair Straightening) — 240 min — NT$4,600
- 護髮 (Hair Treatment) — 60 min — NT$800

## DESIGN PRINCIPLES (non-negotiable)

1. Mobile-first: Every screen designed for 375-430px wide phones
2. Single-page flows where possible: Avoid unnecessary page transitions
3. Sticky bottom action bars for primary CTAs
4. Use toast notifications and bottom sheets instead of browser alerts
5. Skeleton loading states, not blank spinners
6. Clear visual hierarchy: one primary action per screen
7. Generous whitespace, never cram content
8. Large tap targets (minimum 44×44 pixels)
9. Safe area insets for iPhone notch and home indicator

## PAGES TO DESIGN

---

### PAGE 1: LIFF Loading Screen

**Purpose:** Shown for 2-5 seconds while LIFF SDK initializes. Must feel intentional, not broken.

**Required elements:**
- Shop logo or name "1008 Hair Studio" prominently displayed
- A skeleton screen that mimics the layout of the booking page (gray placeholder blocks)
- Subtle loading text at bottom: "正在為你準備預約資訊..."
- Brand-colored background or subtle gradient
- No spinner alone — combine with skeleton

**States:** Loading only (transitions to Page 2 when ready)

---

### PAGE 2: Booking Flow (Main Single-Page)

**Purpose:** The core booking page. Customer picks service, date, time, and confirms. Everything on one scrollable page, no step navigation.

**Layout structure (top to bottom):**

**Header (sticky top):**
- Shop name "1008 Hair Studio"
- Close button (X) on the right

**Section 1: 選擇服務 (Choose Service)**
- Section label "① 選擇服務" or similar numbered indicator
- Grid of 6 service cards (2 columns × 3 rows)
- Each service card shows:
  - Service emoji or icon (e.g., ✂️ 💇 🎨 🌀 ✨ 💆)
  - Service name in Chinese
  - Duration ("約 60 分鐘")
  - Price ("NT$ 1,000")
- Cards have clear selected vs unselected states
- When selected, show a checkmark badge on the card

**Section 2: 選擇日期與時段 (Choose Date & Time) — ON SAME PAGE**
- Section label "② 選擇日期與時段"
- Month calendar (7-column grid, entire month visible):
  - Month label at top with prev/next arrows: "‹ 4 月 2026 ›"
  - "今天" (Today) button on the right to jump to current month
  - Weekday headers: 一 二 三 四 五 六 日
  - Calendar grid showing all days of the month
  - Days have states: available (tappable), selected (circle highlight), disabled (grayed out for past dates / closed days / out of booking window), today (highlighted differently)
- Available time slots appear BELOW the calendar in a panel (inline, no page jump):
  - Label showing selected date: "04/21 可預約時間"
  - Slots grouped by morning (上午) and afternoon (下午)
  - 3-column grid of time slot buttons: [11:00] [12:00] [13:00] ...
  - Slot states: available, selected (dark/highlighted), recommended (has a small "推薦" badge), disabled/full (grayed out but still visible)
- After selecting a time, show a duration hint box below:
  - "💡 預約時長：60 分鐘"
  - "你的預約時間：15:00 - 16:00"

**Section 3: 備註 (Notes — Optional)**
- Section label "③ 備註（選填）"
- Large text area
- Placeholder: "想告訴設計師什麼嗎？（例如：想要修瀏海、有特殊需求）"
- Link below: "查看取消政策" (opens a bottom sheet, see Page 7)

**Sticky bottom confirmation bar:**
- Shows current selection summary: "男士剪髮 · 4/21 (二) 15:00 · NT$1,000"
- Large primary button: "確認預約"
- Button is disabled until all required sections are filled
- Fixed to bottom of viewport even when user scrolls

**States to show:**
- Initial empty state (no service selected)
- Partial state (service selected but no time)
- Complete state (ready to confirm, button enabled)

---

### PAGE 3: First-Time Customer Info Bottom Sheet

**Purpose:** Triggered when customer taps "確認預約" for the first time. Collects name, phone, gender. Shown as a bottom sheet over Page 2.

**Layout:**
- Bottom sheet sliding up from bottom (about 60% of screen height)
- Drag handle at top
- Title: "請留下你的資料"
- Subtitle: "方便我們聯絡你，下次就不用再填了"
- Form fields:
  - 姓名 (Name) — required text input
  - 手機號碼 (Phone) — required, placeholder "09xxxxxxxx"
  - 性別 (Gender) — required, two radio buttons: 男 / 女
- Cancel button and primary "確認並完成預約" button at bottom
- Backdrop behind the sheet (semi-transparent dark)

---

### PAGE 4: Booking Success (Inline State)

**Purpose:** Shown AFTER successful booking. This is NOT a separate page — it replaces the booking page content in-place. No navigation.

**Layout:**
- Large success animation or icon (checkmark with subtle motion)
- Title: "預約成功！"
- Subtitle: "確認訊息已發送到你的 LINE"
- Booking summary card showing:
  - Service name
  - Date and day of week ("4/21 (二)")
  - Time range ("15:00 - 16:00")
  - Price
- Three action buttons (stacked or in a row):
  - "📅 加入行事曆" (Add to Calendar)
  - "📋 查看我的預約" (View My Bookings)
  - "✕ 關閉" (Close and return to LINE)

---

### PAGE 5: My Bookings (List)

**Purpose:** Customer views their booking history. Two tabs: upcoming and past.

**Layout:**
- Header with title "我的預約" and close button
- Two tabs at top: "即將到來" and "歷史記錄"
- For each booking, show a card:
  - Service name (prominent)
  - Date and day ("4/21 (二)")
  - Time range
  - Price
  - Status badge (e.g., 即將到來 / 已完成 / 已取消 / 爽約)
- For upcoming bookings only, show action buttons on the card:
  - "改期" (Reschedule)
  - "取消" (Cancel) — subtle red
  - "前往付款" (Go to Payment) — if not paid yet
- Empty state: "你還沒有預約喔！來預約第一次吧 ✂️" with a "立即預約" button

---

### PAGE 6: Reschedule Bottom Sheet

**Purpose:** Triggered from Page 5 when customer taps "改期". Reuses the date+time picker from Page 2.

**Layout:**
- Bottom sheet taking ~85% of screen height
- Drag handle at top
- Title: "改期"
- Shows current booking info: "原本：4/21 (二) 15:00"
- Month calendar (same as Page 2 Section 2)
- Time slots panel (same as Page 2)
- Sticky bottom button: "確認改期到 4/23 (四) 14:00"
- A warning note: "每筆預約最多改期 2 次"

---

### PAGE 7: Cancellation Policy Bottom Sheet

**Purpose:** Triggered from Page 2 "查看取消政策" link. Shows cancellation rules.

**Layout:**
- Bottom sheet from bottom (~50% screen height)
- Drag handle at top
- Title: "取消政策"
- Three visual blocks representing different cancellation scenarios:
  - Green block: "前一天取消 — 免費取消，無違規"
  - Yellow/amber block: "當天營業時間內取消 — 必須打電話聯絡"
  - Red block: "當天非營業時間取消 — 可線上取消但記為違規"
- Footer note: "累積 3 次違規 → 下個月只能電話預約"
- Close button

---

### PAGE 8: Payment Page

**Purpose:** After booking, customer can submit payment screenshot or choose to pay in-store.

**Layout:**
- Header with back button "← 返回我的預約"
- Booking summary card at top:
  - Service name
  - Date and time
  - Amount due: "應付金額 NT$ 1,000"
- Payment method section "付款方式":
  - Option 1: "💵 到店現金付款" (radio selectable)
    - Description: "到店時直接付款即可"
  - Option 2: "🏦 銀行轉帳" (radio selectable)
    - When selected, shows:
      - Bank: 中國信託 (822)
      - Account holder: XXX
      - Account number: XXXX-XXXX-XXXX (with a "複製" copy button next to it)
      - Upload zone: "上傳轉帳截圖" (dashed border, cloud icon)
      - After upload: image preview + status
- Payment status tracker at bottom:
  - Timeline showing: 上傳 → 店家確認中 → 已確認
- No "confirm" button needed if cash is selected

---

### PAGE 9: Waitlist Join Bottom Sheet

**Purpose:** When a customer tries to book a full day, they can add themselves to a waitlist.

**Layout:**
- Bottom sheet (~60% height)
- Title: "加入候補"
- Subtitle: "如果有人取消，我們會第一時間 LINE 通知你"
- Shows the desired slot info: "你想預約的時段：4/21 (二) 15:00"
- Service already selected (shown as a chip)
- Optional alternate days: checkbox list
  - "也可以接受以下日期的這個時段："
  - [ ] 4/22 (三)
  - [ ] 4/23 (四)
  - [ ] 4/24 (五)
- Primary button: "加入候補名單"
- Note: "候補通知後 30 分鐘內未預約，會自動讓給下一位"

---

### PAGE 10: Error State (Network / System Failure)

**Purpose:** When LIFF fails to load services or API errors occur.

**Layout:**
- Centered illustration or simple icon
- Title: "暫時無法載入"
- Description: "請檢查網路後再試，或聯絡店家"
- Primary button: "重新載入"
- Secondary button: "聯絡店家" (opens phone dialer tel: link)

## GENERAL GUIDELINES FOR ALL SCREENS

**Typography:**
- Use a clean modern sans-serif for Chinese (suggest: Noto Sans TC, PingFang TC, or similar)
- Large, legible sizes — remember this is a phone screen
- Clear hierarchy: section labels small, primary content large, metadata subtle

**Color scheme (your choice, but follow these rules):**
- Choose a cohesive palette that feels premium and trustworthy
- One primary brand color for CTAs and highlights
- Neutrals (white, light gray, dark text) for most content
- Status colors: green for success/available, red/orange for warnings, gray for disabled
- Avoid: neon, tacky gradients, high saturation everywhere

**Interactions (show visual affordances):**
- Buttons should have clear tap states
- Cards with selectable items should have clear selected vs unselected states
- Disabled states should be visually obvious (low opacity, muted color)
- Loading states should never show a blank screen

**Critical:** All screens must feel like they belong to the SAME product. Consistent spacing, typography, card styles, button styles, header patterns.

Output: Design each page as a separate mobile screen mockup at 430×932 pixels (iPhone 14 Pro Max size). Show realistic content, not lorem ipsum.
```

---

## 中文對照版（備用）

如果英文 prompt 跑不出預期結果，可以換成中文版試試。內容相同，只是語言切換。使用時**把上方 English Prompt 整段換成這段中文**：

```
請為台灣一家精品理髮廳「1008 Hair Studio」設計 LINE LIFF（嵌在 LINE App 內的網頁）的所有客人端頁面。

## 專案背景
- 產品：一人精品理髮廳的預約系統
- 目標客群：台灣 LINE 使用者，20-50 歲，想預約剪髮／染髮／燙髮
- 裝置：僅手機（iPhone + Android），寬度 375-430px
- 語言：繁體中文
- 品牌感受：精品質感、親切、乾淨、現代、極簡、值得信賴 — 想像 Apple Store 遇上 Aesop，不要 trendy 或卡通風

## 服務項目
- 男士剪髮 60 分鐘 NT$1,000
- 女士剪髮 60 分鐘 NT$1,100
- 染髮 180 分鐘 NT$2,600
- 溫塑燙 240 分鐘 NT$4,000
- 縮毛矯正 240 分鐘 NT$4,600
- 護髮 60 分鐘 NT$800

## 設計原則
1. 手機優先（375-430px）
2. 單頁流程優先，避免不必要的頁面切換
3. 主要 CTA 用 sticky 底部按鈕
4. 用 toast 和 bottom sheet，不用瀏覽器 alert
5. Skeleton loading，不要只有 spinner
6. 清楚的視覺層次，每頁一個主要動作
7. 大量留白，不要塞滿內容
8. 大觸控區域（至少 44×44px）
9. 支援 iPhone safe area

## 要設計的頁面（10 頁）

### 頁面 1：LIFF 載入畫面
顯示 2-5 秒 LIFF 初始化時間。
- 店家 Logo「1008 Hair Studio」
- Skeleton screen 模擬預約頁結構
- 底部提示「正在為你準備預約資訊...」
- 不可空白，不可只有 spinner

### 頁面 2：預約主頁（單頁）
核心頁面。客人選服務、日期、時段、確認。全部在同一頁，不換頁。

**頁首（sticky）：** 店名 + 關閉按鈕（X）

**① 選擇服務：** 2x3 服務卡片網格，每張卡片顯示 emoji + 名稱 + 時長 + 價格，有選中/未選中狀態，選中時右上角有勾勾 badge

**② 選擇日期與時段（同一頁！）：**
- 月曆標題「‹ 4 月 2026 ›」+ 右側「今天」按鈕
- 星期標頭：一 二 三 四 五 六 日
- 7 欄月曆網格（顯示整個月）
- 日期狀態：可選（黑字）、選中（圓形高亮）、不可預約（灰色）、今天（特殊樣式）
- 選中日期後，下方直接出現時段區（不跳頁）：
  - 標題「04/21 可預約時間」
  - 時段按上午／下午分組
  - 3 欄按鈕網格：[11:00] [12:00] [13:00]...
  - 時段狀態：可預約、選中（深色）、推薦（有「推薦」badge）、已滿（灰色但仍顯示）
- 選中時段後顯示提示框：「💡 預約時長：60 分鐘，你的預約時間 15:00 - 16:00」

**③ 備註（選填）：** 大 textarea + 「查看取消政策」連結

**Sticky 底部確認列：**
- 顯示摘要「男士剪髮 · 4/21 (二) 15:00 · NT$1,000」
- 大型主按鈕「確認預約」
- 必要資訊未填時按鈕 disabled
- 滾動時永遠固定在底部

### 頁面 3：首次預約資料收集 Bottom Sheet
從頁面 2 按「確認預約」觸發（首次才出現）。
- Bottom sheet 從底部滑出（約螢幕高度 60%）
- 頂部 drag handle
- 標題「請留下你的資料」
- 副標「方便我們聯絡你，下次就不用再填了」
- 欄位：姓名（必填）、手機號碼（必填，09xxxxxxxx）、性別（男/女 radio）
- 底部「取消」次按鈕 + 「確認並完成預約」主按鈕
- 背後有半透明深色遮罩

### 頁面 4：預約成功狀態（inline）
預約成功後，**不跳頁**，直接取代頁面 2 的內容。
- 大型成功圖示（勾勾 + 微動畫）
- 標題「預約成功！」
- 副標「確認訊息已發送到你的 LINE」
- 預約摘要卡片：服務名、日期+星期、時間區間、金額
- 三個動作按鈕：📅 加入行事曆、📋 查看我的預約、✕ 關閉

### 頁面 5：我的預約列表
客人查看自己的預約。
- 頁首「我的預約」+ 關閉按鈕
- 兩個 Tab：「即將到來」、「歷史記錄」
- 每個預約卡片顯示：服務名、日期+星期、時間區間、金額、狀態 badge
- 即將到來的預約有操作按鈕：改期、取消（微紅）、前往付款
- 空狀態：「你還沒有預約喔！來預約第一次吧 ✂️」+ 立即預約按鈕

### 頁面 6：改期 Bottom Sheet
從頁面 5 按「改期」觸發。重用頁面 2 的日期時段選擇器。
- Bottom sheet 約螢幕高度 85%
- 標題「改期」
- 顯示原預約「原本：4/21 (二) 15:00」
- 月曆（同頁面 2）
- 時段區（同頁面 2）
- Sticky 底部按鈕「確認改期到 4/23 (四) 14:00」
- 警語「每筆預約最多改期 2 次」

### 頁面 7：取消政策 Bottom Sheet
從頁面 2「查看取消政策」觸發。
- Bottom sheet 約螢幕高度 50%
- 標題「取消政策」
- 三個視覺區塊（綠／黃／紅漸進嚴重度）：
  - 綠「前一天取消 — 免費取消，無違規」
  - 黃「當天營業時間內取消 — 必須打電話聯絡」
  - 紅「當天非營業時間取消 — 可線上取消但記為違規」
- 底部註解「累積 3 次違規 → 下個月只能電話預約」
- 關閉按鈕

### 頁面 8：付款頁
- 頁首返回按鈕「← 返回我的預約」
- 頂部預約摘要卡片：服務、日期、時間、應付金額
- 付款方式 radio 選擇：
  - 💵 到店現金付款（選中後顯示「到店時直接付款即可」）
  - 🏦 銀行轉帳（選中後顯示：銀行、戶名、帳號+複製按鈕、上傳截圖區域）
- 上傳截圖區：虛線邊框、雲圖示、「上傳轉帳截圖」文字
- 上傳後顯示預覽 + 狀態
- 底部狀態 timeline：上傳 → 店家確認中 → 已確認

### 頁面 9：加入候補 Bottom Sheet
當客人想預約的日期已滿，可以加入候補。
- Bottom sheet 約 60% 高度
- 標題「加入候補」
- 副標「如果有人取消，我們會第一時間 LINE 通知你」
- 顯示「你想預約的時段：4/21 (二) 15:00」
- 服務（已選，顯示為 chip）
- 選填「也可以接受以下日期的這個時段：」checkbox 列表
  - [ ] 4/22 (三)
  - [ ] 4/23 (四)
  - [ ] 4/24 (五)
- 主按鈕「加入候補名單」
- 註解「候補通知後 30 分鐘內未預約，會自動讓給下一位」

### 頁面 10：錯誤狀態
LIFF 或 API 失敗時顯示。
- 置中插圖或簡單圖示
- 標題「暫時無法載入」
- 描述「請檢查網路後再試，或聯絡店家」
- 主按鈕「重新載入」
- 次按鈕「聯絡店家」（tel: 連結）

## 通用準則
- 字體：乾淨現代 sans-serif（建議 Noto Sans TC、PingFang TC）
- 配色：自由發揮但要精品感、cohesive、有一個主品牌色、大量中性色、狀態色清楚
- 互動：每個可點擊元素要有 tap state、選中狀態要明顯、disabled 狀態要低透明度
- 關鍵：所有頁面必須感覺屬於同一個產品（一致的間距、字體、卡片樣式、按鈕樣式、頁首模式）

輸出：每頁都是獨立的 mobile 螢幕 mockup，尺寸 430×932 像素（iPhone 14 Pro Max）。使用真實內容，不要用 lorem ipsum。
```

---

## Stitch 產出後該做什麼

1. **下載所有產出的頁面為 PNG 或 SVG**
2. **存到專案**：建議放在 `docs/fresha-analysis/mockups/stitch-output/` 資料夾
3. **逐頁比對現有 HTML mockup**：
   - 現有 [customer-booking.html](./fresha-analysis/mockups/customer-booking.html) 對應 Page 2
   - 其他 8 頁是新的
4. **挑最順眼的風格**，如果某幾頁風格不一致，單獨重做那幾頁
5. **給老闆看**：用實際設計圖跟老闆討論，比文字描述有說服力得多
6. **確認後**，再請我把設計轉換成 HTML mockup（和現有的 customer-booking.html 一致的技術棧）
7. **最後才開始寫 React/Next.js code**

---

## 品質檢查 Checklist

Stitch 產出後，用這個 checklist 檢查每一頁：

**所有頁面共通：**
- [ ] 是手機尺寸（375-430px 寬）
- [ ] 頁首有明確的標題或導航
- [ ] 文字在小尺寸下清晰可讀
- [ ] 按鈕大小至少 44×44px
- [ ] 沒有使用 lorem ipsum，內容是真實情境

**Page 2 (預約主頁)：**
- [ ] 月曆是 7 欄網格，不是橫向滾動
- [ ] 時段區在月曆下方（不跳頁）
- [ ] Sticky 底部確認列存在
- [ ] 選中狀態清楚

**Page 3, 6, 7, 9 (Bottom Sheets)：**
- [ ] 有頂部 drag handle
- [ ] 背後有遮罩
- [ ] 不是全螢幕 modal

**Page 4 (成功狀態)：**
- [ ] 看起來是同一頁的狀態轉換，不是新頁面
- [ ] 有明確的下一步動作

**整體：**
- [ ] 所有頁面風格一致（同系列）
- [ ] 主色調統一
- [ ] 間距規律

---

## 10 個頁面的快速清單

| # | 頁面 | 類型 | 觸發方式 |
|---|------|------|---------|
| 1 | LIFF 載入 | 過渡 | 自動（LIFF init） |
| 2 | 預約主頁 | 主頁 | 從 Rich Menu「立即預約」 |
| 3 | 首次資料收集 | Bottom sheet | 從 Page 2「確認預約」（首次）|
| 4 | 預約成功 | Inline 狀態 | Page 2 確認後 |
| 5 | 我的預約列表 | 主頁 | 從 Rich Menu「我的預約」 |
| 6 | 改期 | Bottom sheet | 從 Page 5「改期」 |
| 7 | 取消政策 | Bottom sheet | 從 Page 2「查看取消政策」 |
| 8 | 付款 | 主頁 | 從 Page 5「前往付款」 |
| 9 | 加入候補 | Bottom sheet | 從 Page 2 時段全滿時 |
| 10 | 錯誤狀態 | 全頁狀態 | API / 網路失敗時 |
