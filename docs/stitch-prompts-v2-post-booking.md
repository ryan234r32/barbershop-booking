# 預約後旅程 Stitch Prompt（新增/更新頁面）

> **用途：** 一次一頁貼到 Google Stitch，產出 1008 Hair Studio 預約後旅程的新頁面
> **與現有 prompt 的關係：** `LINE-LIFF頁面設計-Stitch-Prompt.md` 已有 10 頁基礎頁面，本檔案是新增的 6 頁
> **品牌規範：** 同前，植物系極簡主義 (Botanical Minimalist)
> **最後更新：** 2026-04-12

---

## 通用品牌背景（已嵌入每個 prompt）

```
Brand: "1008 Hair Studio" — premium solo hair salon in Taipei, Taiwan
Style: Botanical Minimalist (Apple Store x Aesop x Kinfolk Magazine x Muji)
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

## Prompt 1/6 — 取消確認頁（可取消狀態，≥ 24h）

```
Design a full-page mobile cancellation confirmation screen for "1008 Hair Studio", a premium hair salon booking app in Taiwan. This page opens inside LINE's mobile browser (LIFF).

Brand: "1008 Hair Studio" — Botanical Minimalist.
Colors: Primary #003D2B (deep forest green), Background #FFF8F1 (warm ivory — never pure white), Surface #F3ECE4 (soft sand), Success #4A7C59, Warning #C88B3B, Error #A84A3B
Fonts: Manrope (Latin) + Noto Sans TC (Chinese). Buttons: rectangular 4-8px radius only.

CRITICAL DESIGN PRINCIPLE: "Reschedule over Cancel" — the page should visually encourage rescheduling BEFORE cancelling. This is the #1 design pattern from Fresha/Booksy/GlossGenius that reduces no-shows by up to 89%.

Layout from top to bottom:

1. HEADER (fixed top):
   - Left: back arrow "←" + "返回" text in #003D2B
   - Right: close (X) icon, thin outline
   - Height: 56px, background #FFF8F1/80 with backdrop-blur

2. BOOKING SUMMARY CARD (top section):
   - #F3ECE4 background, 12px radius, 20px padding
   - Service name "男性剪髮" in #003D2B, Bold, XL size
   - Date + time: "4/15 (二) · 14:00 — 15:00" in #2D3A30
   - Thin separator line
   - Price: label "應付金額" small muted + "NT$1,000" large #003D2B Bold
   - Status badge "即將到來" in small uppercase, #003D2B bg, #FFF8F1 text, rounded-sm

3. RESCHEDULE SUGGESTION SECTION (prominent, above cancel):
   - 32px gap above
   - #FFF8F1 background with 2px #003D2B left border accent (like a quote block)
   - 20px padding
   - Icon: a calendar with arrow icon, thin outline #003D2B
   - Title: "改到其他時間？" in #003D2B SemiBold
   - Subtitle: "不用取消，直接選新時段就好" in muted rgba(0,61,43,0.5)
   - Large button: "選擇新時段" — PRIMARY style: #003D2B background, #FFF8F1 text, full-width, 48px height
   - This section should feel like the RECOMMENDED action — more prominent than the cancel section below

4. DIVIDER:
   - A thin horizontal line with "或" (or) text centered in a small circle, muted styling
   - Creates clear visual separation between reschedule (above) and cancel (below)

5. CANCEL SECTION (below, intentionally less prominent):
   - Section title: "取消預約" in #003D2B, smaller than the reschedule title
   - Green info banner (#4A7C59/10 background, #4A7C59 text, 8px radius):
     - Checkmark icon + "此預約可免費取消（距離預約超過 24 小時）"
   - 16px gap
   - Cancel policy summary in small muted text:
     - "取消後時段將釋出給其他客人"
   - 24px gap
   - Cancel button: "確認取消預約" — SECONDARY style: transparent background, 1.5px #A84A3B border, #A84A3B text (terracotta red, intentionally less inviting than the reschedule button above)
   - The cancel button should feel like "you can do this, but are you sure?" — NOT prominent

6. BOTTOM SAFE AREA: 24px padding for iPhone home indicator

The overall visual hierarchy should clearly guide the eye: booking details → reschedule suggestion (prominent, encouraging) → cancel option (available but secondary). The user should FEEL that rescheduling is the better choice.

Device: iPhone 14 Pro Max, 430×932px. All text in Traditional Chinese.
```

---

## Prompt 2/6 — 取消確認頁（不可線上取消狀態，< 24h）

```
Design a full-page mobile screen showing that online cancellation is NOT available for "1008 Hair Studio". This is the state shown when the appointment is less than 24 hours away.

Brand: "1008 Hair Studio" — Botanical Minimalist.
Colors: Primary #003D2B, Background #FFF8F1 (warm ivory — never pure white), Surface #F3ECE4, Warning #C88B3B
Fonts: Manrope + Noto Sans TC. Buttons: rectangular 4-8px radius.

This page replaces the normal cancel flow when it's too late to cancel online (within 24 hours of the appointment).

Layout from top to bottom:

1. HEADER: same as cancel page — back arrow + close button, 56px height

2. BOOKING SUMMARY CARD: same as cancel page
   - #F3ECE4 background, 12px radius
   - "男性剪髮" / "4/15 (二) · 14:00 — 15:00" / "NT$1,000"

3. RESCHEDULE SUGGESTION (same as cancel page, still prominent):
   - Left border accent block
   - "改到其他時間？" + "選擇新時段" primary button
   - Still the recommended action

4. DIVIDER with "或" centered

5. CANNOT CANCEL ONLINE SECTION:
   - Amber warning banner (#C88B3B/10 background, #C88B3B text, 8px radius):
     - Phone icon + "24 小時內的取消，請致電店家"
   - 24px gap below
   - Large phone number display:
     - "📞 02-2396-2306" in #003D2B, Bold, large size (like a heading)
     - This should be a tappable tel: link — show it as an underlined or button-like element
   - Below the phone number:
     - "營業時間 11:00 — 20:00" in small muted text
   - 24px gap
   - Info box (#F3ECE4, 12px radius, 16px padding):
     - Small info icon
     - "24 小時內未到店且未致電取消，將記錄為一次違規（目前 0/3 次）"
     - Muted text, wrapped

6. NO CANCEL BUTTON — the cancel button is completely removed in this state. Only the phone number and reschedule option are available.

7. BOTTOM: "返回我的預約" text link, centered, muted, underlined

The mood should be: "We understand things come up — here's how to handle it." Not punitive, but clear about the rules. The phone number should be the most prominent actionable element (after the reschedule button).

Device: iPhone 14 Pro Max, 430×932px. All text Traditional Chinese.
```

---

## Prompt 3/6 — 取消成功狀態

```
Design a mobile cancellation success screen for "1008 Hair Studio", shown after a booking is successfully cancelled.

Brand: "1008 Hair Studio" — Botanical Minimalist.
Colors: Primary #003D2B, Background #FFF8F1, Surface #F3ECE4
Fonts: Manrope + Noto Sans TC. Buttons: rectangular 4-8px radius.

DESIGN PRINCIPLE: After cancellation, immediately offer rebooking. Fresha and Booksy both show a "Book Again" button right on the success screen to capture re-engagement intent.

Layout — centered, clean, lots of whitespace:

1. Large whitespace at top (80px+)

2. Icon: A simple circle outline in #003D2B with a checkmark inside, thin 2px strokes. Subtle, not celebratory (this is a cancellation, not a success to celebrate).

3. Title: "預約已取消" in #003D2B Bold, large, letter-spacing 0.03em

4. Subtitle: "4/15 (二) 14:00 的男性剪髮已取消" in muted rgba(0,61,43,0.5), centered, wrapped

5. 40px gap

6. REBOOK SUGGESTION CARD:
   - #F3ECE4 background, 12px radius, 24px padding, centered content
   - Small calendar icon in #003D2B
   - Text: "想要重新預約嗎？" in #003D2B SemiBold
   - Subtitle: "我們隨時歡迎您" in muted
   - 16px gap
   - Button: "重新預約" — PRIMARY style, #003D2B bg, #FFF8F1 text, full-width inside the card

7. 24px gap

8. Secondary link: "返回 LINE" — text link, muted, underlined, centered (calls liff.closeWindow)

The tone is gentle and warm — "We're sorry to see you go, but we're here whenever you're ready." The rebook button should feel inviting, not pushy.

Device: iPhone 14 Pro Max, 430×932px. All text Traditional Chinese.
```

---

## Prompt 4/6 — 改期全頁 LIFF（取代原 Bottom Sheet 版本）

```
Design a full-page mobile rescheduling screen for "1008 Hair Studio". This replaces the previous bottom-sheet design — it's now a dedicated full page inside LINE's mobile browser.

Brand: "1008 Hair Studio" — Botanical Minimalist.
Colors: Primary #003D2B, Background #FFF8F1 (warm ivory — never pure white), Surface #F3ECE4, Warning #C88B3B
Fonts: Manrope + Noto Sans TC. Buttons: rectangular 4-8px radius.

The customer is rescheduling an existing booking. The service stays the same — they only pick a new date and time.

Layout from top to bottom:

1. HEADER (fixed top, 56px):
   - Left: back arrow "←" + "返回" text
   - Center: "改期" in #003D2B Bold
   - Right: close (X) icon
   - Background: #FFF8F1/80 with backdrop-blur

2. CURRENT BOOKING BANNER (fixed below header):
   - #F3ECE4 background, no rounded corners (edge-to-edge), 16px vertical padding, 24px horizontal
   - Left side: "目前預約" label in muted uppercase small text
   - Main text: "4/15 (二) · 14:00 — 15:00" in #003D2B SemiBold
   - Right side: service chip "男性剪髮" in small #003D2B border pill
   - This banner stays visible while scrolling, reminding the user what they're changing FROM

3. SECTION: Choose New Date
   - 24px padding below banner
   - Label "選擇新日期" in #003D2B SemiBold
   - Month calendar (same style as booking page):
     - "‹  4 月 2026  ›" with navigation arrows, "今天" button on right
     - Weekday headers: 一 二 三 四 五 六 日
     - Day grid: April 2026
     - Day 17 SELECTED: solid #003D2B circle, #FFF8F1 text
     - Day 15 (original booking date): special indicator — small dot or different styling to show "this was your original date"
     - Past days and Mondays grayed out
     - Day 12 is TODAY: #003D2B text with small dot below

4. SECTION: Choose New Time
   - Time slots container: #F3ECE4 background, 12px radius, 16px padding
   - Label: "04/17 可預約時間" in muted
   - Sub-label: "下午"
   - Time buttons: [14:00] [15:00] [16:00] [17:00]
   - "16:00" is SELECTED: #003D2B filled, #FFF8F1 text
   - Others: #FFF8F1 bg, #003D2B text, 1px border
   - All buttons: rectangular 8px radius, 44px height minimum

5. CHANGE COMPARISON (appears after selecting new time):
   - Full-width card, #FFF8F1 bg, 1.5px #003D2B border, 12px radius, 20px padding
   - Two rows with arrow between:
     - Row 1: "原時段" label muted + "4/15 (二) 14:00" in #003D2B with strikethrough
     - Arrow icon: "→" or down arrow, #003D2B
     - Row 2: "新時段" label muted + "4/17 (四) 16:00" in #003D2B Bold (emphasized)
   - This card makes the change crystal clear at a glance

6. STICKY BOTTOM BAR (fixed to viewport bottom):
   - #FFF8F1 background, thin #F3ECE4 top border
   - Full-width button: "確認改期" — #003D2B background, #FFF8F1 text, 8px radius, 48px height
   - Button text updates dynamically: "確認改期到 4/17 (四) 16:00"
   - Button disabled (30% opacity) until both date and time are selected
   - Safe area padding below for iPhone home indicator

Overall feeling: clean, focused, reassuring. The user should feel confident they're making the right change. The old→new comparison card is the key UX element that prevents confusion.

Device: iPhone 14 Pro Max, 430×932px. All text Traditional Chinese.
```

---

## Prompt 5/6 — 我的預約（更新版 — 改期優先於取消）

```
Design an UPDATED "My Bookings" screen for "1008 Hair Studio". This is a redesign of the previous version with a critical UX change: "Reschedule before Cancel" button ordering.

Brand: "1008 Hair Studio" — Botanical Minimalist.
Colors: Primary #003D2B, Background #FFF8F1 (warm ivory — never pure white), Surface #F3ECE4, Warning #C88B3B, Success #4A7C59
Fonts: Manrope + Noto Sans TC. Buttons: rectangular 4-8px radius.

CRITICAL DESIGN PRINCIPLE: All top booking systems (Fresha, Booksy, GlossGenius) place the "Reschedule" button BEFORE "Cancel" — making rescheduling more visually prominent. This turns "I'm not coming" into "I'll come later", reducing cancellations by up to 40%.

Layout from top to bottom:

1. HEADER (fixed top):
   - Left: "我的預約" in #003D2B Bold, XL, letter-spacing 0.03em
   - Right: close (X) icon, thin outline #003D2B
   - Height 64px

2. TAB BAR (below header):
   - Two tabs with 32px horizontal spacing:
     - "即將到來" — ACTIVE: #003D2B text, Bold, 2px #003D2B underline
     - "歷史記錄" — INACTIVE: muted rgba(0,61,43,0.5), no underline
   - 40px gap below tabs

3. UPCOMING BOOKING CARD 1 (main card design):
   - #F3ECE4 background, 12px radius, 24px padding
   - Left color accent bar: 3px wide #003D2B, full height of card, left edge
   - Top section:
     - Status badge: "即將到來" — tiny uppercase, letter-spacing 0.1em, #003D2B bg, #FFF8F1 text, rounded-sm
     - Service name: "男性剪髮" — #003D2B Bold, XL (largest text on card)
     - Price: "NT$1,000" — #003D2B Bold, right-aligned, same line as service name
   - Info section (below thin separator):
     - Calendar icon + "4/15 (二)" in #003D2B
     - Clock icon + "14:00 — 15:00" in #003D2B
     - Payment badge: "待付款" — small, #C88B3B/10 bg, #C88B3B text
   - ACTION BUTTONS (the critical redesign):
     - Three buttons in a ROW, evenly spaced:
       1. **"改期"** — LEFT position, #003D2B text, SemiBold, underlined, the FIRST button the eye hits (reading left to right in Chinese)
       2. **"付款"** — CENTER position, small outline button: 1px #003D2B border, #003D2B text, 8px radius, padding 8px 16px
       3. **"取消"** — RIGHT position, #C88B3B text (amber), lighter weight, intentionally the LEAST prominent
     - The visual weight goes: 改期 (bold, prominent) > 付款 (button shape draws attention) > 取消 (muted color, least prominent)

4. UPCOMING BOOKING CARD 2 (paid booking):
   - Same layout as Card 1
   - "染髮" / "4/20 (日)" / "11:00 — 14:00" / "NT$2,600"
   - Payment badge: "已付款 ✓" — #4A7C59/10 bg, #4A7C59 text (green)
   - Action buttons: "改期" + "取消" only (no payment button since already paid)

5. BOTTOM SECTION:
   - "需要協助？" in muted text, centered
   - Phone link: "02-2396-2306" in #003D2B, SemiBold, underlined
   - 24px bottom padding

Show ONLY the "即將到來" tab active with these 2 cards. Do NOT show the history tab content.

Device: iPhone 14 Pro Max, 430×932px. All text Traditional Chinese.
```

---

## Prompt 6/6 — Admin 攔截 Modal（老闆端收款確認）

```
Design a mobile modal overlay for a barbershop admin dashboard at "1008 Hair Studio". This is shown to the shop OWNER (not customer) on their phone when they open the admin panel after an appointment has ended.

Brand: "1008 Hair Studio" — Botanical Minimalist.
Colors: Primary #003D2B, Background #FFF8F1 (warm ivory), Surface #F3ECE4, Success #4A7C59, Error #A84A3B
Fonts: Manrope + Noto Sans TC. Buttons: rectangular 4-8px radius.

PURPOSE: After each appointment time passes, the owner must confirm whether the customer showed up and paid. This modal FORCES the owner to take action before they can use the dashboard. "Confirm payment = Confirm attendance" — one action solves both problems.

The modal is NOT dismissible — there is no X button and tapping the backdrop does nothing. The owner MUST process every booking before continuing.

Layout:

1. BACKDROP: rgba(45, 58, 48, 0.6) — semi-transparent dark green, covering the entire screen. The admin dashboard is barely visible behind it.

2. MODAL CARD (centered vertically, 90% width):
   - #FFF8F1 background, 12px radius, 24px padding
   - No close button, no X — this is intentional (forced action)

3. MODAL HEADER:
   - Title: "請確認預約狀態" in #003D2B Bold, large
   - Subtitle: "有 2 筆預約需要確認" in muted rgba(0,61,43,0.5)
   - Progress indicator: "1 / 2" in small #003D2B text, right-aligned

4. BOOKING INFO (the current booking being confirmed):
   - 16px gap below header
   - Thin #F3ECE4 separator line
   - 16px gap
   - Customer avatar circle: 48px, #F3ECE4 bg, first character of name "王" in #003D2B centered (like a monogram)
   - Customer name: "王小明" in #003D2B SemiBold, next to avatar
   - Below name, info rows:
     - "男性剪髮" — service name in #2D3A30
     - "14:00 — 15:00" — time in #2D3A30
     - "NT$1,000" — price in #003D2B SemiBold
   - Small muted text: "預約時間已過 2 小時" in rgba(0,61,43,0.3)

5. ACTION BUTTONS (the two main choices):
   - 24px gap above buttons
   - Two buttons side by side, equal width, 12px gap between:
     - LEFT: "已收款 ✓" — #4A7C59 (success green) background, #FFF8F1 text, Bold, 52px height, 8px radius
     - RIGHT: "未到 ✗" — transparent bg, 1.5px #A84A3B (terracotta) border, #A84A3B text, Bold, 52px height, 8px radius
   - The "已收款" button should feel like the default/expected action (more prominent fill color)
   - The "未到" button should feel like the exception (outline only, red-ish)

6. BOTTOM NOTE (inside modal):
   - 16px gap below buttons
   - Small muted text: "確認後將自動更新客人狀態" in rgba(0,61,43,0.3)

SECOND STATE (after pressing "已收款" on first booking):
Show the modal transitioning to the second booking with:
- Progress "2 / 2"
- Different customer: "李小華" / "女性染髮" / "11:00 — 14:00" / "NT$2,600"
- Same two action buttons

The modal should feel efficient and quick — the owner is busy cutting hair, they need to tap-tap-done in under 10 seconds. Large buttons, clear choices, minimal reading.

Device: iPhone 14 Pro Max, 430×932px. All text Traditional Chinese.
```

---

## 快速清單

| # | Prompt | 頁面類型 | 對應 Plan Phase | 與現有 prompt 關係 |
|---|--------|---------|----------------|-------------------|
| 1 | 取消確認（可取消） | 全頁 LIFF | Phase 2 | **全新** — 現有 Prompt 8 只是政策 Bottom Sheet |
| 2 | 取消確認（不可取消） | 全頁 LIFF | Phase 2 | **全新** — 顯示打電話提示 |
| 3 | 取消成功 | 全頁 LIFF | Phase 2 | **全新** — 含重新預約按鈕 |
| 4 | 改期頁（全頁） | 全頁 LIFF | Phase 4 | **取代**現有 Prompt 7（Bottom Sheet → 全頁）|
| 5 | 我的預約（更新版） | 全頁 LIFF | Phase 3 | **更新**現有 Prompt 6（改期優先於取消）|
| 6 | Admin 攔截 Modal | Modal overlay | Phase 5 | **全新** — 老闆端 |

---

## 不需要重做的頁面（現有 prompt 已涵蓋）

以下頁面在 `LINE-LIFF頁面設計-Stitch-Prompt.md` 已有完整 prompt，不用重做：

- Prompt 1: 載入畫面
- Prompt 2: 預約上半（服務選擇）
- Prompt 3: 預約下半（日曆+時段+確認）
- Prompt 4: 首次資料收集 Bottom Sheet
- Prompt 5: 預約成功 → **小更新**：在 Stitch 微調時追加「Add a "前往付款" primary button above "加入行事曆"」
- Prompt 8: 取消政策 Bottom Sheet → 保留作為資訊展示用
- Prompt 9: 付款頁
- Prompt 10: 候補 + 錯誤狀態

---

## 使用順序建議

1. 先跑 **Prompt 5（我的預約更新版）** — 這是使用者最常看到的頁面
2. 再跑 **Prompt 4（改期全頁）** — 核心新功能
3. 再跑 **Prompt 1（取消確認 - 可取消）** — 設計最複雜的頁面
4. 再跑 **Prompt 2（取消確認 - 不可取消）** — Prompt 1 的變體
5. 再跑 **Prompt 3（取消成功）** — 簡單頁面
6. 最後跑 **Prompt 6（Admin Modal）** — 老闆端，風格略不同
