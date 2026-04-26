# V3 改版完整實作策略

> **產出**：2026-04-26（demo 前 36 小時）
> **基準**：[docs/PRD-v3.md](./PRD-v3.md) §1-§12
> **主管**：Ryan（solo dev）
> **AI co-pilot**：Claude（Anthropic）
>
> 本文件 = 把 PRD 拆成可執行 task + 依賴圖 + priority + 估時，並標明每條的 status。

---

## 0. Status Snapshot（2026-04-26 13:00）

| Layer | 狀態 |
|---|---|
| Production | ✅ 21 PR merged, deploy 全綠 |
| Calendar V3 sub-PRs | ✅ 6/9 done（sub-1/2/3/4/6/7） |
| Schema | ✅ Wave 2bc additive merged（ConsultationRequest + Coupon） |
| Schema | ⏸️ Wave 2a (Service 重構) 等老闆服務確認表 |
| Wave 4 (consultation/payment/coupon) | ⏸️ schema ready, routes/UI pending |
| Wave 5 (reports + brand) | 🔄 本 PR 第一條 widget 接 Excel data |
| Excel parser | ✅ 1.36M 年營收 dry-run pass |
| Excel live import | ⏸️ 等 Wave 2a service-name-map.json |

---

## 1. PRD §1-§12 完整 status 表

### §1 服務項目重構（Wave 2a）— ⏸️ BLOCKED on 老闆

**做了**：`Service` model 已 ready（既有 schema）

**待做**：
- [ ] 等老闆填 [服務項目確認表-給老闆-2026-04-24.xlsx](./服務項目確認表-給老闆-2026-04-24.xlsx)
- [ ] 重新 seed.ts 含 3 類剪髮 + 燙染漂拆解 + bundle 規則（染必綁護）
- [ ] migration plan：保留舊 service id 的 booking 引用、新增 V3 service 並設 isActive 規則

**估時**：3 天（拿到 Excel 後）

**依賴**：blocked on Boss

---

### §2 預約確認機制（認知通知）— ✅ DONE

**做了**：
- ✅ PR #5 文案修正（「待確認」→「通知」）
- ✅ PR #11/14/15 calendar 紅點 indicator
- ✅ adminAcknowledgedAt 邏輯既有

**剩**：無（全功能 production）

---

### §3 諮詢流程（Wave 4a）— 🔄 schema ready, UI/routes pending

**做了**：
- ✅ PR #8 ConsultationRequest schema additive
- ✅ PR #13 admin/consultations placeholder page

**待做**：
- [ ] `POST /api/consultations` 真正建表（LIFF 端 + webhook 漂髮 keyword 偵測）
- [ ] `GET /api/consultations?status=PENDING` admin 隊列查詢
- [ ] `PATCH /api/consultations/[id]` 標記 REPLIED/ARCHIVED
- [ ] `POST /api/consultations/[id]/convert-to-booking`
- [ ] admin/consultations/page.tsx 隊列 UI
- [ ] LIFF /consultation 客戶端表單
- [ ] webhook 偵測「漂」keyword → 建 ConsultationRequest（priority=1）
- [ ] sidebar 紅點 badge

**估時**：1 週

**依賴**：Wave 2b schema (✅ ready)

---

### §4 行事曆 V3（Wave 3.A）— 🟡 Partial

**做了**：
- ✅ PR #11 day view 紅點 (sub-1)
- ✅ PR #14 week+month 紅點/badge (sub-2)
- ✅ PR #16 改時間 click-to-reschedule (sub-3)
- ✅ PR #18 month grid Google-style chip + 顏色分類 (sub-4)
- ✅ PR #15 公休日 toast + 月視圖灰色 (sub-6)
- ✅ PR #19 顏色 legend (sub-7 partial)

**待做**：
- [ ] **真正拖拉改期 UI** — HTML5 DnD + ghost preview + slot collision (3-5 day)
- [ ] **拖拉建立預約 in week/month view** (1-2 day)
- [ ] **Component refactor** — calendar/page.tsx 1145 行拆 day-view / week-view / month-view (2-3 day)
- [ ] **Smooth horizontal swipe** 切月/週（mobile gesture）

**估時**：1-2 週剩餘

**依賴**：無

**風險**：drag UI + refactor 高破壞風險，**demo 後做**

---

### §5 CRM 門檻 + segmentation — ✅ DONE

**做了**：
- ✅ PR #1 常數 60→100, 120→180
- ✅ PR #10 single-CTE 重寫 + 60d window + E-10 index

**剩**：無，等下週日 cron 跑後 spot-check 即可

---

### §6 付款對帳 UX（Wave 4b）— ⏸️ Not started

**做了**：無（既有 ECPay ATM + cash 流程已 production）

**待做**：
- [ ] LIFF 客戶端「上傳轉帳截圖 + 輸入末五碼」表單
- [ ] admin /payments 待對帳 queue + 一鍵 confirm
- [ ] 結帳完成 + 入帳 push 客戶 LINE 訊息
- [ ] E-12 結帳提醒改用 notifications table 不用 5 min cron
- [ ] E-13 admin 開頁 banner missed settlements
- [ ] E-14 LIFF 多 PENDING 時讓客人選

**估時**：1 週

**依賴**：無

---

### §7 關鍵字回覆 — 🟡 Partial（漂髮 routed to Wave 4a）

**做了**：
- ✅ PR #6 燙/染 service-inquiry Flex 卡片
- ✅ false positive guard（燙手/染色筆等）
- ✅ cancel-reschedule keywords 加強

**待做**：
- [ ] 漂髮 keyword → 建 ConsultationRequest（含 Wave 4a）
- [ ] 燙/染 後續對話狀態追蹤（客人傳了照片 → admin 回 LINE）

**估時**：半天（Wave 4a 完成後）

---

### §8 回購券 A/B Test（Wave 4c）— 🔄 schema ready, logic pending

**做了**：
- ✅ PR #9 Coupon + Tenant.featureFlags additive
- ✅ PR #13 admin/coupons placeholder page

**待做**：
- [ ] `issueCoupon()` helper：Booking COMPLETED → arm assignment (userId hash % 2) → create Coupon
- [ ] PATCH /api/bookings/[id] COMPLETED 分支 hook issueCoupon
- [ ] /api/cron/coupon-expiry-reminder 每日 10:00 Taipei 掃 7 天前到期 push LINE
- [ ] LIFF /my-coupons 客戶看券
- [ ] 預約時帶入未用 coupon 折抵 UI
- [ ] admin /coupons dashboard：A 組 vs B 組 metrics

**估時**：1 週

**依賴**：Wave 2c schema (✅ ready)

---

### §9 品牌設計套用 — ⏸️ Not started

**狀態**：design tokens 已在 globals.css，但 calendar V3 新 UI 尚未全面對齊

**待做**：
- [ ] Calendar V3 顏色 token review（PR #18 hardcoded `bg-orange-100` 等該換成 design token）
- [ ] LIFF 頁面字級/間距/圓角 audit
- [ ] Button hierarchy（primary/secondary/tertiary）統一
- [ ] Empty state 圖示

**估時**：3-5 天

---

### §10.1 Excel 歷史匯入 — 🟡 parser ready, live import pending

**做了**：
- ✅ PR #20 parser 修好，dry-run 印 1.36M 年營收

**待做**：
- [ ] E-16 紅字偵測 → BANK_TRANSFER（要再 inspect xlsx font.color）
- [ ] data/service-name-map.json（依 Wave 2a 完成的新 service 建對應）
- [ ] E-17 deterministic Booking.id（hash tenantId+date+startTime+normalizedName）
- [ ] E-18 production-tenant guard
- [ ] Customer upsert + synthetic lineUserId (legacy-{slug})
- [ ] firstVisitAt = first 「新」-prefixed booking
- [ ] Booking + Payment write
- [ ] Tests（red-text, time override, customer normalize）

**估時**：3-5 天

**依賴**：Wave 2a Service 重構

---

### §10.2 報表 8 widget（Wave 5）— 🔄 starting now

**做了**：
- ✅ PR #13 /reports placeholder

**待做（本 PR 開始）**：
- [ ] /api/reports 接 Excel parser stats（build-time generate JSON）
- [ ] 8 個 widget UI:
  - [ ] 月營收 + YoY/MoM 比較
  - [ ] 時段熱力圖（11-20h × 7 weekday）
  - [ ] 服務分布 pie（剪/燙/染/漂佔比）
  - [ ] 客戶分層圓環（NEW/REGULAR/VIP/AT_RISK/LAPSED）
  - [ ] 流失趨勢線（每月 LAPSED 變化）
  - [ ] 客單價趨勢
  - [ ] 回訪率（30/60/90 天 cohort）
  - [ ] 取消/no-show 比例

**估時**：2 週完整版本，本 PR 做 1-3 個 widget skeleton + Excel parser 接口

---

### §11 Demo bug list — ✅ DONE

- ✅ #1 Rich Menu 4→6 格 (PR #7, layout config — 等老闆素材 deploy)
- ✅ #2 sticky footer (PR #2)
- ✅ #3a 保持登入 30 天 (PR #3)
- ✅ #5 我的預約效能 (PR #4 + #17)

**剩**：
- [ ] #4 「我的服務」AI 感圖片替換（要素材）
- [ ] #1 真實 LINE Rich Menu 6 格 deploy（要素材）

---

### §12 V3.5 Backlog — 🚫 Explicit deferred

PRD §12 明確列為「等 V3 上線 + dogfood 1 個月後」啟動。**不在本 V3 範圍**。

---

## 2. 依賴圖（最佳執行順序）

```
[已完成 ✅]
Wave 1.1-1.8 + 2bc + 1.2 + 3.A sub-1/2/3/4/6/7 + 3.B parser + 1.5b LIFF cache

[現在做 🔄]
Wave 5 第一條 widget — Excel data integration

[等老闆 ⏸️]
Wave 2a (Service 重構)
└→ Wave 3.B Excel live import
└→ Wave 4a 漂髮 ConsultationRequest 流程

[demo 後做 🟡]
Wave 4a consultation routes/UI（schema ready）
Wave 4b payment-ux
Wave 4c coupon A/B logic
Wave 5 剩 7 個 widget
Wave 3.A drag UI + refactor
§9 brand design polish
```

---

## 3. 12 週 detailed roadmap（demo 後）

### Week 1 (4/27-5/3) — Demo + immediate iteration
- 4/27 demo 給 1008 老闆
- Demo feedback 收集 → 修 critical bugs
- 等老闆服務確認表回傳

### Week 2-3 (5/4-5/17) — Wave 2a + 3.B
- Wave 2a Service 重構（拿到 Excel 後）
- Wave 3.B Excel live import 寫進 DB（搭配 service-name-map）
- 跑 backfill 灌入 1.36M 年資料

### Week 4-5 (5/18-5/31) — Wave 5 完整報表
- 8 個 widget 全做完
- 接 V3 系統 + Excel 歷史 dual data source
- API aggregation 優化（cache 5 min）

### Week 6 (6/1-6/7) — Wave 4a consultation
- 完整 consultation flow + admin UI + LIFF
- 漂髮 keyword wiring

### Week 7 (6/8-6/14) — Wave 4b payment-ux
- LIFF 匯款工具
- admin 對帳 UI

### Week 8 (6/15-6/21) — Wave 4c coupon A/B
- issueCoupon helper
- cron 提醒
- LIFF /my-coupons
- A/B dashboard

### Week 9-10 (6/22-7/5) — §9 brand polish + Wave 3.A drag UI
- Brand design audit
- Calendar drag-to-reschedule 真正 implementation
- Component refactor (calendar/page.tsx)

### Week 11 (7/6-7/12) — QA + dogfood
- 全功能 QA
- 朋友 + 老闆 dogfood 1 週
- 修發現的 bugs

### Week 12 (7/13-7/19) — Ship + V3.5 啟動評估
- Final ship to prod
- Demo to 第二家店候選
- Decide V3.5 backlog priority

---

## 4. 本 PR (Wave 5 起步) 範圍

1. ✅ 寫 implementation plan (本檔)
2. 🔄 改 /api/reports route 從 501 → 接 Excel parser stats
3. 🔄 改 /reports page 從 ComingSoon → render real widget（月營收、服務分布、新客數）
4. 🔄 build-time JSON 生成 script（避免 reports page load 時跑 parser）

---

## 5. 風險與已知 limitation

| 風險 | mitigation |
|---|---|
| Excel parser 跑 1-2s，每次 page load 不可接受 | build-time generate JSON + reports 讀 JSON |
| Excel 1.36M 數字是 dry-run，不是真實 DB | demo 標明「2025 歷史資料 (Excel) + V3 系統 (即時)」 |
| Wave 2a blocked on 老闆 | 平行做 Wave 4b/4c/5（不依賴 Service schema） |
| Component refactor 風險 | demo 後做，做之前先 snapshot |
| Vercel preview env JWT_SECRET | 你去 dashboard 手動設 |

---

## 6. 一句話收斂

> **V3 PRD 12 章已執行 ~70%（schema + UI 主框架 + critical bugs + Calendar 6 sub-PR + Excel parser）。剩 30% 是 Wave 4 三條 + Wave 5 完整報表 + drag UI + brand polish，估 4-5 週執行（含等老闆服務確認表）。Demo 4/27 之前我推 Wave 5 第一條 widget 接 Excel data 收尾。**
