# 老闆端介面全面重新設計規劃（最終版）

## Context

老闆是一人理髮廳的髮型師兼經營者，每天在剪髮空檔（10-30 分鐘）用手機管理預約。過去用 LINE + Excel 手動管理，「時間被訊息吃掉」是最大痛點。目前後台有 8 個頁面但 UI 是 desktop-first，不符合手機優先的使用場景。

**目標：** Mobile-first PWA 管理介面，以日曆為核心，5 秒內掌握全天狀況。

**設計參考：** Fresha、Booksy、GlossGenius、Goldie

---

## PWA + Web Push 架構

### PWA 基礎

| 項目 | 說明 |
|------|------|
| `public/manifest.json` | App 名稱、icon、theme-color、`display: standalone` |
| `@serwist/next` | Service Worker — 快取靜態資源 + 推播接收 |
| `next.config.ts` | `withSerwist()` wrapper + **`next build --webpack`**（Serwist 不支援 Turbopack） |
| `src/app/layout.tsx` | manifest link、apple-touch-icon、theme-color meta |
| App Icons | 192x192 + 512x512 PNG |
| iOS 引導頁 | 首次打開時教老闆「加到主畫面」（iOS Web Push 必須 standalone 模式） |

**Service Worker 安全措施：**
- 用 `navigateFallbackDenylist` 排除 LIFF 路徑（`/booking`、`/my-bookings`、`/payment`）
- 防止干擾客人端預約頁面

### Web Push 推播

```
客人預約成功 → Server 觸發 Web Push → 老闆手機彈通知 → 點通知開 PWA
```

**推播事件：**

| 事件 | 通知內容 | 時機 |
|------|---------|------|
| 新預約 | 「🆕 王小明 預約了 4/15 14:00 剪髮」 | 立即推 |
| 客人取消 | 「❌ 李大華 取消了 4/15 16:00 燙髮」 | 立即推 |

> **「快結束提醒」不用 Web Push** — 工作時 app 是開著的，用 app 內 banner 即可（設計審核建議）

**通知安靜時段：** 20:00 後不推 Web Push，尊重老闆家庭時間

**技術：** `web-push` npm 套件 + VAPID key pair（`npx web-push generate-vapid-keys`）+ `PushSubscription` DB model + LINE 推播保留做 fallback

---

## 導航架構

### 底部 Tab Bar（3 個）

```
┌─────────┬─────────┬─────────┐
│   📅    │   📊    │    ≡    │
│  日曆   │  報表   │  更多   │
└─────────┴─────────┴─────────┘
```

| Tab | 頁面 | 說明 |
|-----|------|------|
| 日曆 | `/calendar` | **首頁**。日/週/月 三種視角 + 點擊空白新增預約 |
| 報表 | `/analytics` | 視覺化儀表板（營收、佔用率、客群） |
| 更多 | `/more` | 顧客管理、服務項目、行銷推播、營業時間/公休、設定、匯出 |

### 「更多」頁面

```
┌─────────────────────────┐
│  更多                    │
├─────────────────────────┤
│  👥 顧客管理             │  ← 搜尋客人、分類、筆記
│  💇 服務項目管理         │  ← 改價格、新增服務
│  📣 行銷推播             │  ← 對特定客群發 LINE
│  📅 營業時間與公休       │  ← 快速設公休、調整時間
│  📥 匯出資料             │  ← CSV 匯出
│  ⚙️ 店鋪設定             │  ← 店名、銀行帳號等
│  🚪 登出                 │
└─────────────────────────┘
```

### Responsive 策略

- **< 768px（手機）**：底部 Tab Bar，單欄布局
- **≥ 768px（平板/電腦）**：左側 Sidebar 恢復，內容區更寬

---

## 頁面 1：日曆（首頁）

> 痛點：「同一隻手機看就轉去很麻煩」→ 打開 app 就看到全天排程
> 痛點：「我只需要看一下時段誒，什麼時段約這樣」→ 一眼看出哪些有人、哪些空

### 1.1 三種視角

頂部切換列：`[日] [週] [月]`（三日視角延後 V2.1）

#### 日視角（預設首頁）

```
┌─────────────────────────────┐
│  ◀  2026/04/13 (日)  ▶  [今天] │
│  [日] [週] [月]              │
├─────────────────────────────┤
│  今日: 5 預約 | 預估 $4,600   │
├─────────────────────────────┤
│ 11:00  █ 王小明 - 男生剪髮    │
│          VIP                 │
│ 12:00  ░ (空)  ← 點擊新增    │
│── 現在 12:35 ──── 🔴 ────── │ ← 紅色時間線
│ 13:00  █ 李大華 - 燙髮       │
│ 14:00  █  (續)              │
│ 15:00  █  (續)              │
│ 16:00  ░ (空)  ← 點擊新增    │
│ 17:00  █ 張美玲 - 女生剪髮    │
│ 18:00  ░ (空)               │
│ 19:00  █ 陳先生 - 男生剪髮    │
├─────────────────────────────┤
│  📅日曆      📊報表     ≡更多 │
└─────────────────────────────┘
```

**功能：**
- **紅色時間線**：表示「現在幾點」，隨時間自動移動（像 Google Calendar）
- 每張預約卡片：時間 + 客人姓名 + 服務名稱 + 分類標籤（VIP/常客/新客）
  - 價格和來訪次數**不在卡片上**，點開 Bottom Sheet 才看（減少視覺噪音）
- 空白時段可點擊 → 新增預約
- 多時段服務（燙/染）顯示為連續色塊
- 頂部摘要列：今日預約數 + 預估營收

**空狀態（沒有預約的日子）：**
```
┌─────────────────────────────┐
│  今日: 0 預約                │
├─────────────────────────────┤
│ 11:00  ░ 點擊新增預約        │
│ 12:00  ░ 點擊新增預約        │
│ 13:00  ░ 點擊新增預約        │
│ ...（所有時段都顯示，可點擊） │
│                             │
│  😌 今天沒有預約，好好休息！  │
└─────────────────────────────┘
```

#### 週視角（Google Calendar 風格 Grid）

> 用戶直覺就是 Google Calendar 的 7 欄 grid。手機上字體縮小但保留 grid 結構。

```
┌──────────────────────────────────┐
│  ◀  4/14 - 4/20 週  ▶           │
│  [日] [週] [月]                   │
├────┬────┬────┬────┬────┬────┬────┤
│ 一 │ 二 │ 三 │ 四 │ 五 │ 六 │ 日 │
│ 14 │ 15 │ 16 │ 17 │ 18 │ 19 │ 20 │
├────┼────┼────┼────┼────┼────┼────┤
│ 11 │ █  │ █  │ ░  │ █  │ █  │ 休 │
│ 12 │ ░  │ █  │ █  │ ░  │ █  │    │
│ 13 │ █  │ ░  │ █  │ █  │ ░  │    │
│ 14 │ █  │ █  │ ░  │ █  │ ░  │    │
│ 15 │ █  │ █  │ █  │ █  │ ░  │    │
│ 16 │ ░  │ █  │ ░  │ ░  │ █  │    │
│ 17 │ █  │ ░  │ █  │ ░  │ ░  │    │
│ 18 │ ░  │ █  │ ░  │ █  │ ░  │    │
│ 19 │ █  │ ░  │ █  │ ░  │ █  │    │
├────┴────┴────┴────┴────┴────┴────┤
│  本週: 30 預約 | $38,400          │
├──────────────────────────────────┤
│  📅日曆      📊報表         ≡更多 │
└──────────────────────────────────┘
```

**功能：**
- 7 欄 × 9 列（11:00-19:00），像 Google Calendar
- 每格用色塊填充（有預約=品牌色、空=淺灰、公休=灰底斜線）
- 手機上格子較小，不顯示文字，只用色塊表示有/無預約
- 點擊任一格 → 有預約顯示詳情 Bottom Sheet，空白顯示新增
- 點擊日期欄頭 → 切換到該天的日視角
- 公休日整欄灰底
- 底部摘要：本週總預約 + 總營收

#### 月視角

```
┌──────────────────────────────────┐
│  ◀  2026 年 4 月  ▶              │
│  [日] [週] [月]                   │
├────┬────┬────┬────┬────┬────┬────┤
│ 日 │ 一 │ 二 │ 三 │ 四 │ 五 │ 六 │
├────┼────┼────┼────┼────┼────┼────┤
│    │    │  1 │  2 │  3 │  4 │  5 │
│    │    │  · │  3 │  5 │  2 │ 休 │
│    │    │    │ ▃▃ │ ▆▆ │ ▃▃ │    │
├────┼────┼────┼────┼────┼────┼────┤
│  6 │  7 │  8 │  9 │ 10 │ 11 │ 12 │
│  4 │  6 │  3 │  8 │  5 │  2 │ 休 │
│ ▃▃ │ ▆▆ │ ▃▃ │ ██ │ ▆▆ │ ▃▃ │    │
├────┴────┴────┴────┴────┴────┴────┤
│  本月: 預約 142 | 營收 $156,800   │
├──────────────────────────────────┤
│  📅日曆      📊報表         ≡更多 │
└──────────────────────────────────┘
```

**功能：**
- 每格：日期 + 預約數 + 底部色條（品牌色不同透明度表示忙碌程度）
  - 色條用透明度而非紅綠黃 → **色盲友好**（數字本身已傳達資訊）
- 公休日顯示「休」灰底
- 今天用外框/粗體標記
- 點擊任一天 → 切換到日視角
- 用聚合 API（一條 SQL，不是 30 個 request）

### 1.2 點擊空白時段新增預約

> 痛點：「剪頭髮空檔」有客人打電話來，要快速建預約

Bottom Sheet（用 Vaul）：

```
┌─────────────────────────────┐
│  新增預約                    │
│  4/13 (日) 16:00            │  ← 自動帶入
├─────────────────────────────┤
│  來源: [📞電話] [🚶現場]     │
│  客人姓名: [王小___]         │  ← 自動搜尋既有客人
│    → 王小明 (VIP · 12次)     │  ← 搜尋建議
│  服務: [男生剪髮 $1,000 ▼]   │
│  備註: [          ]          │
│  [取消]          [確認新增]   │
└─────────────────────────────┘
```

### 1.3 預約卡片點擊 → 詳情 + 操作

```
┌─────────────────────────────┐
│  王小明                 VIP ★ │
│  男生剪髮 · $1,000           │
│  11:00 - 12:00              │
│  來訪 12 次 · 上次: 3/28     │
│                             │
│  📋 備註: 喜歡短一點，頭皮敏感  │
│                             │
│  [✅ 完成(現金)]  [⚠️ 未到]   │  ← 預設現金，一鍵完成
│  [✏️ 改時間]   [❌ 取消]      │
│  [💳 完成(轉帳)]  [👤 客人]   │
└─────────────────────────────┘
```

**結案流程簡化（設計審核建議）：**

80% 場景（現金剪髮）→ **2 步完成**：
1. 點「✅ 完成(現金)」→ Booking COMPLETED + Payment RECEIVED(CASH)
2. 彈出快速筆記 → 寫/跳過

轉帳場景 → 點「💳 完成(轉帳)」→ 檢查截圖 → 完成 → 筆記

### 1.4 新預約即時通知

**雙管齊下：**
1. **Web Push**：app 沒開也收到（新預約 + 取消）
2. **App 內 Toast**：日曆頁 30 秒輪詢偵測新預約 → 頁面內 Toast

```
┌─────────────────────────────┐
│ 🔔 新預約！                   │
│ 王小明 預約了 4/15 14:00 剪髮  │
│             [查看] [關閉]     │
└─────────────────────────────┘
```

**輪詢優化（工程審核建議）：**
- 營業時間（11:00-20:00）→ 30 秒
- 非營業時間 → 5 分鐘或停止
- `visibilitychange` → 頁面切到背景暫停，回來立即刷新
- ETag → 資料沒變就 304 Not Modified

### 1.5 預約快結束提醒（App 內 Banner）

> 結束前 10 分鐘提醒，用前端 30 秒輪詢計算（不靠 cron，零延遲）

```
┌─────────────────────────────┐
│  ⚡ 李大華 剪髮即將結束        │
│  [確認結案]                   │
├─────────────────────────────┤
│ 14:00  🔔 李大華 - 剪髮 ← 快結束│
│ ...                          │
└─────────────────────────────┘
```

**判斷邏輯：** `status = CONFIRMED` + `now ≥ endTime - 10min`
- `endTime` = `startTime` + `service.slotsNeeded × 60 分鐘`
- 超過結束時間 2 小時仍未確認 → 紅色警告

### 1.6 完成預約後快速筆記

> 痛點：老闆想記住客人偏好（「喜歡短一點」「頭皮敏感」）

在同一個 Bottom Sheet 內切換狀態（不另開新 Sheet）：

```
「完成(現金)」點擊後，Sheet 內容切換為：
┌─────────────────────────────┐
│  ✅ 預約已完成！              │
│  王小明 - 男生剪髮            │
│                             │
│  📝 順手記一下：              │
│  ┌─────────────────────────┐│
│  │ 今天剪比較短，下次維持    ││
│  └─────────────────────────┘│
│  上次筆記: 喜歡短一點，頭皮敏感│
│                             │
│  [跳過]          [儲存筆記]   │
└─────────────────────────────┘
```

筆記儲存到顧客 notes（追加，帶日期戳記，不覆蓋）

---

## 頁面 2：報表（視覺化儀表板）

### 2.1 摘要卡片 + 上期比較

```
┌─────────────────────────────┐
│  報表                        │
│  [本週] [本月] [今年]         │
├─────────────────────────────┤
│  ┌──────────┬──────────┐    │
│  │ 營收      │ 預約數    │    │
│  │ $32,600  │ 28       │    │
│  │ ↑12%     │ ↑3       │    │
│  ├──────────┼──────────┤    │
│  │ 佔用率    │ 新客數    │    │
│  │ 72%      │ 5        │    │
│  │ ↑5%      │ ↑2       │    │
│  └──────────┴──────────┘    │
├─────────────────────────────┤
│  📈 每日營收趨勢（柱狀圖）    │
│  🔥 尖峰時段（熱力圖）        │
│  💇 熱門服務（排行）          │
│  👥 客群分佈（橫條圖）        │
├─────────────────────────────┤
│  📅日曆      📊報表     ≡更多 │
└─────────────────────────────┘
```

### 2.2 數據計算方式

| 指標 | 計算 | 備註 |
|------|------|------|
| 營收 | `SUM(payments.amount)` where RECEIVED | 只算已收款 |
| 預約數 | `COUNT(bookings)` 排除取消 | |
| 佔用率 | `completed / 實際可用時段` | **動態計算**：扣除公休日 |
| 新客數 | `COUNT(users)` 期間內建立 | |
| ↑↓ 比較 | 同時查「當前期間」+「上一期間」 | 本週 vs 上週 |

### 2.3 客群定義

| 分類 | 條件 | 說明 |
|------|------|------|
| NEW | 首次建立，未完成預約 | 藍色 |
| REGULAR | 1-5 次 + 60 天內來訪 | 綠色 |
| VIP | ≥6 次 + 60 天內來訪 | 金色 |
| AT_RISK | 60-120 天未來訪 | 橘色 |
| LAPSED | >120 天未來訪 | 紅色 |

**CRM 修正：** VIP 超過 90 天未訪 → 降為 AT_RISK（目前不降級是 bug）

---

## 頁面 3：更多 → 顧客管理

### 3.1 顧客列表

```
┌─────────────────────────────┐
│  ◀ 顧客                     │
│  [🔍 搜尋姓名或電話...]       │
│  [全部] [常客] [VIP] [流失中] │
├─────────────────────────────┤
│  ★ 王小明         VIP        │
│    12 次 · 上次 4/10 · 2天前  │
│                             │
│  陳先生         ⚠️ 流失中     │
│    3 次 · 上次 2/15 · 57天前  │
└─────────────────────────────┘
```

### 3.2 顧客詳情（含時間軸筆記）

```
┌─────────────────────────────┐
│  ◀ 王小明              VIP ★ │
├─────────────────────────────┤
│  📊 12 次 | $15,600 | 📞 0912│
├─────────────────────────────┤
│  📋 備註                [+新增]│
│  4/10 喜歡短一點，頭皮敏感    │
│  3/15 髮質偏細軟，瀏海要留長   │
├─────────────────────────────┤
│  預約歷史                    │
│  4/10 男生剪髮  $1,000  ✅    │
│  3/15 男生剪髮  $1,000  ✅    │
│  ...                        │
├─────────────────────────────┤
│  ⚠️ 違規: 0 次  [清除]       │
└─────────────────────────────┘
```

---

## 頁面 3：更多 → 營業時間與公休

```
┌─────────────────────────────┐
│  ◀ 營業時間與公休             │
├─────────────────────────────┤
│  📅 快速公休                  │
│  [選擇日期]       [設為公休]  │
│                             │
│  即將公休:                   │
│  4/20 (日) — 私人行程    [刪] │
│  5/01 (四) — 勞動節      [刪] │
├─────────────────────────────┤
│  ⏰ 每週營業時間              │
│  週一  11:00-20:00  ✅       │
│  ...                        │
│  週日  公休          ❌       │
└─────────────────────────────┘
```

---

## 設計規格（參照 docs/品牌設計規範.md）

### 色彩映射

| 元素 | Token | 值 |
|------|-------|-----|
| 頁面背景 | `--color-bg` | `#FFF8F1` 暖乳白（不用純白） |
| 預約卡片（單時段，如剪髮） | `--color-surface` | `#F3ECE4` 柔沙色 |
| 預約卡片（多時段，如燙染） | `--color-brand` + `opacity-10` | `#003D2B` 淡綠底色 |
| 空白時段 | dashed border | `--color-text-muted` 虛線框 |
| 紅色時間線 | `--color-danger` | `#A84A3B` 赤陶紅 |
| Tab Bar 選中 | `--color-brand` | `#003D2B` 深森林綠 |
| Tab Bar 未選 | `--color-text-muted` | `rgba(0,61,43,0.5)` |
| 月視角忙碌條 | `--color-brand` + opacity | `opacity-20`(0-3) / `opacity-50`(4-6) / `opacity-80`(7+) |
| 分類 VIP | `--color-warning` | `#C88B3B` 金色 |
| 分類常客 | `--color-success` | `#4A7C59` 苔蘚綠 |
| 分類新客 | `--color-brand` | `#003D2B` 品牌色 |
| 分類流失中 | `--color-warning` | `#C88B3B` 橘色 |
| 分類已流失 | `--color-danger` | `#A84A3B` 紅色 |
| CTA 按鈕 | `--color-brand` bg + `--color-bg` text | 深綠底暖白字 |
| Bottom Sheet | `--color-bg` bg + `--radius-xl` top | 暖白 + 16px 頂部圓角 |

### 資訊層級（日視角預約卡片）

1. **姓名**：16px semibold `--color-text-primary`（最突出）
2. **服務**：14px regular `--color-text-body`
3. **分類標籤**：12px medium badge（右側）
4. **時間**：左側灰色 label `--color-text-muted`

### 觸控規格

- 所有可點擊元素：最小 44px × 44px
- 月視角日期格：53px 寬 × 56px 高（含 padding），可點區域覆蓋整格
- Bottom Sheet 按鈕間距：至少 12px
- 「完成」和「未到」按鈕不相鄰（分開放置，防誤觸）

### 動畫規格

- 視角切換（日↔週↔月）：crossfade 200ms ease-out
- Bottom Sheet 進入：slide-up 200ms
- Toast 通知：fade-in 150ms + 3 秒後 auto-dismiss
- 按鈕點擊：`scale(0.97)` 150ms

### 載入狀態

- 日曆載入中：Skeleton loader（9 行灰色 shimmer 條，與時段高度相同）
- 月視角載入：日期格 skeleton shimmer
- 客人搜尋：inline spinner
- API 錯誤：顯示 toast 錯誤訊息 + 保留上次快取資料（SWR）

### 自動滾動（像 Google Calendar）

- 打開日視角時，自動滾動到「現在時間」附近
- 營業前（<11:00）：顯示 11:00 在頂部
- 營業中：紅色時間線在視窗上方 1/3 處
- 營業後（>20:00）：顯示完整日程從底部

---

## 技術實作

### 需要修改/新建的檔案

| 類型 | 檔案 | 變更 |
|------|------|------|
| **PWA** | `public/manifest.json` | **新建** |
| **PWA** | `next.config.ts` | `withSerwist()` + `--webpack` |
| **PWA** | `src/app/layout.tsx` | PWA meta tags |
| **Web Push** | `src/lib/push/web-push.ts` | **新建** — `sendWebPush()` |
| **Web Push** | `src/app/api/push/subscribe/route.ts` | **新建** — 訂閱 API |
| **Web Push** | `prisma/schema.prisma` | 新增 `PushSubscription` model |
| **Web Push** | Service Worker (serwist) | 推播接收 + 點擊跳轉 |
| **Layout** | `src/app/(admin)/layout.tsx` | Mobile-first + 底部 Tab Bar + 推播訂閱 |
| **Navigation** | `src/components/admin/tab-bar.tsx` | **新建** — 3 Tab 底部導航 |
| **日曆** | `src/app/(admin)/calendar/page.tsx` | 全面重寫 |
| **新預約通知** | `src/components/admin/new-booking-toast.tsx` | **新建** |
| **確認流程** | `src/components/admin/booking-confirm-sheet.tsx` | **新建** |
| **輪詢 Hook** | `src/lib/hooks/use-calendar-polling.ts` | **新建** |
| **顧客列表** | `src/app/(admin)/customers/page.tsx` | Mobile-first 重寫 |
| **顧客詳情** | `src/app/(admin)/customers/[id]/page.tsx` | 加入時間軸筆記 |
| **報表** | `src/app/(admin)/analytics/page.tsx` | Mobile-first 重寫 |
| **更多頁** | `src/app/(admin)/more/page.tsx` | **新建** |
| **營業時間** | `src/app/(admin)/more/schedule/page.tsx` | **新建** |
| **API** | `src/app/api/bookings/route.ts` | 聚合查詢 + range query |
| **API** | `src/app/api/bookings/[id]/route.ts` | `confirm_completion` action |
| **API** | `src/app/api/admin/analytics/route.ts` | 上期比較 + 動態佔用率 |
| **API** | `src/app/api/customers/[id]/route.ts` | 筆記追加 |
| **CRM** | `src/lib/crm/segmentation.ts` | VIP 90 天降級 |

### 新增 API

- `GET /api/bookings/monthly-summary?month=2026-04` — 聚合 API，一條 SQL
- `GET /api/bookings?from=2026-04-13&to=2026-04-19` — Range query（取代一天一個 request）
- `PATCH /api/bookings/[id]` action: `confirm_completion` — 同時更新 Booking + Payment
- `PATCH /api/customers/[id]/notes` — 追加筆記（帶時間戳）
- `POST /api/push/subscribe` — Web Push 訂閱
- `GET /api/admin/analytics` — 增加 `previousPeriod` 欄位

### 新增依賴

```
@serwist/next    — PWA / Service Worker
web-push         — Server-side Web Push
vaul             — Bottom Sheet (shadcn/ui Drawer 的底層)
```

---

## 實作順序

### Phase 0: PWA + Web Push 基礎
1. 安裝 `@serwist/next` + `web-push` + `vaul`
2. `manifest.json` + app icon + layout PWA meta tags
3. Service Worker（快取 + navigateFallbackDenylist 排除 LIFF）
4. VAPID keys + `PushSubscription` DB model
5. `POST /api/push/subscribe` + `sendWebPush()` 工具
6. Admin layout 加推播訂閱邏輯 + iOS 安裝引導頁
7. 在 booking creation / cancellation 觸發 Web Push
8. **驗證**：手機安裝 PWA → 客人預約 → 收到推播

### Phase 1: 導航重整
9. 底部 3-Tab Bar 組件（手機）+ 保留 Sidebar（桌面）
10. Admin layout responsive 切換
11. 「更多」頁面
12. 路由調整（calendar 為首頁）

### Phase 2: 日曆重寫
13. 日視角（預約卡片 + 摘要列 + 紅色時間線 + 空狀態）
14. 週視角（列表模式 + 填充 bar）
15. 月視角 + 聚合 API（`/api/bookings/monthly-summary`）
16. 點擊空白新增預約（Vaul Bottom Sheet）
17. 預約卡片 Bottom Sheet（詳情 + 操作）
18. Range query API（`?from=&to=`）

### Phase 3: 即時通知 + 確認流程
19. 30 秒輪詢 Hook（新預約偵測 + 快結束偵測 + visibilitychange + 安靜時段）
20. 新預約 Toast 通知
21. 「快結束」App 內 Banner
22. 「完成(現金)」一鍵結案 + 快速筆記（同一個 Sheet 內）
23. `confirm_completion` API

### Phase 4: 顧客與筆記
24. 顧客列表 mobile-first
25. 顧客詳情 + 時間軸筆記
26. 筆記追加 API

### Phase 5: 報表 + CRM
27. 報表頁 mobile-first
28. 上期比較 API
29. 佔用率動態計算
30. CRM VIP 降級修正

### Phase 6: 其他
31. 營業時間與公休獨立頁面
32. 其他「更多」子頁面調整

---

## 驗證方式

1. **PWA 安裝測試**：
   - iOS Safari → 加到主畫面 → standalone 模式正常
   - Chrome DevTools > Application > Manifest 正確
   - 客人預約 → 手機收到 Web Push
   - 20:00 後不收到推播

2. **核心流程測試**（375px viewport）：
   - 打開 → 今天日曆 → 紅色時間線顯示現在 → 5 秒掌握
   - 點空白 → 填寫 → 新增 → 日曆更新
   - 客人線上預約 → 30 秒內 Toast 彈出
   - 預約快結束 → Banner 提醒 → 「完成(現金)」→ 筆記/跳過（2 步）
   - 切月視角 → 看忙碌色條 → 點某天 → 跳到日視角
   - 報表 → 本週營收 + ↑↓ 比較

3. **LIFF 不受影響**：Service Worker 不干擾客人預約頁面

4. **響應式**：手機（375px）、平板（768px）、桌面（1280px）

---

## 工程審核決策記錄

| # | 決策 | 選擇 | 原因 |
|---|------|------|------|
| 範圍 | 分兩波實作 | Wave 1: PWA+導航+日曆 / Wave 2: Push+確認+報表+CRM | 22 檔案太大，分開可獨立上線測試 |
| API | 擴展現有 `complete` action | 加入可選 paymentMethod 參數 | 避免重複 visit stats / notification 邏輯 |
| Data | 加入 SWR | useSWR 管理日曆資料 + refreshInterval 取代手動 setInterval | cache invalidation + visibility pause 內建 |
| 通知 | localStorage 去重 | Push 到達時寫 bookingId + timestamp，polling 檢查 5 分鐘內是否已推 | 防止雙重通知 |
| DRY | 複用現有 useToast() | 新預約通知用既有 toast 系統，不建新組件 | 減少 1 個檔案 |
| 效能 | SWR 已處理 polling 計量 | 頁面不可見時自動停止，營業時間外降頻 | ~60K/月，在 100K 額度內 |

## What Already Exists（可複用的現有程式碼）

| 現有檔案 | 用途 | 規劃中的用法 |
|----------|------|-------------|
| `src/components/ui/toast.tsx` | Toast 通知系統 | 新預約通知直接用 useToast() |
| `src/lib/notifications/admin-notify.ts` | LINE 推播給老闆 | Web Push 觸發點跟 LINE 推播相同位置 |
| `src/app/api/bookings/[id]/route.ts` complete action | 標記完成 + visit stats | 擴展加入 payment 處理 |
| `src/lib/crm/segmentation.ts` | CRM 分群 | 小修 VIP 降級邏輯 |
| `src/app/(admin)/settings/page.tsx` | 營業時間 + 公休 | 拆出到獨立頁面，邏輯複用 |
| `src/app/api/admin/analytics/route.ts` | 報表查詢 | 加入 previousPeriod 比較 |

## NOT in Scope（明確延後）

| 項目 | 延後原因 |
|------|---------|
| 三日視角 | 日/週/月 已足夠，延後 V2.1 |
| 離線快取（完整） | 老闆店裡有 WiFi，基本 SW 快取就好 |
| 長按封鎖時段 | 可從「更多 > 營業時間」操作，不急 |
| Waitlist UI | PRD 有提但非 Wave 1/2 核心 |
| 改期操作 UI | 可先用「取消 + 重建」 |
| SSE/WebSocket | Vercel Serverless 不支援，polling + push 夠用 |

## Wave 1 測試需求

| 測試目標 | 測試檔案 | 類型 |
|----------|---------|------|
| 月視角聚合 API | `src/app/api/bookings/__tests__/monthly-summary.test.ts` | Unit |
| Range query API | `src/app/api/bookings/__tests__/range-query.test.ts` | Unit |
| Polling hook | `src/lib/hooks/__tests__/use-calendar-polling.test.ts` | Unit |
| Tab bar responsive | `src/components/admin/__tests__/tab-bar.test.tsx` | Component |
| 完成 + 付款 (complete action) | `src/app/api/bookings/__tests__/complete-payment.test.ts` | Unit |
| 筆記追加 API | `src/app/api/customers/__tests__/notes-append.test.ts` | Unit |

## Failure Modes

| Codepath | 失敗情境 | 有測試？ | 有錯誤處理？ | 使用者體驗 |
|----------|---------|---------|------------|-----------|
| Web Push subscribe | 使用者拒絕通知權限 | 待建 | 需加 | 靜默降級為 polling only |
| Monthly summary API | 新月份零預約 | 待建 | 需加 | 空狀態顯示 |
| Complete + Payment | Payment record 不存在 | 待建 | 需加 | 應自動建立 Payment |
| SWR polling | API 回傳 500 | SWR 內建 | SWR retry | 顯示上次快取資料 |
| LIFF + SW 衝突 | SW 攔截 LIFF 路徑 | **E2E 必須** | navigateFallbackDenylist | 客人預約壞掉（嚴重） |

**Critical gap:** LIFF + Service Worker 衝突沒有自動化測試。必須在真實 LINE app 中手動測試。

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 2 | CLEAR | 5 proposals, 3 accepted, 4 deferred |
| Codex Review | `/codex review` | Independent 2nd opinion | 0 | — | — |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 3 | CLEAR (PLAN) | 5 issues, 1 critical gap |
| Design Review | `/plan-design-review` | UI/UX gaps | 1 | CLEAR (FULL) | score: 6/10 → 8/10, 5 decisions |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | — |

**UNRESOLVED:** 0
**VERDICT:** ENG + DESIGN CLEARED — ready to implement Wave 1
