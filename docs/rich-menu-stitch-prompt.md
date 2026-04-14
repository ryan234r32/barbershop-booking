# Rich Menu 設計 Prompt — for Google Stitch

> **用途：** 將以下 prompt 貼到 Google Stitch，請 AI 設計出 LINE Rich Menu 圖片，再上傳到 LINE Official Account Manager
> **技術規格：** LINE Rich Menu 標準尺寸（Full size）
> **日期：** 2026-04-11

---

## 使用方式

1. 打開 [Google Stitch](https://stitch.withgoogle.com/)
2. 選 Mobile / Custom Canvas
3. 貼上下方的 **English Prompt**（推薦，Stitch 對英文理解較好）
4. 產出後下載 PNG
5. 到 [LINE Official Account Manager](https://manager.line.biz/) 上傳 Rich Menu
6. 設定 4 個點擊區域對應動作

---

## English Prompt（推薦用這個貼到 Stitch）

```
Design a LINE Rich Menu image for a premium hair salon in Taiwan called "1008 Hair Studio".

**Technical specifications:**
- Canvas size: 2500 × 1686 pixels (LINE Rich Menu Full size)
- Layout: 2 × 2 grid (4 equal square tiles, each 1250 × 843 pixels)
- Format: PNG, under 1MB
- Must work when displayed at small sizes (users see it at ~400px wide on phones)

**Brand identity:**
- Name: 1008 Hair Studio
- Tone: Premium but approachable, clean, modern, minimal
- Target audience: 20-50 year old Taiwanese customers, LINE users
- Inspiration: Think Apple store meets Aesop skincare, not trendy or cartoony
- Primary color: Emerald green (#059669)
- Secondary colors: Soft white (#FFFFFF), warm gray (#F5F5F4), deep charcoal (#111827)

**The 2x2 grid layout (clockwise from top-left):**

Tile 1 (Top-Left) — "立即預約" (Book Now)
- Icon: Scissors or calendar with a checkmark
- Label: 立即預約 (large, bold Chinese text)
- Background: Emerald green (#059669)
- Text color: White
- This is the primary call-to-action, should feel most inviting

Tile 2 (Top-Right) — "我的預約" (My Bookings)
- Icon: Clipboard or list with checkmark
- Label: 我的預約
- Background: White or very light gray
- Text color: Deep charcoal
- Clean and minimal

Tile 3 (Bottom-Left) — "服務價目" (Services & Pricing)
- Icon: Price tag, dollar sign, or small price list icon
- Label: 服務價目
- Background: Warm gray (#F5F5F4) or subtle gradient
- Text color: Deep charcoal

Tile 4 (Bottom-Right) — "營業資訊" (Store Info)
- Icon: Location pin, store front, or clock
- Label: 營業資訊
- Background: White or very light gray
- Text color: Deep charcoal

**Design principles:**
- Each tile must be visually distinct but feel part of the same system
- Clear thin dividing lines between tiles (1-2px, light gray)
- Icons should be simple, outlined or filled but NOT cluttered
- Chinese text must be clearly legible at small sizes (use a clean modern sans-serif)
- Use generous whitespace, don't cram content
- Avoid: gradients that look tacky, photo backgrounds, 3D effects, cartoon illustrations, neon colors
- Overall feel: Like a luxury boutique or minimalist spa app

**Typography:**
- Chinese text: Noto Sans TC or PingFang TC, Bold weight
- Font size: Large enough to read clearly at phone size
- Hierarchy: Label text should be the most prominent element in each tile after the icon

**Critical requirement:**
The top-left tile "立即預約" (Book Now) MUST be the visually dominant element, because this is the most important action we want users to take. Make it pop by using the emerald green background while other tiles are white/light gray.

Output the design as a single PNG image at exactly 2500 × 1686 pixels.
```

---

## 中文 Prompt（如果 Stitch 懂中文）

```
設計一張 LINE Rich Menu 圖片，用於台灣精品理髮廳「1008 Hair Studio」的官方 LINE 帳號。

**技術規格：**
- 畫布尺寸：2500 × 1686 像素（LINE Rich Menu Full size 標準）
- 版型：2 × 2 網格（4 個相等方塊，每塊 1250 × 843 像素）
- 格式：PNG，檔案大小 < 1MB
- 顯示時在手機上約 400px 寬，文字必須在小尺寸依然清晰可讀

**品牌定位：**
- 店名：1008 Hair Studio
- 風格：精品質感但親切，乾淨、現代、極簡
- 目標客群：20-50 歲台灣 LINE 使用者
- 參考美感：Apple Store 遇上 Aesop 保養品牌，不要 trendy 或卡通風
- 主色：翡翠綠 #059669
- 輔助色：純白 #FFFFFF、暖灰 #F5F5F4、深炭 #111827

**2x2 格版型（從左上開始順時針）：**

格 1（左上）— 立即預約
- 圖示：剪刀 或 日曆加勾勾
- 標籤文字：「立即預約」（大字、粗體中文）
- 背景色：翡翠綠 #059669
- 文字色：白色
- 這是主要 CTA，必須最吸引目光

格 2（右上）— 我的預約
- 圖示：記事板 或 清單加勾勾
- 標籤文字：「我的預約」
- 背景色：白色 或 極淺灰
- 文字色：深炭色
- 乾淨簡潔

格 3（左下）— 服務價目
- 圖示：價格標籤、$ 符號 或 小型價目表
- 標籤文字：「服務價目」
- 背景色：暖灰 #F5F5F4 或 細膩漸層
- 文字色：深炭色

格 4（右下）— 營業資訊
- 圖示：定位圖釘、店面 或 時鐘
- 標籤文字：「營業資訊」
- 背景色：白色 或 極淺灰
- 文字色：深炭色

**設計原則：**
- 每格要有視覺區別但必須感覺是同一系統
- 格與格之間用 1-2px 淺灰色細線分隔
- 圖示要簡潔（線條或實心都 OK），絕對不能雜亂
- 中文字在小尺寸下必須清晰可讀（用現代感 sans-serif 字體）
- 留白要大方，不要擠滿內容
- 避免：俗氣漸層、照片背景、3D 效果、卡通插畫、霓虹色
- 整體感受：像精品咖啡店或極簡 SPA App

**字體：**
- 中文字：Noto Sans TC 或 PingFang TC，Bold 粗體
- 字體大小：手機尺寸下依然清晰
- 層次：標籤文字在圖示之後是每格最突出的元素

**關鍵要求：**
左上格「立即預約」必須是視覺上最顯眼的元素，因為這是我們最希望用戶點擊的動作。用翡翠綠背景讓它跳出來，其他三格保持白色或淺灰。

輸出：單一 PNG 圖片，尺寸剛好 2500 × 1686 像素。
```

---

## 上傳到 LINE 的設定步驟

產出圖片後，到 [LINE Official Account Manager](https://manager.line.biz/) → 選擇你的 OA → 主頁面 → 圖文選單 → 建立新的圖文選單：

### 基本設定

| 欄位 | 值 |
|------|-----|
| 標題 | 1008 主選單（僅管理用，使用者看不到） |
| 使用期間 | 永久（或設定你要的期間） |
| 聊天室選單顯示名稱 | 主選單 |
| 預設顯示 | ✅ 開啟 |

### 版型選擇

選擇 **Large size** 的 **2x2 版型**（LINE 提供的預設選項中就有這個）

### 上傳圖片

- 上傳剛才 Stitch 產出的 2500 × 1686 PNG
- LINE 會自動切成 4 個點擊區域

### 4 個點擊動作設定

| 區域 | 動作類型 | 設定 |
|------|---------|------|
| A（左上）立即預約 | **連結** | URL：`https://liff.line.me/{你的 LIFF ID}/booking` <br>動作標籤（語音讀取用）：立即預約 |
| B（右上）我的預約 | **連結** | URL：`https://liff.line.me/{你的 LIFF ID}/my-bookings` <br>動作標籤：我的預約 |
| C（左下）服務價目 | **文字** | 傳送文字：`價格` <br>動作標籤：服務價目 |
| D（右下）營業資訊 | **文字** | 傳送文字：`營業時間` <br>動作標籤：營業資訊 |

### 存檔 + 啟用

按「儲存」後選「立即套用」，LINE 官方帳號的所有好友下次打開聊天室就會看到新的 Rich Menu。

---

## 注意事項

1. **圖片尺寸必須精準** — 2500 × 1686 是 LINE 規定的 Full size。少一 pixel 都不行。
2. **檔案大小 < 1MB** — 若 Stitch 產出超過 1MB，用 [TinyPNG](https://tinypng.com/) 壓縮。
3. **字體 embed** — 產出前確認字體有嵌入，不然換到其他地方會變亂碼。
4. **先在小尺寸預覽** — 把圖縮到 400px 寬看還清不清楚，不清楚就加大字體重做。
5. **可以多做幾版比較** — 同一個 prompt 跑 3 次，選最順眼那版。

---

## 測試 Checklist

上線前在手機 LINE 中檢查：

- [ ] Rich Menu 有顯示在聊天室底部
- [ ] 點「立即預約」→ 打開 LIFF 預約頁
- [ ] 點「我的預約」→ 打開 LIFF 我的預約頁
- [ ] 點「服務價目」→ 觸發 Flex Carousel 價目表訊息
- [ ] 點「營業資訊」→ 觸發營業時間 Flex 卡片訊息
- [ ] 文字在手機尺寸下清晰可讀
- [ ] 左上格確實視覺上最吸引目光

---

## 變體建議

如果第一版不滿意，可以嘗試：

1. **All white 版** — 4 格全白背景，只靠圖示 + 文字區別。更極簡。
2. **Outlined 版** — 白底 + 圖示用線條風格（不是實心）。更輕盈。
3. **Color accent 版** — 只有左上格有強色，其他 3 格白底，但每格的圖示用不同淡色（綠/藍/橙/紫）做微分層。
4. **Photo 版** — 左上格用店家實景照片當背景 + 半透明黑遮罩 + 白字。比較有氛圍感但風險較高。
