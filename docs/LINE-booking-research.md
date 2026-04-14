# LINE-Based Booking Systems: Industry Research & Best Practices

> Research date: 2026-03-23
> Focus: Hair salon booking systems using LINE in Taiwan/Japan

---

## Table of Contents

1. [Market Landscape](#1-market-landscape)
2. [Competitor Analysis](#2-competitor-analysis)
3. [Customer Journey Best Practices](#3-customer-journey-best-practices)
4. [Rich Menu Design Patterns](#4-rich-menu-design-patterns)
5. [Flex Message Best Practices](#5-flex-message-best-practices)
6. [LINE API Features for Booking Systems](#6-line-api-features-for-booking-systems)
7. [No-Show Prevention Strategies](#7-no-show-prevention-strategies)
8. [CRM & Customer Retention](#8-crm--customer-retention)
9. [LINE MINI App vs LIFF](#9-line-mini-app-vs-liff)
10. [Actionable Recommendations](#10-actionable-recommendations-for-our-system)

---

## 1. Market Landscape

### Taiwan Market Context
- **21 million active LINE users** in Taiwan
- LINE accounts for **95.7% of Taiwan's social messaging usage**
- Verified LINE Official Accounts are available in Japan, Thailand, and Taiwan
- LINE is the de facto communication channel for service businesses

### Key Players in LINE Booking Systems (Taiwan)

| Platform | Target | Pricing | Notable Features |
|----------|--------|---------|------------------|
| **LineBooking.me** | Beauty industry | NT$400-500/calendar/mo | Pure LINE integration, no app needed |
| **HOTCAKE (夯客)** | Beauty + wellness | Tiered plans | 4000+ businesses, 98% retention, deposit management |
| **BeautinQ** (WishMobile) | Beauty industry | Enterprise | Digital membership + LINE reservations |
| **SayDou 集客預約** | Beauty industry | Varies | POS + payroll + O2O integration |
| **SimplyBook.me** | Multi-industry | Free tier + paid | LINE Bot chatbot integration, multi-channel |
| **i-so POS** | Beauty industry | Varies | Automated scheduling + attendance |

### Japan Market Context
- **HOT PEPPER Beauty** dominates salon discovery/booking (70,000+ salons, 250,000+ stylists)
- LINE is used more for **retention and communication** rather than primary booking in Japan
- LINE's official hair salon reservation demo app exists on GitHub as a reference architecture

---

## 2. Competitor Analysis

### LineBooking.me (炫光螞蟻科技)
**Target:** Small-medium beauty businesses in Taiwan

**Core Features:**
- Zero app installation required (everything in LINE chat)
- Service selection with category filtering and add-on options
- "Staff unspecified" booking for flexible scheduling
- Real-time availability display with auto-filtering of full slots
- Automatic reminder notifications before appointments
- Customer photo gallery storage for reference
- Revenue reporting by day/month
- VIP customer identification based on spending
- Customer blocking capabilities ("奧客警示")

**Booking Flow:**
1. Customer adds business LINE account as friend
2. Browse service categories and select options
3. Choose service staff (optional - "不指定" available)
4. Select available time slots (full slots auto-hidden)
5. Submit reservation request
6. Receive shop confirmation via LINE message
7. Get automatic pre-appointment reminder

**Pricing Model:**
- Setup fee: NT$500-1,200 (one-time)
- Monthly: NT$400-500 per calendar (1 calendar per staff member)
- Single stylist = ~NT$500/month
- Three stylists = ~NT$1,200/month

**Key Insight:** LineBooking operates entirely within LINE chat - no LIFF or separate web app. Booking is done through conversational UI with preset messages.

---

### HOTCAKE (夯客)
**Target:** Beauty, wellness, fitness, medical aesthetics

**Scale:** 4,000+ businesses, 1.2M+ consumers served, 98% renewal rate

**Core Features:**
- Automated time calculation: system auto-calculates service duration and available slots
- Guaranteed no booking conflicts
- Four modules: Membership Loyalty, Online/Offline Booking, Consumption Records, LINE OA Integration
- Advanced features: tiered booking, deposit management, unspecified-staff booking, equipment management
- Automated reminders, member management, auto-generated reports
- Online deposit collection

**Differentiation from our system:**
- Supports deposit/prepayment collection (we currently only support cash/transfer)
- Equipment management (relevant if salon has limited wash stations, etc.)
- Tiered booking (different booking rules for different customer levels)
- Full POS integration

---

### SimplyBook.me LINE Integration
**Approach:** Multi-channel SaaS with LINE Bot add-on

**LINE-Specific Features:**
- LINE Bot guides clients through booking process within LINE messenger
- "Book now" button on LINE official account
- Service categories, multiple locations, intake forms supported
- Online payments integrated (taxes not calculated)
- Client login without address requirement

**Setup:** Connect LINE channel via credentials, webhooks, access tokens

**Key Insight:** SimplyBook treats LINE as one channel among many (also supports Google Reserve, Instagram, Facebook). Their LINE bot is a conversational chatbot, not a LIFF app.

---

### LINE Official Recommendations for Beauty Industry (tw.linebiz.com)

LINE Taiwan officially recommends these three partner solutions for beauty businesses:
1. **SayDou 集客預約** - Full suite (reservation + scheduling + membership + POS + payroll + O2O)
2. **夯客 (HOTCAKE)** - Quick setup reservation + member management + POS
3. **i-so POS** - Automated online scheduling + attendance confirmation

**Official LINE features for beauty businesses:**
- 1-to-1 chat with customer tagging (appointment dates, style preferences, birthdays)
- Rich Menu for service/portfolio showcase
- Multi-page messages for designer profiles
- Coupons & raffles for promotions
- Greeting messages for new followers

---

## 3. Customer Journey Best Practices

### Optimal Customer Journey Flow (Synthesized from industry leaders)

```
DISCOVERY                    BOOKING                     PRE-VISIT
──────────                   ───────                     ─────────
QR code at salon       →     Tap Rich Menu "預約"    →   24hr reminder via LINE
Friend search          →     LIFF app opens          →   2hr reminder via LINE
Friend referral link   →     Select service          →   Map/directions link
Instagram bio link     →     Select date/time        →
                             Select stylist           →
                             Confirm booking         →
                             Receive confirmation    →

VISIT                        POST-VISIT                  RE-ENGAGEMENT
─────                        ──────────                  ─────────────
Arrive notification    →     Thank you message       →   30-day re-booking prompt
Service delivery       →     Style care tips         →   60-day "miss you" message
Payment                →     Review request          →   Birthday coupon
                             Next visit suggestion   →   Seasonal promotion
```

### Key Principles

1. **Zero Friction Entry**: No app download, no registration form. LINE friend add = account creation.
2. **Contextual Messaging**: Every message should have a clear CTA (call-to-action) - never just informational.
3. **Progressive Engagement**: Welcome → First booking → Reminder → Post-visit → Re-engagement
4. **Automated Touchpoints**: Minimize manual staff intervention in the communication flow.

### Welcome Message Best Practice
When a new user adds the LINE account as a friend:
- Introduce the shop briefly
- Explain what services are available
- Include a prominent "立即預約" (Book Now) button that opens the LIFF booking app
- Optionally include a first-visit coupon to incentivize immediate booking

**Our current implementation** (`welcomeMessage()` in `messages.ts`) already follows this pattern well with the shop name greeting and LIFF booking URL button.

---

## 4. Rich Menu Design Patterns

### Technical Specifications
- **Size:** 2500 x 1686 pixels (large format) or 2500 x 843 pixels (compact format)
- **Tap areas:** Coordinate-based with x, y, width, height in pixels
- **Max areas:** Up to 20 tappable regions
- **Chat bar text:** Customizable "Tap to open" label

### Recommended Layout for Hair Salon (6-grid large format)

```
┌─────────────────────────────────────────┐
│                                         │
│  ┌──────────┬──────────┬──────────┐     │
│  │          │          │          │     │
│  │  📅 預約  │  📋 我的   │  💇 作品集 │     │
│  │  Book    │  預約     │  Portfolio│     │
│  │  Now     │  My Appts│          │     │
│  │          │          │          │     │
│  ├──────────┼──────────┼──────────┤     │
│  │          │          │          │     │
│  │  📍 地圖  │  📞 電話   │  🎁 優惠   │     │
│  │  Map     │  Call    │  Deals   │     │
│  │          │          │          │     │
│  └──────────┴──────────┴──────────┘     │
│                                         │
│  ─── 點擊開啟選單 ───                     │
└─────────────────────────────────────────┘
```

### Action Mappings

| Button | Action Type | Target |
|--------|-------------|--------|
| 預約 Book Now | URI action | LIFF booking app URL |
| 我的預約 My Appointments | URI action | LIFF my-bookings URL |
| 作品集 Portfolio | URI action | Instagram or LIFF gallery |
| 地圖 Map | URI action | Google Maps link |
| 電話 Call | URI action | `tel:` scheme |
| 優惠 Deals | URI action | LIFF coupon page or message action |

### Per-User Rich Menu Strategy

LINE supports **per-user rich menus** that override the default menu. Use cases:

1. **New vs. Returning Customer**: Show different menus based on booking history
   - New: Emphasize "First Visit Guide" + "Book Now"
   - Returning: Emphasize "Re-book" + "My History" + "Loyalty Points"

2. **Booking State**: Switch menus during active booking flow
   - Before booking: Standard menu
   - Active booking: Show "View Booking" + "Cancel" + "Reschedule"

3. **VIP Treatment**: Different menu for VIP customers
   - Priority booking access
   - Exclusive deals button

### Rich Menu Switching (Tab Pattern)
Using rich menu aliases and `richmenuswitch` action, you can create tab-like navigation:

```json
{
  "type": "richmenuswitch",
  "richMenuAliasId": "richmenu-alias-bookings",
  "data": "richmenu-changed-to-bookings"
}
```

This enables step-based flows where different menus represent different states (browsing vs. booking vs. post-booking), with aliases allowing you to update the underlying menu without changing client logic.

---

## 5. Flex Message Best Practices

### Design Principles
1. **Use Flex Message Simulator** (https://developers.line.biz/flex-simulator/) to prototype before coding
2. **CSS Flexbox model** - Flex Messages follow CSS Flexbox specification
3. **Test across environments** - same Flex Message may render differently on iOS vs Android vs Desktop
4. **Keep `altText` informative** - it shows in notifications and chat previews

### Container Types
- **Bubble**: Single message card (header + hero + body + footer sections)
- **Carousel**: Multiple bubbles that can be swiped horizontally (max 12 bubbles)

### Booking Confirmation Card (Best Practice Structure)

```
┌────────────────────────────┐
│ HEADER (green background)  │
│ ✓ 預約確認                  │
├────────────────────────────┤
│ HERO (optional)            │
│ [Shop logo or stylist      │
│  photo]                    │
├────────────────────────────┤
│ BODY                       │
│ 店名: ABC Hair Salon       │
│ ───────────────            │
│ 服務  剪髮                  │
│ 設計師 David               │
│ 日期  2026/03/25           │
│ 時間  14:00 - 15:00        │
│ 地址  台北市大安區...        │
├────────────────────────────┤
│ FOOTER                     │
│ [查看預約] [取消預約]        │
│ [加入行事曆]                │
└────────────────────────────┘
```

### Enhancement Opportunities for Our Current Messages

Our existing `bookingConfirmationMessage()` is solid but could be enhanced:

1. **Add Footer with Action Buttons**
   - "查看預約" → opens LIFF my-bookings page
   - "取消預約" → opens LIFF cancellation flow
   - "加入行事曆" → URI to Google Calendar event creation

2. **Add Hero Image**
   - Shop logo or stylist profile photo
   - Creates visual brand identity in every message

3. **Add Stylist Information**
   - Include stylist name if specified

4. **Carousel for Multiple Services**
   - When booking includes add-ons, show as carousel bubbles

### Reminder Message Enhancements

Current reminder is text-only. Best practices suggest:
- Add a "查看地圖" (View Map) button for navigation
- Add "需要改期？" (Need to reschedule?) quick action
- Include weather info integration for the appointment day
- Use different urgency styling (yellow for 24hr, red for 2hr)

### Cancellation Message Enhancements
- Add "重新預約" (Re-book) button to immediately capture the rebooking intent
- Show next available time slots in a carousel

---

## 6. LINE API Features for Booking Systems

### Action Types Reference

| Action | Use in Booking System | Quick Reply | Rich Menu | Flex Msg |
|--------|----------------------|-------------|-----------|----------|
| **Postback** | Confirm/cancel booking, select options | Yes | Yes | Yes |
| **Message** | Trigger keyword-based booking flow | Yes | Yes | Yes |
| **URI** | Open LIFF app, call shop, open maps | Yes | Yes | Yes |
| **Datetime Picker** | Select booking date/time | Yes | No | Yes |
| **Camera** | Upload style reference photos | Yes | No | No |
| **Camera Roll** | Upload inspiration photos | Yes | No | No |
| **Location** | Share salon location / get directions | Yes | No | No |
| **Rich Menu Switch** | Navigate between menu states | No | Yes | No |
| **Clipboard** | Copy booking reference number | Yes | Yes | Yes |

### Datetime Picker Action (Highly Relevant)
Prompts native date/time picker without LIFF. Returns selection via postback webhook.

```json
{
  "type": "datetimepicker",
  "label": "選擇日期",
  "data": "action=selectDate&service=haircut",
  "mode": "datetime",
  "initial": "2026-03-25T14:00",
  "min": "2026-03-24T11:00",
  "max": "2026-04-24T20:00"
}
```

**Consideration for our system:** The native datetime picker cannot show which slots are available/unavailable. Our LIFF-based approach with visual slot display is superior for slot-based booking because users need to see availability. The datetime picker is better suited for simpler use cases (e.g., "when would you like a reminder?").

### Quick Reply (Up to 13 buttons)
Best used for:
- Service type selection: "剪髮" / "染髮" / "燙髮"
- Date shortcuts: "今天" / "明天" / "本週六"
- Confirmation: "確認預約" / "修改" / "取消"

```json
{
  "type": "text",
  "text": "請選擇您需要的服務：",
  "quickReply": {
    "items": [
      {
        "type": "action",
        "action": {
          "type": "postback",
          "label": "剪髮 NT$500",
          "data": "action=selectService&serviceId=haircut"
        }
      },
      {
        "type": "action",
        "action": {
          "type": "postback",
          "label": "染髮 NT$2000",
          "data": "action=selectService&serviceId=coloring"
        }
      },
      {
        "type": "action",
        "action": {
          "type": "postback",
          "label": "燙髮 NT$2500",
          "data": "action=selectService&serviceId=perm"
        }
      }
    ]
  }
}
```

### Webhook Events to Handle

| Event | Booking Use Case |
|-------|-----------------|
| `follow` | New friend added → send welcome message + create user |
| `unfollow` | Friend blocked → mark user as inactive |
| `message` (text) | Keyword-based booking ("預約", "取消") |
| `postback` | Handle booking confirmations, cancellations, selections |
| `memberJoined` | Group member joined (less relevant for 1:1) |

### LINE Messaging Types Comparison

| Type | Best For | Limitation |
|------|----------|------------|
| **Reply Message** | Responding to user action | Must reply within ~30 seconds |
| **Push Message** | Proactive notifications (reminders) | Costs message quota |
| **Multicast** | Batch notifications | Up to 500 users per call |
| **Narrowcast** | Targeted segments | Requires audience setup |
| **Broadcast** | All followers | Costs most message quota |

---

## 7. No-Show Prevention Strategies

### Industry Best Practices (Compiled from HOTCAKE, BeautinQ, SimplyBook, LINE Official)

1. **Multi-Stage Reminders**
   - 24 hours before: Full details + map + reschedule option
   - 2 hours before: Quick reminder + navigation link
   - (Our system already implements this via cron jobs)

2. **Deposit/Prepayment System**
   - Collect deposit for high-value services (perm, color = NT$500-1000)
   - Refundable if cancelled 24+ hours before
   - HOTCAKE and BeautinQ both offer this feature
   - **Gap in our system:** We don't currently support deposits

3. **Violation Tracking**
   - Our system already has this (3 violations = restricted)
   - Best practice: warn at violation 2, not just at 3
   - LineBooking.me has "奧客警示" (problem customer alert)

4. **Easy Rescheduling**
   - Make rescheduling easier than cancelling
   - Include "改期" button in reminder messages
   - Show next available slots immediately

5. **Confirmation Required**
   - Some systems require customer to confirm 24 hours before
   - Send "確認出席" button in reminder message
   - If not confirmed, staff can follow up

6. **Customer Tagging**
   - Tag customers with appointment dates for automated reminders
   - Tag no-show history for staff awareness
   - LINE OA supports chat tags natively

---

## 8. CRM & Customer Retention

### LINE-Native CRM Features

**Chat Tags & Segmentation:**
- Tag customers by: visit frequency, preferred services, spending level, last visit date
- Use tags for narrowcast targeting

**Audience Types (Messaging API):**
- User ID Upload Audience: Group by custom criteria from your DB
- Message Click Audience: Users who clicked links in messages
- Message Impression Audience: Users who read messages
- Up to 1,000 audiences per channel, persist for 180 days
- Minimum 50 users for retargeting audiences

**Narrowcast Messaging:**
- Target specific audience segments
- Only available in Japan, Thailand, Taiwan
- Perfect for re-engagement campaigns

### Recommended Re-Engagement Cadence for Hair Salons

| Days Since Last Visit | Segment | Action |
|-----------------------|---------|--------|
| 0 | Just visited | Thank you + care tips + review request |
| 7 | Recent | Style maintenance tips |
| 21-28 | Due for revisit | "Time for a trim?" + easy rebook button |
| 45 | Slipping away | Special offer + "We miss you" |
| 60 | AT_RISK | Stronger incentive + personalized message |
| 90 | LAPSING | "It's been a while" + significant discount |
| 120 | LAPSED | Win-back campaign or accept churn |

**Our system already has CRM segments:** NEW → REGULAR → VIP, AT_RISK (60d), LAPSED (120d). The `/api/cron/at-risk` job handles weekly segmentation updates.

### Loyalty Program Patterns
- **Point/stamp cards**: LINE native reward card feature
- **Tiered membership**: Different service menus for VIP
- **Referral rewards**: Friend invite tracking via LINE
- **Birthday coupons**: Auto-generated coupon on birthday month

---

## 9. LINE MINI App vs LIFF

### Current State (2025-2026)

LINE has announced that **LIFF will be integrated into LINE MINI App** in the future, making them a single brand. For new development, LINE recommends creating LIFF apps as LINE MINI Apps.

### Key Differences

| Feature | LIFF | LINE MINI App |
|---------|------|---------------|
| **Review Required** | No | Yes (LINE certification) |
| **Discovery** | Via shared URL only | MINI HOME in LINE Wallet |
| **Notice Chat Room** | No | Yes (dedicated notification space) |
| **NFC (LINE Touch)** | No | Yes (launch via NFC tag, coming H1 2026) |
| **Shortcut** | No | Add to home screen |
| **Service Messages** | Via Official Account chat | Via MINI App Notice chat room |

### LINE MINI App Advantages for Booking Systems
1. **MINI HOME discovery**: Users can find your booking app from LINE Wallet page
2. **Notice chat room**: Booking confirmations appear in a dedicated space, not mixed with marketing messages
3. **LINE Touch (NFC)**: Customer holds phone to NFC tag at reception → instantly opens booking/check-in page (launching H1 2026)
4. **Better persistence**: App-like experience with persistent state

### Recommendation for Our System
- **Current approach (LIFF) is fine for MVP** - no review process, faster iteration
- **Plan migration to LINE MINI App for V2** when the platform opens fully (Q4 2025 announcement said fully open model)
- The NFC feature (LINE Touch) would be excellent for salon check-in

---

## 10. Actionable Recommendations for Our System

### High Priority (Implement in Current Sprint)

#### 10.1 Rich Menu Setup
Create a 6-grid rich menu with:
- "立即預約" → LIFF booking page
- "我的預約" → LIFF my-bookings page
- "作品集" → Instagram or portfolio page
- "營業資訊" → Shop info (hours, address, map)
- "聯絡我們" → `tel:` action for phone call
- "優惠活動" → Current promotions

#### 10.2 Enhance Flex Messages
- Add action buttons (footer) to booking confirmation: "查看預約" / "加入行事曆"
- Add "重新預約" button to cancellation messages
- Add "查看地圖" + "需要改期？" to reminder messages
- Add stylist name to confirmation when available

#### 10.3 Quick Reply Integration
After webhook `follow` event, send quick replies:
```
"歡迎！請問需要什麼服務？"
[剪髮] [染髮] [燙髮] [查看時段]
```

### Medium Priority (Next 2-4 Weeks)

#### 10.4 Keyword Auto-Reply
Set up keyword matching for common queries:
- "預約" / "booking" → Open LIFF booking page
- "取消" / "cancel" → Open LIFF my-bookings page
- "營業時間" / "hours" → Reply with business hours
- "價格" / "price" → Reply with service price list (Flex Message)
- "地址" / "address" → Reply with location + map link

#### 10.5 Post-Visit Automated Messages
- Thank you message after appointment completion
- Hair care tips 2-3 days after visit
- Re-booking prompt at 3-4 weeks

#### 10.6 Per-User Rich Menu
- Different menus for new vs. returning customers
- VIP customers get priority booking button

### Lower Priority (V2 Features)

#### 10.7 Deposit System
- Implement prepayment for high-value services (perm, color)
- Integrate with bank transfer confirmation flow

#### 10.8 Confirmation Flow
- Send "確認出席" button 24 hours before appointment
- If not confirmed, alert staff for manual follow-up

#### 10.9 LINE MINI App Migration
- Register as LINE MINI App for MINI HOME discovery
- Leverage Notice chat room for cleaner notification UX
- Prepare for LINE Touch (NFC) salon check-in

#### 10.10 Carousel Booking Experience
- Show available dates as carousel bubbles
- Each bubble = 1 day with available time slots
- Faster browsing for users who prefer chat-based booking over LIFF

---

## Reference Architecture: LINE Official Hair Salon Demo

LINE provides an official demo application at:
`github.com/line/line-api-use-case-reservation-hairsalon`

**Architecture:**
- Frontend: Vue.js running in LIFF browser
- Backend: Python on AWS Lambda (SAM)
- Database: AWS DynamoDB (implied)
- Messaging: LINE Messaging API for reminders

**Flow:**
1. User scans QR code → LIFF app launches
2. LIFF requests profile access (user ID, display name)
3. User selects date, time, stylist
4. Backend creates reservation, stores in DB
5. Confirmation sent via LINE push message
6. Cron job sends reminders before appointment

**Our architecture is similar but uses:**
- Next.js (App Router) instead of Vue.js
- Vercel + PostgreSQL instead of AWS Lambda + DynamoDB
- Redis distributed locks for concurrency (more robust)
- Multi-tenant design (future-proofed for SaaS)

---

## Sources

- [LINE Taiwan AI Agent Era Announcement](https://www.linecorp.com/en/pr/news/global/20251028/)
- [LINE CONVERGE 2025 Report](https://www.lycorp.co.jp/en/story/20260218/taiwan_converge2025.html)
- [LINE Official Account OA Guide 2026](https://sphereagency.com/articles/line-official-account)
- [LINE Rich Menus Overview - Developers](https://developers.line.biz/en/docs/messaging-api/rich-menus-overview/)
- [LINE Rich Menu Switching - Developers](https://developers.line.biz/en/docs/messaging-api/switch-rich-menus/)
- [LINE Per-User Rich Menus - Developers](https://developers.line.biz/en/docs/messaging-api/use-per-user-rich-menus/)
- [LINE Flex Messages - Developers](https://developers.line.biz/en/docs/messaging-api/using-flex-messages/)
- [LINE Flex Message Simulator](https://developers.line.biz/flex-simulator/)
- [LINE Actions Reference - Developers](https://developers.line.biz/en/docs/messaging-api/actions/)
- [LINE Quick Reply - Developers](https://developers.line.biz/en/docs/messaging-api/using-quick-reply/)
- [LINE Audiences - Developers](https://developers.line.biz/en/docs/messaging-api/using-audience/)
- [LINE API Use Case - Reservation](https://lineapiusecase.com/en/usecase/reservation.html)
- [LINE LIFF Development Guidelines](https://developers.line.biz/en/docs/liff/development-guidelines/)
- [LINE MINI App Introduction](https://developers.line.biz/en/docs/line-mini-app/discover/introduction/)
- [LINE Hair Salon Demo - GitHub](https://github.com/line/line-api-use-case-reservation-hairsalon)
- [LINE Restaurant Reservation Demo - GitHub](https://github.com/line/line-api-use-case-reservation-Restaurant)
- [LineBooking.me](https://linebooking.me/)
- [HOTCAKE 夯客](https://hotcake.app/)
- [LINE 預約系統比較 - WishMobile](https://www.wishmobile.com/blogs/omo/LINE_reservations_system)
- [LINE 美髮預約系統 - LINE Biz Taiwan](https://tw.linebiz.com/manual/line-official-account/onboarding-beauty/)
- [LINE 美業應用 - LINE Biz Solutions](https://tw.linebiz.com/smb/industry-application/beauty/)
- [SimplyBook.me LINE Bot Integration](https://help.simplybook.me/index.php/Line_bot_custom_feature/en)
- [LINE Customer Retention - LINE for Business](https://lineforbusiness.com/th-en/sme-businessgoal/user-retention)
- [LINE Flex Message Templates - GitHub](https://github.com/jcyh0120/linebot-flex-message-template)
- [LINE Auto Reply Guide](https://respond.io/blog/line-auto-reply)
- [HOT PEPPER Beauty Guide](https://tokyopast3.com/health-beauty/getting-a-haircut-in-japan-using-hot-pepper-beauty/)
- [Beauty Salon Booking Apps Japan](https://igni7e.com/blog/beauty-salon-booking-apps)
