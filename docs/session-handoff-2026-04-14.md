# Session Handoff — 2026-04-14

## 📍 目前狀態

最新 commit: `cd7815c` — iPhone 版面溢出修復（min-w-0 on main）
部署: Vercel production auto-deploy (約 1-2 分鐘後生效)

## 🔑 登入資訊

- Email: `admin@1008hair.com`
- 密碼: `admin123`（老闆應該會想改，/more/password 可改）
- iOS PWA 用 localStorage + Bearer token auth（不再依賴 cookie）

## ✅ 本次 session 完成的功能

### Admin 全新 UI（Mobile-first PWA）
- `/calendar` 首頁：日/週/月三視角
  - **日視角**：時間軸 + 紅色時間線 + 預約卡片（時間範圍/姓名/服務 pill）
  - **週視角**：7×9 Grid，70px/h，sticky header，姓名+服務顯示
  - **月視角**：格子 + 合計 N + 前 2 筆預約時間 mini bar
  - **水平日期滑動條**（僅日視角）：7 天剛好填滿螢幕，絲滑橫向滾動
  - 付款狀態顏色：已付款苔蘚綠 vs 未付款品牌綠
- `/analytics` 報表：2×2 統計卡、熱力圖、熱門服務、客群分佈
- `/more` 功能入口：顧客、服務、推播、營業時間、匯出、設定、修改密碼
- `/customers` 顧客列表 + 詳情時間軸筆記
- 底部 3-Tab Bar（日曆/報表/更多） → 後來改 4-Tab（加訊息）

### 其他
- 長按 350ms + 拖拉新增預約（Google Calendar 風格）
- Web Push + PWA manifest + Service Worker
- 付款 status=RECEIVED 後卡片自動變綠
- Toast 只在 createdAt 5 分鐘內才跳（不誤觸）
- Login 30 天持久化

## ⚠️ 還沒驗證 / 可能有 bug

- [ ] 手機 PWA 上 **min-w-0 修復**是否真的解決 segment switcher 切屏問題（cd7815c 剛推，待測）
- [ ] 拖拉新增預約在真 iPhone 上的順暢度
- [ ] 付款完成後卡片即時變綠（SWR 30s 內會更新）
- [ ] iOS PWA 重開是否真的不用重新登入（30 天 JWT + localStorage）

## 🚧 未完成的 TODO（下次可做）

1. **Google OAuth 登入**（用戶選擇暫緩，之後再說）
2. **拖拉新增時**多時段服務自動延長的體驗（目前是手動拖）
3. **月視角第 3 筆以上預約**現在顯示 "+N"，可以考慮點開展開
4. **顧客詳情筆記的編輯**（現在只能追加，不能刪除舊的）

## 📚 關鍵參考文件

- `docs/品牌設計規範.md` — 色彩、字體、間距系統（深森林綠 `#003D2B` + 暖乳白 `#FFF8F1`）
- `docs/admin-redesign-plan.md` — 原始改版規劃（gstack eng + design review 通過）
- `docs/admin-stitch-prompts.md` — Stitch 設計 prompts（10 頁）
- `docs/stitch-admin-designs/` — Stitch 產出的參考 mockups
- `docs/老闆訪談.md` — 老闆需求原始訪談
- `.gstack/qa-reports/qa-report-barbershop-booking-2026-04-14.md` — 本次 QA 報告

## 🎨 設計原則提醒

- **不抄夯客的珊瑚粉**，保留深森林綠 `#003D2B` + 暖乳白 `#FFF8F1` 品牌色
- 參考夯客的**排版邏輯**（時段高度、卡片內容層級、水平日期條），不抄視覺
- 手機為主（375px viewport），桌面次要
- 單人店情境 — 不用設計師欄位、多店管理

## 🧰 技術棧

- Next.js 16 + App Router + TypeScript + Tailwind
- Prisma 7 + PostgreSQL (Supabase)
- SWR for data fetching (30s polling)
- Vaul for Bottom Sheets
- Serwist for Service Worker / PWA
- web-push for push notifications
- Deploy: Vercel (prod auto-deploy on main push)

## 💡 偏好記錄（給下個 AI session）

- 使用者希望 **AI 列理解再動手**（尤其是 UX 決策）
- 喜歡**分步驟推進**，每步完成後驗證再下一步
- 對「抄襲 vs 學習」有分辨 — 要**學邏輯不抄視覺**
- PWA + 手機體驗是首要目標
- 寫 code 用**最小 diff**，不重構不相關的東西
