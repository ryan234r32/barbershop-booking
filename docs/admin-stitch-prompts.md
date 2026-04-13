# 後台管理 Stitch Prompt（逐頁版）

> **用途：** 一次一頁貼到 Google Stitch，產出 1008 Hair Studio 老闆端管理介面設計
> **規劃來源：** [後台管理重新設計規劃](./admin-redesign-plan.md)
> **配色策略：** 只給色彩方向，讓 Stitch 自由配色（不指定 hex codes）
> **最後更新：** 2026-04-13
> **頁面數：** 10 頁（每頁一個獨立 prompt）

---

## 使用方式

1. 打開 [Google Stitch](https://stitch.withgoogle.com/)
2. 選 **Mobile** layout
3. 選 **Thinking 模式**（品質最好）
4. **一次只貼一個 prompt**
5. 產出後微調 → 下載
6. 開新 session 繼續下一頁

**微調技巧：**
- 「Make the background warmer, less pure white」
- 「The buttons should be rectangular, not rounded」
- 「All text must be Traditional Chinese」
- 「Make the current-time line more visible」

---

## Prompt 1/10 — 日視角（首頁，最重要的頁面）

```
Design the main screen of a mobile admin app for "1008 Hair Studio", a premium solo hair salon in Taipei, Taiwan. This is the screen the owner sees every time they open the app — it must communicate today's schedule in under 5 seconds.

Aesthetic direction: Botanical Minimalist — imagine Apple Store's spatial calm crossed with Aesop skincare's organic warmth. Use a deep green tone as the primary brand color, with a warm off-white background (never pure white). Cards should use a soft neutral sand tone. Explore a cohesive color palette that feels quiet, premium, and architectural. No gradients, no heavy shadows. Status colors should feel muted and organic — think moss, amber, terracotta — not neon.

Fonts: a clean geometric sans-serif for Latin text, paired with Noto Sans TC for Chinese. Bold headings with generous letter-spacing.

This is a PWA installed on the owner's iPhone home screen. No browser chrome. Device: iPhone 14 Pro, 393×852px.

Layout from top to bottom:

1. TOP BAR (sticky):
   - Left: date navigation arrows ◀ ▶ with current date "2026/04/13 (日)" in primary brand color, SemiBold
   - Right: "今天" button (small, outline style)
   - Below: view switcher — three segment buttons: [日] [週] [月]
     - Active segment: filled with primary brand color + light text
     - Inactive: transparent + primary color text

2. SUMMARY STRIP:
   - Light neutral background strip
   - "今日 5 預約" and "預估 NT$4,600" inline with a subtle divider

3. SCROLLABLE TIMELINE (the main content):
   Like Google Calendar's day view. 9 hourly rows from 11:00 to 19:00, each ~72px tall.
   Auto-scrolls to current time on load.

   A HORIZONTAL LINE in a warm red/terracotta crosses the full width at the current time (e.g., 14:35). Small circle on left edge marking exact position.

   Left side: time labels in muted text, 12px.

   BOOKED SLOTS — card for each booking:
   - Soft neutral background for single-hour services (like haircut)
   - Multi-hour services (like a 3-hour perm) span multiple rows with a slightly tinted card (subtle brand-color wash)
   - Card content (information hierarchy — THIS ORDER MATTERS):
     * Customer name: LARGEST and MOST PROMINENT (16px SemiBold) — the owner's brain asks "who's next?" not "what time?"
     * Service name: secondary, regular weight, slightly muted
     * Segment badge: small pill on the right side
       - VIP: warm gold/amber tint
       - 常客 (regular): green tint
       - 新客 (new): brand color tint
   - Cards: subtle radius (8px), no shadow, no border

   EMPTY SLOTS:
   - Dashed border box, transparent background — visually says "available, tap to add"

   Show realistic example:
   - 11:00: 王小明 — 男士剪髮, VIP
   - 12:00: empty (dashed)
   - 13:00-15:00: 李大華 — 溫塑燙 (3 rows, tinted card), 常客
   - 16:00: empty
   - 17:00: 張美玲 — 女士剪髮, 新客
   - 18:00: empty
   - 19:00: 陳先生 — 男士剪髮, 常客

   The time-indicator line sits between 14:00 and 15:00.

4. BOTTOM TAB BAR (sticky, 3 tabs):
   - Active: 日曆 — primary brand color icon + label, small indicator line above
   - Inactive: 報表, 更多 — muted color
   - Icons: outline/line style, never filled
   - Warm background, subtle top border

Overall feel: calm, dense but readable. A craftsman's scheduling board. NOT a consumer app, NOT a generic SaaS dashboard. This is a professional tool with taste.
```

---

## Prompt 2/10 — 週視角

```
Design the weekly calendar view for a mobile admin app called "1008 Hair Studio", a premium hair salon in Taipei.

Aesthetic: Botanical Minimalist — deep green primary, warm off-white background (never pure white), soft sand neutral for surfaces. Muted organic status colors. No gradients, no heavy shadows. Dense but readable. Fonts: clean geometric sans-serif + Noto Sans TC. Device: iPhone 14 Pro, 393×852px.

This is the week view — a 7-column × 9-row grid, like Google Calendar's week view on mobile.

Layout from top to bottom:

1. TOP BAR:
   - Date range: "◀ 4/14 — 4/20 週 ▶"
   - View switcher: [日] [週] [月] — "週" is active (filled brand color + light text)

2. COLUMN HEADERS:
   - 7 columns: 一 二 三 四 五 六 日
   - Below each: date number (14, 15, 16...)
   - Today's date has a filled circle behind it in primary brand color
   - Compact font: 11px weekday, 13px date

3. TIME GRID:
   - Left: time labels 11-19 in muted text, 10px
   - 7 columns × 9 rows, each cell ~50px wide × 40px tall
   - Cells with bookings: filled with primary brand color at LOW OPACITY (subtle green blocks)
   - Multi-hour bookings: connected block spanning multiple rows, slightly darker
   - Empty cells: warm off-white, no border
   - Holiday column (週六): entire column dimmed with neutral background, "休" centered in muted text
   - Grid lines: extremely subtle, thin neutral

   Realistic data:
   - Most days: 5-7 bookings scattered
   - 週四: almost full (8/9 slots filled)
   - 週六: marked as 休 (holiday)

4. SUMMARY: "本週: 30 預約 | NT$38,400" — neutral background strip

5. BOTTOM TAB BAR: 日曆 (active), 報表, 更多

The grid is a heat map of the week. On mobile, cells show only colored blocks — no text inside cells. The owner scans the density pattern to see which days are busy.
```

---

## Prompt 3/10 — 月視角

```
Design the monthly calendar view for a mobile admin app called "1008 Hair Studio", a premium hair salon in Taipei.

Aesthetic: Botanical Minimalist — deep green primary, warm off-white background, soft neutral surfaces. No gradients, no shadows. Device: iPhone 14 Pro, 393×852px.

This is the month overview — each day shows how busy it is at a glance.

Layout:

1. TOP BAR:
   - "◀ 2026 年 4 月 ▶" centered, SemiBold in primary brand color
   - View switcher: [日] [週] [月] — "月" active

2. WEEKDAY HEADERS: 日 一 二 三 四 五 六

3. CALENDAR GRID (6 rows × 7 columns for April 2026):
   Each cell ~53px wide × 56px tall, containing:
   - Date number: top-left, SemiBold
   - Booking count: centered number (e.g., "5")
   - BUSY INDICATOR BAR at bottom: 4px tall horizontal bar using the primary brand color at different opacities:
     * 0-3 bookings: very faint (barely visible)
     * 4-6 bookings: medium opacity
     * 7+ bookings: strong/dark
     * 0 bookings: no bar
   - This uses opacity variation of ONE color (not traffic-light red/yellow/green) — colorblind accessible

   TODAY: date number inside a small filled circle in primary brand color with contrasting text
   HOLIDAY: neutral dimmed background, "休" text instead of count
   Outside-month dates: very faded

   Example data: vary between 0-8 bookings per day. Saturdays = 休.

4. MONTHLY SUMMARY: "本月: 預約 142 | 營收 NT$156,800"

5. BOTTOM TAB BAR: 日曆 (active), 報表, 更多

The month view is a quick density scan — dark bars = full days, light bars = open days. The owner glances at this to plan the week ahead.
```

---

## Prompt 4/10 — 預約詳情 Bottom Sheet

```
Design a bottom sheet overlay for viewing a booking detail in a mobile admin app called "1008 Hair Studio", a premium hair salon in Taipei.

Aesthetic: Botanical Minimalist — deep green primary, warm off-white background, soft sand surfaces. Muted organic status colors (moss green for success, amber for warning, terracotta for error). Buttons: rectangular with small radius (4-8px), never fully rounded. Device: iPhone 14 Pro.

This bottom sheet slides up when the owner taps a booking on the calendar. Semi-transparent dark backdrop behind.

Sheet specs: warm off-white background, 16px top corner radius, drag handle pill at top.

Content layout:

1. HEADER:
   - "王小明" — 18px Bold, primary color (most prominent)
   - VIP badge: warm amber/gold pill

2. SERVICE + TIME:
   - "男士剪髮 · NT$1,000"
   - "11:00 — 12:00" in muted text

3. STATS: "來訪 12 次 · 上次: 3/28" in muted text

4. NOTES SECTION:
   - Label "備註" in small uppercase muted text
   - "喜歡短一點，頭皮比較敏感" — in a soft neutral background card (8px radius)

5. ACTION BUTTONS — this layout is critical for preventing mis-taps:

   Row 1 (primary, biggest):
   - "完成 (現金)" — FULL WIDTH large button (48px height), filled primary brand color + light text. This is the fast path — 80% of bookings.

   Row 2 (secondary, smaller, 3 buttons in a row with 12px gaps):
   - "完成 (轉帳)" — outline button
   - "改時間" — outline button
   - "取消" — outline button in a warm red/terracotta destructive color

   Row 3 (tertiary, separated by at least 24px from above):
   - "未到" — text-only link in terracotta red color, deliberately far from "完成" button

6. "查看客人" — text link at bottom with arrow icon

Sheet takes ~60% of screen height. Backdrop shows dimmed calendar behind.
```

---

## Prompt 5/10 — 新增預約 Bottom Sheet

```
Design a bottom sheet form for creating a new booking in a mobile admin app called "1008 Hair Studio", a premium hair salon in Taipei.

Aesthetic: Botanical Minimalist — deep green primary, warm off-white background. Inputs use bottom-line style (underline only, no full border). Device: iPhone 14 Pro.

This appears when the owner taps an empty time slot. Date and time are pre-filled. The form must be completable in under 30 seconds — the owner is on the phone with a customer.

Sheet: warm off-white bg, 16px top radius, drag handle.

Content:

1. HEADER: "新增預約" — 18px Bold
   Pre-filled: "4/13 (日) 16:00" — muted text below

2. SOURCE TOGGLE: [電話] [現場]
   - Active: filled primary + light text
   - Inactive: neutral bg + primary text
   - "電話" pre-selected

3. CUSTOMER NAME:
   - Label "客人姓名" — small muted uppercase
   - Input with bottom-line only style
   - Autocomplete dropdown below input when typing:
     - Matching customers with name + segment badge + visit count
     - "王小明  VIP · 12次"
     - Selecting auto-fills phone

4. PHONE: bottom-line input, auto-filled if existing customer

5. SERVICE SELECTOR:
   - Label "選擇服務"
   - Dropdown showing: service name + duration + price
   - "男士剪髮 · 60分 · NT$1,000"

6. NOTES: multi-line text area, neutral bg, 8px radius
   Placeholder: "輸入備註（選填）"

7. BUTTONS:
   - "取消" — text button, left
   - "確認新增" — filled primary button, right

Fast and minimal. The autocomplete search is the key — it saves the most time.
```

---

## Prompt 6/10 — 結案確認 + 快速筆記

```
Design a two-state bottom sheet for completing a booking in a mobile admin app called "1008 Hair Studio".

Aesthetic: Botanical Minimalist — warm off-white, deep green primary, moss green for success checkmarks. Device: iPhone 14 Pro.

Show TWO STATES side by side:

STATE 1 — "Confirm + Notes" (appears after tapping "完成(現金)"):
- Success checkmark icon: moss/forest green, 48px circle
- "預約已完成！" — 18px Bold
- "王小明 — 男士剪髮" — regular muted
- Subtle divider

- Label "順手記一下" — small muted text
- Text area: 3 rows, neutral bg, 8px radius, placeholder "今天的服務筆記..."
- Previous note hint below: "上次筆記: 喜歡短一點，頭皮敏感" — 12px italic, very muted

- Buttons:
  - "跳過" — muted text button, left
  - "儲存筆記" — filled primary button, right

STATE 2 — "Saved" (brief 2-second confirmation):
- Large green checkmark
- "筆記已儲存" — SemiBold
- This auto-dismisses, returning to calendar

The whole flow: tap 完成 → State 1 → write or skip → State 2 flashes → back to calendar. Under 10 seconds for the fast path.
```

---

## Prompt 7/10 — 報表頁

```
Design a mobile analytics dashboard for "1008 Hair Studio", a premium hair salon admin app in Taipei.

Aesthetic: Botanical Minimalist — deep green primary for charts and headings, warm off-white background, soft neutral card backgrounds. Charts use the brand green as primary chart color with opacity variations. Status comparisons: green for positive trends, warm red for negative. No gradients, no 3D charts. Clean, editorial feel like a well-designed annual report. Device: iPhone 14 Pro.

Scrollable dashboard the owner checks in the evening:

1. HEADER: "報表" — 20px Bold
   Period selector: [本週] [本月] [今年] — segment buttons

2. STAT CARDS (2×2 grid, 12px gap):
   Each card: neutral bg, 12px radius, 16px padding
   - "營收" — NT$32,600, "↑ 12%" in green
   - "預約數" — 28, "↑ 3"
   - "佔用率" — 72%, "↑ 5%"
   - "新客數" — 5, "↑ 2"
   Large numbers prominent, labels small and muted. Negative trends use warm red with ↓.

3. DAILY REVENUE BAR CHART:
   - "每日營收趨勢" section title
   - 7 bars (一 to 日), brand color at 70% opacity
   - Simple: no grid lines, just bars and labels

4. PEAK HOURS HEATMAP:
   - "尖峰時段" section title
   - 7 columns (一-日) × 9 rows (11:00-19:00)
   - Cell color: brand color at varying opacity based on booking density
   - Think of it as a heat map — darker = more bookings

5. TOP SERVICES:
   - "熱門服務" — horizontal bars
   - 男士剪髮 65%, 女士剪髮 20%, 溫塑燙 10%, 染髮 5%

6. CUSTOMER SEGMENTS:
   - "客群分佈" — single stacked horizontal bar
   - VIP / 常客 / 新客 / 流失中 / 已流失 — each in a different tone from the palette
   - Legend below

7. BOTTOM TAB BAR: 日曆, 報表 (active), 更多
```

---

## Prompt 8/10 — 更多頁

```
Design a "More" menu page for a mobile admin app called "1008 Hair Studio", a premium hair salon in Taipei.

Aesthetic: Botanical Minimalist — deep green primary, warm off-white background. Icons: outline/line style only (like Lucide icons). Device: iPhone 14 Pro.

This is the third tab — a clean navigation hub listing all secondary features.

1. HEADER: "更多" — 20px Bold

2. MENU ITEMS (vertical list):
   Each row: 56px height, full width
   - Left: outline icon (20px)
   - Center: label text, 16px
   - Right: chevron-right icon, very muted
   - Bottom: subtle 1px separator

   Items in order:
   - Users icon → "顧客管理"
   - Scissors icon → "服務項目管理"
   - Megaphone icon → "行銷推播"
   - Calendar-clock icon → "營業時間與公休"
   - Download icon → "匯出資料"
   - Settings icon → "店鋪設定"

3. Separator gap (24px)

4. "登出" — center-aligned text button in warm red/terracotta

5. "v1.0" — tiny centered text, very faded

6. BOTTOM TAB BAR: 日曆, 報表, 更多 (active)

Clean and organized. Like a table of contents, not a settings dump.
```

---

## Prompt 9/10 — 顧客列表

```
Design a customer list page for a mobile admin app called "1008 Hair Studio", a premium hair salon in Taipei.

Aesthetic: Botanical Minimalist — deep green primary, warm off-white background. Segment badges use distinct but muted tones: warm gold for VIP, moss green for regular, brand green for new, amber for at-risk, terracotta for lapsed. Device: iPhone 14 Pro.

Accessed from "更多 → 顧客管理". Back arrow in top bar.

1. TOP BAR: ◀ back + "顧客" title

2. SEARCH BAR: neutral background, 8px radius, 44px height
   Placeholder: "搜尋姓名或電話"
   Search icon inside field

3. FILTER CHIPS (horizontal scroll):
   全部, 新客, 常客, VIP, 流失中, 已流失
   - Active: filled primary + light text
   - Inactive: neutral bg + primary text
   - "全部" default selected

4. CUSTOMER LIST:
   Each row 72px:
   - Left: circular avatar (40px), neutral bg with first character
   - Center: name (16px SemiBold) + meta line "12 次 · 上次 4/10 · 2天前" (12px muted)
   - Right: segment badge pill

   6 example rows:
   - 王小明 — VIP — 12次 · 2天前
   - 李大華 — 常客 — 5次 · 5天前
   - 張美玲 — 新客 — 1次 · 今天
   - 陳先生 — 流失中 — 3次 · 57天前
   - 林小姐 — VIP — 8次 · 3天前
   - 趙大明 — 已流失 — 2次 · 130天前

   Subtle separators between rows.

5. No bottom tab bar (sub-page).
```

---

## Prompt 10/10 — 顧客詳情

```
Design a customer detail page for a mobile admin app called "1008 Hair Studio", a premium hair salon in Taipei.

Aesthetic: Botanical Minimalist — deep green primary, warm off-white background, soft neutral cards. Device: iPhone 14 Pro.

This is the owner's "customer card" — everything about one person.

1. TOP BAR: ◀ back + "王小明" + VIP badge

2. STATS CARD (neutral bg, 12px radius):
   - "12 次" label "來訪" / "NT$15,600" label "總消費"
   - Phone: "0912-345-678" tappable
   - Birthday: "68/05/15"

3. NOTES SECTION (the star of this page — make it prominent):
   - Header: "備註" + "+ 新增" text button
   - Timeline-style notes with date stamps and a connecting vertical line:
     * 4/10 — "喜歡短一點，頭皮比較敏感。上次建議他試染髮，有興趣"
     * 3/15 — "髮質偏細軟，瀏海要留長"
     * 2/20 — "第一次來，朋友介紹的"
   - Neutral background card, 12px radius

4. BOOKING HISTORY:
   - "預約歷史" section title
   - List: date | service | price | status check icon
   - 5 entries, newest first
   - "查看更多" link

5. VIOLATION SECTION:
   - "違規紀錄: 0 次"
   - "清除違規" muted text link

6. No bottom tab bar (sub-page).

The notes section should feel like a personal journal. It's where the owner's knowledge about each customer lives — make it the visual focal point.
```

---

## 產出後的下一步

1. 逐頁在 Stitch 生成 → 微調配色和細節到滿意
2. 每頁下載 PNG
3. 如果 Stitch 找到了一個好的色彩組合，可以把它反向更新到品牌設計規範
4. 帶著滿意的設計回來，開始 Wave 1 實作
