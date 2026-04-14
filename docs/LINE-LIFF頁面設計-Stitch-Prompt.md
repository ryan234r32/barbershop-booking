# LINE LIFF 頁面設計 — Stitch Prompt（逐頁版）

> **用途：** 一次一頁貼到 Google Stitch，產出 1008 Hair Studio 使用者端 LINE LIFF 頁面設計
> **品牌規範來源：** [品牌設計規範.md](./品牌設計規範.md) v2.0
> **最後更新：** 2026-04-12
> **頁面數：** 10 頁（每頁一個獨立 prompt）

---

## 使用方式（重要，跟之前不同）

根據 [Google 官方 Stitch Prompt Guide](https://discuss.ai.google.dev/t/stitch-prompt-guide/83844) 的建議：

1. 打開 [Google Stitch](https://stitch.withgoogle.com/)
2. 選 **Mobile** layout
3. 選 **Thinking 模式**（品質最好，每月 50 次）
4. **一次只貼一個 prompt**（不要一次貼 10 個）
5. 產出後微調到滿意 → 下載
6. 開新 session 或在同一 session 繼續下一頁

**為什麼拆開：** Stitch 官方指出超過 5,000 字的 prompt 準確度只有約 60%，元件會被忽略。一次一頁、每頁 1,000-1,500 字是最佳範圍。

**微調技巧：** 產出後如果某個部分不對，不要重寫整個 prompt。用簡短的追加指令微調，例如：
- 「Change the calendar selected date circle to solid #003D2B」
- 「Make all buttons rectangular with 8px radius, not rounded」
- 「Switch all text to Traditional Chinese」

---

## 通用品牌背景（每個 prompt 開頭都會帶）

以下是每個 prompt 共用的品牌背景段落，已經嵌入在每頁的 prompt 裡面，你不需要另外複製：

```
Brand: "1008 Hair Studio" — premium solo hair salon in Taipei, Taiwan
Style: Botanical Minimalist (Apple Store × Aesop × Kinfolk Magazine × Muji)
Mood: Quiet, premium, architectural, organic, trustworthy
Colors: Primary #003D2B (deep forest green), Background #FFF8F1 (warm ivory, NEVER pure white), Surface #F3ECE4 (soft sand)
Text: Headings #003D2B, Body #2D3A30, Muted rgba(0,61,43,0.5)
Status: Success #4A7C59, Warning #C88B3B, Error #A84A3B
Fonts: Manrope + Noto Sans TC. Bold headings with letter-spacing.
Buttons: #003D2B bg + #FFF8F1 text, rectangular 4-8px radius (never rounded)
Cards: #F3ECE4 default, #FFF8F1 + #003D2B border when selected. No shadows.
Language: ALL text Traditional Chinese (繁體中文)
```

---

## Prompt 1/10 — LIFF 載入畫面

```
Design a mobile loading screen for a premium hair salon booking app called "1008 Hair Studio" in Taiwan.

Brand: "1008 Hair Studio" — premium solo hair salon in Taipei
Style: Botanical Minimalist — Apple Store meets Aesop skincare. Quiet, premium, architectural.
Colors: Primary #003D2B (deep forest green), Background #FFF8F1 (warm ivory — never pure white #FFFFFF), Surface #F3ECE4 (soft sand)
Fonts: Manrope (Latin) + Noto Sans TC (Chinese)

This screen shows for 2-5 seconds while the app initializes inside LINE's mobile browser.

Layout from top to bottom:
1. Large vertical whitespace at top (breathing room)
2. Shop name "1008 Hair Studio" centered, #003D2B text, bold, letter-spacing 0.05em
3. Small botanical line illustration below the name — a simple leaf or branch drawn with thin #003D2B outline strokes (1.5px). Minimal, not decorative.
4. Below that, three skeleton placeholder rectangles in #F3ECE4 (soft sand color) representing where content will load — mimicking a card grid layout
5. At the very bottom, small text "正在為你準備預約資訊..." in rgba(0,61,43,0.5) muted green

The entire background is #FFF8F1 warm ivory. No spinners, no progress bars. The skeleton blocks and the muted text communicate "loading" quietly.

Device: iPhone 14 Pro Max, 430×932px. All text in Traditional Chinese.
```

---

## Prompt 2/10 — 預約主頁面（上半部：服務選擇）

因為這是最長的頁面，拆成上下兩個 prompt。先產上半部。

```
Design the top half of a mobile booking page for "1008 Hair Studio", a premium hair salon in Taipei.

Brand: Botanical Minimalist. Colors: #003D2B (primary), #FFF8F1 (background — never pure white), #F3ECE4 (surface), #2D3A30 (body text). Fonts: Manrope + Noto Sans TC. Buttons: rectangular, 4-8px radius only.

This is a single scrollable page inside LINE's mobile browser. Show the top portion:

1. STICKY HEADER at top:
   - Background #FFF8F1
   - Left: "1008 Hair Studio" in #003D2B, SemiBold
   - Right: close icon (X), thin outline style, #003D2B

2. SECTION: Choose Service
   - Small label "STEP 01" — uppercase, Manrope Medium, letter-spacing 0.15em, #003D2B
   - Title "選擇服務" — Noto Sans TC Bold, #003D2B, letter-spacing 0.03em
   - 32px gap below title
   - Grid of 6 service cards, 2 columns × 3 rows, 12px gap between cards

   Each UNSELECTED card:
   - Background #F3ECE4 (soft sand)
   - Border-radius 12px
   - Padding 16px
   - Service name in #003D2B SemiBold (e.g., "男士剪髮")
   - Duration in muted text "約 60 分鐘"
   - Price in #003D2B SemiBold "NT$ 1,000"
   - No icons, no images — clean typographic cards

   One card shown as SELECTED (男士剪髮):
   - Background changes to #FFF8F1
   - 2px solid #003D2B border
   - Small circular checkmark badge at top-right corner (12px circle, #003D2B fill, white check)

   The 6 services:
   - 男士剪髮 / 約 60 分鐘 / NT$ 1,000
   - 女士剪髮 / 約 60 分鐘 / NT$ 1,100
   - 染髮 / 約 180 分鐘 / NT$ 2,600
   - 溫塑燙 / 約 240 分鐘 / NT$ 4,000
   - 縮毛矯正 / 約 240 分鐘 / NT$ 4,600
   - 護髮 / 約 60 分鐘 / NT$ 800

Device: iPhone 14 Pro Max, 430×932px. All text Traditional Chinese.
```

---

## Prompt 3/10 — 預約主頁面（下半部：日曆 + 時段 + 確認）

```
Design the bottom half of a mobile booking page for "1008 Hair Studio". This continues below a service selection grid (already designed separately).

Brand: Botanical Minimalist. Colors: #003D2B, #FFF8F1 (background), #F3ECE4 (surface), #2D3A30 (body text). Buttons: rectangular 4-8px radius. Fonts: Manrope + Noto Sans TC.

Show these sections from top to bottom:

1. SECTION: Choose Date & Time
   - Label "STEP 02" uppercase, letter-spacing 0.15em
   - Title "選擇日期與時段"

2. MONTH CALENDAR (7-column grid):
   - Header: "‹  4 月 2026  ›" centered with thin arrow buttons. Right side: "今天" text in #003D2B.
   - Weekday row: 一 二 三 四 五 六 日 in muted rgba(0,61,43,0.5)
   - Calendar grid showing April 2026. Day cells with generous spacing.
   - Day 21 is SELECTED: solid #003D2B circle with #FFF8F1 white text
   - Day 12 is TODAY: #003D2B text with small dot below
   - Days 1-11 are PAST: 25% opacity, grayed out
   - All Mondays (6, 13, 20, 27) are CLOSED: also grayed out 25% opacity
   - Other days: normal #003D2B text

3. TIME SLOTS PANEL (below calendar, inline):
   - Container: #F3ECE4 background, border-radius 12px, padding 16px
   - Label: "04/21 可預約時間" in muted text
   - Sub-label: "上午" uppercase, letter-spacing 0.15em
   - One button: [11:00] with small "推薦" badge at top-right
   - Sub-label: "下午"
   - Three buttons: [15:00] [16:00] [17:00]
   - Button "15:00" is SELECTED: #003D2B filled, #FFF8F1 text
   - Other buttons: #FFF8F1 bg, #003D2B text, 1px #003D2B border
   - All buttons: rectangular, 8px radius, 44px minimum height

4. HINT BOX (below time slots):
   - #FFF8F1 background, 3px #003D2B left border accent
   - "預約時長：180 分鐘"
   - "你的預約時間：11:00 — 14:00"

5. SECTION: Notes
   - Label "STEP 03"
   - Title "備註（選填）"
   - Text area with bottom-border-only style (1px #003D2B)
   - Placeholder: "想告訴設計師什麼嗎？" in muted
   - Link below: "查看取消政策" underlined #003D2B text

6. STICKY BOTTOM BAR (fixed to viewport bottom):
   - #FFF8F1 background, thin #F3ECE4 top border
   - Small text: "染髮 · 4/21 (二) 15:00 · NT$2,600"
   - Full-width button: "確認預約" — #003D2B background, #FFF8F1 text, 8px radius

Device: iPhone 14 Pro Max, 430×932px. All text Traditional Chinese.
```

---

## Prompt 4/10 — 首次資料收集 Bottom Sheet

```
Design a mobile bottom sheet overlay for collecting first-time customer info at "1008 Hair Studio".

Brand: Botanical Minimalist. Colors: #003D2B, #FFF8F1, #F3ECE4, #2D3A30. Fonts: Manrope + Noto Sans TC. Buttons: rectangular 4-8px radius.

This bottom sheet slides up from the bottom, covering about 60% of the screen. Behind it is a semi-transparent dark backdrop rgba(45, 58, 48, 0.5).

Bottom sheet layout from top to bottom:
1. Drag handle: small #F3ECE4 rounded bar centered at top (40px wide, 4px tall)
2. Title: "請留下你的資料" in #003D2B Bold, letter-spacing 0.03em
3. Subtitle: "方便我們聯絡你，下次就不用再填了" in muted rgba(0,61,43,0.5)
4. 24px gap
5. Input field "姓名": underline-style input (only bottom border, 1px #003D2B). Label above in muted small text.
6. Input field "手機號碼": same underline style. Placeholder text "09xxxxxxxx" in muted.
7. Gender selection "性別": two custom radio buttons side by side — "男" and "女". Selected state: #003D2B filled circle. Unselected: #F3ECE4 outlined circle.
8. 32px gap
9. Two buttons at bottom:
   - Left: "取消" — secondary button (transparent bg, #003D2B border + text)
   - Right: "確認並完成預約" — primary button (#003D2B bg, #FFF8F1 text)

The bottom sheet background is #FFF8F1. Border-radius 16px on top corners only. Padding 24px inside.

Device: iPhone 14 Pro Max, 430×932px. All text Traditional Chinese.
```

---

## Prompt 5/10 — 預約成功狀態

```
Design a mobile booking success screen for "1008 Hair Studio", a premium hair salon in Taipei.

Brand: Botanical Minimalist. Colors: #003D2B, #FFF8F1, #F3ECE4. Fonts: Manrope + Noto Sans TC.

This screen replaces the booking page after a successful reservation. Centered layout.

From top to bottom:
1. Large whitespace at top
2. A simple checkmark icon in #003D2B outline style (not filled, thin 2px strokes) — or a minimal botanical line drawing (single leaf with checkmark)
3. Title "預約成功" — #003D2B Bold, large, letter-spacing 0.05em
4. Subtitle "確認訊息已發送到你的 LINE" — muted rgba(0,61,43,0.5)
5. 32px gap
6. Booking summary card:
   - #F3ECE4 background, border-radius 12px, padding 20px
   - "染髮" in #003D2B SemiBold
   - "4/21 (二)" in #2D3A30
   - "11:00 — 14:00" in #2D3A30 (this is a 3-hour service, so 3 hours shown)
   - "NT$ 2,600" in #003D2B SemiBold
7. 24px gap
8. Three buttons stacked vertically, 12px gap between:
   - "加入行事曆" — secondary (transparent, #003D2B border)
   - "查看我的預約" — secondary
   - "關閉" — primary (#003D2B bg, #FFF8F1 text)

Background: #FFF8F1. Device: iPhone 14 Pro Max, 430×932px. All text Traditional Chinese.
```

---

## Prompt 6/10 — 我的預約列表

```
Design a mobile "My Bookings" list screen for "1008 Hair Studio", a premium hair salon in Taipei.

Brand: Botanical Minimalist. Colors: #003D2B, #FFF8F1, #F3ECE4, #2D3A30. Status colors: warning #C88B3B. Fonts: Manrope + Noto Sans TC.

Layout from top to bottom:

1. Header: "我的預約" in #003D2B Bold, letter-spacing 0.05em, left-aligned. Close (X) icon on right, outline style.

2. Two tabs below header:
   - "即將到來" — active tab: #003D2B text + 2px underline
   - "歷史記錄" — inactive: muted rgba(0,61,43,0.5) text, no underline

3. Two booking cards stacked vertically (16px gap):

   Card 1 (upcoming):
   - #F3ECE4 background, 12px radius, 20px padding
   - Top row: "男士剪髮" (H3, #003D2B left) + status badge "即將到來" (small, uppercase, letter-spacing 0.1em, top-right)
   - "4/21 (二)" in muted
   - "15:00 — 16:00" in #2D3A30
   - "NT$ 1,000" in #003D2B SemiBold
   - Bottom row: three text buttons — "改期" (#003D2B), "取消" (#C88B3B amber), "前往付款" (#003D2B outline small button)

   Card 2 (upcoming):
   - Same style as Card 1
   - "染髮" / "4/25 (六)" / "11:00 — 14:00" / "NT$ 2,600"
   - Badge: "即將到來"

4. If space allows, show a completed card in "歷史記錄" tab with muted styling and badge "已完成"

Background: #FFF8F1. Device: iPhone 14 Pro Max, 430×932px. All text Traditional Chinese.
```

---

## Prompt 7/10 — 改期 Bottom Sheet

```
Design a mobile bottom sheet for rescheduling a booking at "1008 Hair Studio".

Brand: Botanical Minimalist. Colors: #003D2B, #FFF8F1, #F3ECE4. Warning: #C88B3B. Fonts: Manrope + Noto Sans TC. Buttons: rectangular 4-8px radius.

This bottom sheet covers about 85% of the screen height. Backdrop: rgba(45,58,48,0.5).

Layout from top to bottom:
1. Drag handle: #F3ECE4 bar (40×4px)
2. Title "改期" in #003D2B Bold
3. Info line: "原本：4/21 (二) 15:00" in muted rgba(0,61,43,0.5)
4. 24px gap
5. Month calendar (same style as booking page):
   - "‹  4 月 2026  ›" with arrows and "今天" button
   - Weekday headers: 一 二 三 四 五 六 日
   - Day 23 SELECTED: #003D2B solid circle + #FFF8F1 text
   - Past days and Mondays grayed out
6. Time slots panel below calendar:
   - #F3ECE4 container, rounded
   - "04/23 可預約時間"
   - Buttons: [11:00] [14:00 selected] [15:00] [16:00]
   - Selected "14:00": #003D2B filled
7. Warning text: "每筆預約最多改期 2 次" — small, #C88B3B amber color
8. Sticky button at bottom: "確認改期到 4/23 (四) 14:00" — primary #003D2B

Bottom sheet bg: #FFF8F1, top corners 16px radius. Device: 430×932px. All Chinese.
```

---

## Prompt 8/10 — 取消政策 Bottom Sheet

```
Design a mobile bottom sheet showing cancellation policy for "1008 Hair Studio".

Brand: Botanical Minimalist. Colors: #003D2B, #FFF8F1, #F3ECE4. Warning: #C88B3B. Error: #A84A3B. Fonts: Manrope + Noto Sans TC.

Bottom sheet covers about 50% of screen. Backdrop: rgba(45,58,48,0.5).

Layout:
1. Drag handle: #F3ECE4 bar
2. Title "取消政策" in #003D2B Bold
3. 24px gap
4. Three info blocks stacked vertically (12px gap). Each block: #F3ECE4 background, 12px radius, 16px padding, with a colored left border accent (3px wide):

   Block 1 — green left border #003D2B:
   "前一天取消 — 免費取消，無違規"

   Block 2 — amber left border #C88B3B:
   "當天營業時間內取消 — 必須打電話聯絡"

   Block 3 — terracotta left border #A84A3B:
   "當天非營業時間取消 — 可線上取消但記為違規"

5. Footer note in small muted text: "累積 3 次違規 → 下個月只能電話預約"
6. "關閉" button at bottom — secondary style (#003D2B border)

Bottom sheet bg: #FFF8F1, top 16px radius. Device: 430×932px. All Chinese.
```

---

## Prompt 9/10 — 付款頁

```
Design a mobile payment page for "1008 Hair Studio", a premium hair salon in Taipei.

Brand: Botanical Minimalist. Colors: #003D2B, #FFF8F1, #F3ECE4, #2D3A30. Fonts: Manrope + Noto Sans TC. Buttons: rectangular 4-8px radius.

Layout from top to bottom:

1. Header: "← 返回我的預約" back link on left (#003D2B text) + title "付款" right-of-center

2. Booking summary card:
   - #F3ECE4 background, 12px radius, 20px padding
   - "男士剪髮" SemiBold
   - "4/21 (二) · 15:00 — 16:00" muted
   - "應付金額" small muted label
   - "NT$ 1,000" large #003D2B Bold

3. 32px gap

4. Payment method section:
   - Two radio options with custom styling (#003D2B filled circle when selected):

   Option A (selected): "到店現金付款"
   - Subtitle below: "到店時直接付款即可" in muted

   Option B: "銀行轉帳"
   - When selected, expands to show:
     - Bank info block (#F3ECE4, 12px radius, 16px padding):
       - "銀行：中國信託 (822)"
       - "戶名：陳先生"
       - "帳號：1234-5678-9012" with small outline "複製" button beside it
     - Upload zone: dashed 1px #003D2B border, 12px radius, centered outline cloud icon, text "上傳轉帳截圖"

5. Payment status timeline at very bottom:
   - Three steps horizontal: "上傳" → "店家確認中" → "已確認"
   - Connected by thin lines
   - First step completed: #003D2B solid circle
   - Second step current: #003D2B outline
   - Third step pending: #F3ECE4 muted

Background: #FFF8F1. Device: 430×932px. All Chinese.
```

---

## Prompt 10/10 — 加入候補 + 錯誤狀態（兩個簡短畫面）

這兩頁比較簡單，合成一次跑。

```
Design two simple mobile screens for "1008 Hair Studio":

Brand: Botanical Minimalist. Colors: #003D2B, #FFF8F1, #F3ECE4. Fonts: Manrope + Noto Sans TC. Buttons: rectangular 4-8px radius.

SCREEN A — Waitlist Bottom Sheet (60% screen height):
- Backdrop: rgba(45,58,48,0.5)
- Bottom sheet bg: #FFF8F1, top corners 16px radius
- Drag handle: #F3ECE4
- Title: "加入候補" Bold #003D2B
- Subtitle: "如果有人取消，我們會第一時間 LINE 通知你" muted
- Info card (#F3ECE4, 12px radius): "你想預約的時段" label + "4/21 (二) 15:00" + small chip "男士剪髮"
- Checkbox section: "也可以接受以下日期的這個時段："
  - Three checkboxes: "4/22 (三)" "4/23 (四)" "4/24 (五)"
  - Checked state: #003D2B filled square
- Button: "加入候補名單" primary
- Small note: "候補通知後 30 分鐘內未預約，會自動讓給下一位"

SCREEN B — Error State (full page, centered):
- Background: #FFF8F1
- Small botanical outline illustration centered (leaf or wilted branch, #003D2B, thin strokes)
- Title: "暫時無法載入" Bold #003D2B
- Subtitle: "請檢查網路後再試，或聯絡店家" muted
- Two buttons stacked:
  - "重新載入" primary (#003D2B)
  - "聯絡店家" secondary (outline)

Device: 430×932px. All text Traditional Chinese.
```

---

## 產出後流程

1. **逐頁跑完** → 下載存到 `docs/fresha-analysis/mockups/stitch-output-v2/`
2. **比對 [品牌設計規範.md](./品牌設計規範.md)** 看色值對不對
3. **微調不滿意的部分** → 在 Stitch 同 session 追加短指令：
   - 「Make the background warmer, use #FFF8F1」
   - 「The green should be darker, use exactly #003D2B」
   - 「Remove all rounded corners on buttons, make them 8px max」
   - 「Switch this text to Traditional Chinese: 確認預約」
4. **給老闆看** → 手機上看比電腦準
5. **確認後**請我轉成 HTML mockup
6. **最後才寫 code**

---

## 快速清單

| # | Prompt | 頁面 | 預估字數 |
|---|--------|------|---------|
| 1 | 載入畫面 | 過渡頁 | ~400 字 |
| 2 | 預約上半（服務選擇） | 主頁上段 | ~800 字 |
| 3 | 預約下半（日曆+時段+確認） | 主頁下段 | ~1,000 字 |
| 4 | 首次資料收集 | Bottom sheet | ~500 字 |
| 5 | 預約成功 | Inline 狀態 | ~500 字 |
| 6 | 我的預約 | 列表頁 | ~700 字 |
| 7 | 改期 | Bottom sheet | ~600 字 |
| 8 | 取消政策 | Bottom sheet | ~400 字 |
| 9 | 付款頁 | 主頁 | ~700 字 |
| 10 | 候補 + 錯誤（兩個） | Bottom sheet + 全頁 | ~600 字 |
