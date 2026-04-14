# Google Stitch Prompts — 1008 Hair Studio

> **日期:** 2026-04-11
> **用途:** 將下列兩個 prompt 直接貼到 Google Stitch 生成全套 UI mockup
> **語言策略:** Prompt 指令用英文（Stitch 理解較準），UI 文字指定為繁體中文
> **風格策略:** 完全放開，不預設品牌色，讓 Stitch 自由探索

---

## Prompt 1 — Admin Mobile Management App（理髮師手機管理介面）

```
Design a mobile-first management app for the owner of a small Taiwanese barbershop.

APP CONTEXT
- Shop name: 1008 Hair Studio, a one-operator barbershop in Taiwan
- Owner is mid-40s, non-technical, pulls out their phone between haircuts (5-minute gaps)
- Phone-only app, target width 375–430px (iPhone), one-handed use must feel effortless
- Currency: NT$ (新台幣)
- Business hours: 11:00–20:00, 1-hour slots, 9 slots per day
- IMPORTANT: ALL visible UI copy must be in Traditional Chinese (zh-TW). Do not use English labels on buttons, tabs, or screens.

WHO USES IT AND WHY
The owner opens the app to quickly:
1. See what's left on today's schedule
2. Mark a customer as 已完成 or 爽約 with one tap
3. Answer a phone call and create a booking on the spot
4. Check who hasn't visited in a while (at-risk customers)
5. Review this week's revenue

GENERATE THESE 12 SCREENS

1) Login 登入
   - Shop logo at top
   - Email field, password field
   - 「記住我」 checkbox
   - Primary button 登入
   - Small link 忘記密碼

2) Today 今日（main landing screen）
   - Header with date and weekday e.g. 2026年4月11日 週六
   - Three stat cards in a row: 今日預約 8 / 已完成 3 / 預計收入 NT$ 6,800
   - Vertical timeline of the day's hourly slots from 11:00 to 20:00
   - Booking card per slot showing: time, customer name, service name, price, and a badge (新客 / 熟客 / VIP), plus "第 N 次光顧"
   - Past slots are dimmed; current slot is highlighted; future slots are bright
   - Empty slots rendered as a dashed box "空檔 · 可休息或插單"
   - Each upcoming booking card has two quick action buttons: ✓ 完成 and ✕ 爽約
   - Floating action button bottom-right: + 新增預約
   - Bottom tab bar (4 tabs): 今日 · 行事曆 · 客戶 · 更多

3) Calendar 行事曆
   - Top segmented control: 週 / 月
   - Month grid with colored dots showing booking density per day
   - Tap a date to reveal a bottom sheet with that day's booking list
   - Holidays visually marked with 休
   - Today's date has a clear marker

4) Booking list 預約管理
   - Search bar at top
   - Horizontal filter chips: 全部 / 今天 / 本週 / 已確認 / 已完成 / 已取消 / 爽約
   - List rows, each showing: date · time · customer · service · status pill
   - Status pill colors: 已確認 blue, 已完成 green, 爽約 red, 已取消 grey
   - Pull-to-refresh affordance visible

5) Booking detail 預約詳情
   - Customer avatar, name, phone, segment badge at top
   - Service card (service name, duration 分鐘, price NT$)
   - Date and start–end time row
   - Source pill: LIFF / 後台新增 / 電話預約 / 現場
   - Notes section 備註
   - Large action buttons area: 完成服務 (primary) / 標記爽約 (warning) / 管理員取消 (destructive)
   - Tapping 管理員取消 opens a confirmation sheet with a reason field

6) Create booking 手動新增預約
   - Step-by-step form: 客戶 → 服務 → 日期 → 時段 → 備註
   - Step 1: customer picker with search; 新客戶 button creates a walk-in
   - Step 2: service grid with names and prices
   - Step 3: horizontal scrollable date strip (next 30 days)
   - Step 4: time-slot grid; unavailable slots greyed out; multi-slot services show occupied range
   - Step 5: notes text area
   - Source auto-tagged as 電話預約 or 現場
   - Sticky bottom 確認新增

7) Customer list 客戶
   - Search bar (姓名 / 電話)
   - Filter chips: 全部 / 新客 / 熟客 / VIP / 沉睡 / 流失
   - Customer rows: avatar, name, segment badge, 來訪 12 次, 最後來訪 2026/03/21, 違規 1
   - Infinite scroll

8) Customer detail 客戶詳情
   - Header: avatar, name, segment badge, phone
   - Stats row: 總預約 / 已完成 / 爽約 / 違規
   - Tabs: 基本資料 / 預約歷史 / 違規紀錄 / 標籤備註
   - Booking history rendered as a timeline
   - Action buttons: 加入黑名單 / 重置違規

9) Service management 服務管理
   - List of services with drag handles to reorder
   - Each row: 名稱, 時長, 價格, 啟用 toggle
   - Tap a row to edit (名稱, 描述, 時長分鐘, 佔用時段數, 價格, 排序)
   - FAB 新增服務

10) Business settings 營業設定
    - Section 1 商家資訊: 店名, 電話, 地址, 銀行帳戶資訊 (銀行 / 戶名 / 帳號)
    - Section 2 營業時間: 7 rows for 週一 to 週日, each with start and end time pickers and an 公休 toggle
    - Section 3 假日管理: list of dates with add button, each row shows date and reason
    - Sticky bottom save bar 儲存設定

11) Analytics 數據分析
    - Date range selector: 本週 / 本月 / 自訂
    - Top stat cards: 總預約 / 已完成 / 取消 / 爽約 / 營收 / 新客
    - Bar chart: 每日預約趨勢
    - Donut chart: 客戶分群分佈 (新客 / 熟客 / VIP / 沉睡 / 流失)
    - Ranked list: 熱門服務 TOP 5

12) Campaigns 行銷推播
    - Segment picker with live count badges: 全部 / 新客 / 熟客 / VIP / 沉睡 / 流失
    - Message composer (text area with live character count)
    - Live preview of the LINE flex message bubble as the user types
    - Primary button 發送推播
    - History list below: previous campaigns with sent date, segment, open rate

STYLE DIRECTION
Explore your own aesthetic. Imagine a calm, confident brand for a trusted neighborhood barbershop. Typography should be generous and legible for a mid-40s user. Optimize spacing and tap targets for one-handed use. Pick a palette you think is best — I am not prescribing brand colors. All UI strings must be in Traditional Chinese.
```

---

## Prompt 2 — LINE LIFF Customer Booking Interface（LINE 使用者預約介面）

```
Design a LINE LIFF (Line Front-end Framework) mobile web flow for customers of a Taiwanese barbershop to book appointments.

APP CONTEXT
- Embedded inside the LINE app — opened via the LINE Official Account rich menu
- Users are Taiwanese LINE users of all ages, phone-only, mostly one-handed
- Fixed viewport: LINE LIFF mobile, 375–430px wide. No desktop layout.
- Payment: cash at store or bank transfer with receipt upload. No online payment gateway.
- Business hours 11:00–20:00, 1-hour slots. Haircut = 1 slot, perm / color = 3–4 consecutive slots.
- User identity comes from LINE automatically — no signup or login screen.
- IMPORTANT: ALL visible UI copy must be in Traditional Chinese (zh-TW). Do not use English labels on buttons, tabs, or screens.

PRIMARY FLOW
A returning customer should complete a booking in under 60 seconds:
選服務 → 選日期 → 選時段 → 確認 → 成功

GENERATE THESE 13 SCREENS

1) Welcome / home 歡迎頁
   - Hero area with shop name "1008 Hair Studio" and a one-line intro
   - Personalized greeting "Hi，王小姐，歡迎回來" (name comes from LINE)
   - Two large primary cards: 立即預約 and 我的預約
   - Secondary links row: 服務項目 / 取消政策 / 聯絡店家
   - Warm, friendly, spacious — this is the first impression

2) Service selection 選擇服務（Step 1/5）
   - Step indicator at top: 服務 · 日期 · 時段 · 確認 · 完成
   - Services grouped under category headers: 剪髮 / 燙髮 / 染髮 / 護髮
   - Each service card shows: 名稱, 簡短描述, 時長 60 分鐘, NT$ 600
   - Tapping a card toggles a selected state with a clear check mark
   - Sticky bottom button 下一步

3) Date selection 選擇日期（Step 2/5）
   - Horizontal scrollable date strip showing the next 30 days
   - Past dates disabled; holidays labeled 休 and disabled
   - Selected date has a strong highlight
   - Helper text below the strip "您選擇的日期：4月15日 週二"
   - Sticky bottom button 下一步

4) Time slot selection 選擇時段（Step 3/5）
   - 1-hour slots as a grid grouped into 上午 / 下午 / 晚上
   - Top 2 recommended slots have a small badge ⭐ 推薦
   - Unavailable slots are greyed out and non-tappable
   - For multi-slot services, selecting a slot shows a helper "您的預約將佔用 14:00 – 17:00"
   - Sticky bottom button 下一步

5) Confirmation 確認預約（Step 4/5）
   - Booking summary card: service name, date, start–end time, price
   - Notes text area "想跟設計師說的話（選填）"
   - Small link 取消政策
   - Sticky bottom button 確認預約

6) Success 預約成功
   - Large animated check icon
   - Booking ID 預約編號 #20260415-0014
   - Full summary (service / date / time / price)
   - Two CTAs: 查看我的預約 and 繼續預約
   - Subtle helper text "我們會在 24 小時與 1 小時前提醒您"

7) My bookings — upcoming 我的預約 · 即將到來
   - Tabs at top: 即將到來 / 歷史紀錄
   - Card list, each card shows: service, date, time, status badge, price
   - Card actions: 詳情 / 取消 / 付款
   - Empty state: illustration + "還沒有預約" + CTA 立即預約

8) My bookings — history 我的預約 · 歷史紀錄
   - Same card style but read-only
   - Past statuses: 已完成 / 已取消 / 未到場
   - Each card has a small 再次預約 button for quick rebooking

9) Cancel booking modal 取消預約
   - Bottom sheet overlay
   - Case A (day before the booking): "確定要取消嗎？此次取消免費，不會記違規"
   - Case B (same day, after business hours): prominent warning box "當日取消將記錄一次違規（目前 1/3）。累積 3 次將限制一個月線上預約。"
   - Optional reason input
   - Buttons: 確認取消 (destructive) / 我再想想

10) Restricted state 已被限制
    - Warning page shown when the user has accumulated 3 violations
    - Large icon with headline "線上預約暫時停用"
    - Explanation "您已累積 3 次違規，請改為電話預約"
    - Shop phone number rendered as a tap-to-call button 撥打電話 02-xxxx-xxxx
    - "解除日期 2026 年 5 月 11 日"

11) Payment · cash 付款 · 現金
    - Top toggle: 現金 (selected) / 銀行轉帳
    - Large info card: 到店付款
    - Amount displayed prominently: NT$ 1,200
    - Helper text "請於到店時直接付款，無需提前操作"
    - Button 回到我的預約

12) Payment · bank transfer 付款 · 銀行轉帳
    - Top toggle: 現金 / 銀行轉帳 (selected)
    - Bank account info card with copy-to-clipboard buttons for each row: 銀行, 戶名, 帳號
    - Amount highlighted NT$ 1,200
    - Upload area 上傳轉帳截圖 (supports file picker)
    - After upload: screenshot thumbnail preview + status badge (待確認 / 已收款)
    - Primary button 送出

13) Service detail 服務詳情
    - Bottom sheet triggered from a service card in screen 2
    - Shows: service name (large), 描述, 時長, 佔用時段數, 價格
    - Primary button 選擇此服務

STYLE DIRECTION
Explore your own aesthetic — do not default to LINE green. Imagine a warm, trustworthy brand for customers of all ages. Typography must be highly legible for older users. Buttons and tap targets should be generous. Pick a palette and type pairing you think is best. All UI strings in Traditional Chinese.
```

---

## 使用建議

1. **一次只貼一個 prompt** — 讓 Stitch 專注生成一種介面，再換下一個
2. **用 Stitch 的 "Refine" 功能迭代** — 第一版生出來後，用「更極簡」「把卡片邊緣改圓一點」這類微調
3. **如果 Stitch 把文字生成為英文** — 補一句 `All UI text must be in Traditional Chinese (zh-TW), no English anywhere.` 強制修正
4. **Stitch 有畫面數量上限** — 若 12/13 張一次生不完，可以拆成兩次各 6–7 張
5. **生出來的結果** 記得存到 `docs/stitch-outputs/` 方便後續 `/design-shotgun` 或 `/plan-design-review` 迭代
