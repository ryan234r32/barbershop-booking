# 1008 Hair Studio — HTML Mockups

> **日期:** 2026-04-11
> **用途:** 基於 Fresha UX 研究產出的可互動 HTML 原型

---

## 檔案說明

| 檔案 | 內容 | 預覽 |
|------|------|------|
| [customer-booking.html](./customer-booking.html) | 客人端預約頁 | [preview-customer.png](./preview-customer.png) |
| [admin-today.html](./admin-today.html) | 老闆端今日時間軸 | [preview-admin.png](./preview-admin.png) |

---

## 怎麼打開看

### 方法 1：直接在瀏覽器開啟

因為 mockup 是純 HTML + CSS，可以直接開：

```bash
# 在 Finder 開啟
open docs/fresha-analysis/mockups/customer-booking.html
open docs/fresha-analysis/mockups/admin-today.html
```

### 方法 2：用 HTTP server（推薦，可在手機上測試）

```bash
cd docs/fresha-analysis/mockups
python3 -m http.server 8765
# 然後用手機瀏覽器打開 http://[你的電腦IP]:8765/customer-booking.html
```

### 方法 3：VS Code Live Server 擴充套件

安裝「Live Server」擴充套件，右鍵 HTML 檔 → Open with Live Server。

---

## 客人端預約頁設計重點

### 應用的 Fresha UX Patterns

1. **單頁三區** — 服務 / 日期+時段 / 備註，不跳頁
2. **日曆與時段同頁** — 點日期立即下方顯示時段，Fresha 的核心流暢感
3. **時段按上午/下午分組** — 視覺清晰度
4. **Sticky 底部確認列** — 永遠知道下一步
5. **推薦時段有 badge** — 減少老闆空檔
6. **服務卡片兩欄網格** — 一眼看完所有服務

### 1008 客製化部分

- 品牌綠色 `#059669`（Fresha 是黑白）
- 繁體中文、NT$ 價格
- 取消政策連結（呼應老闆的違規機制）
- 已滿時段保留顯示（讓客人感覺搶手）

### 狀態示範

| 元素 | 狀態 |
|------|------|
| 服務：男士剪髮 | ✓ 已選中（綠色邊框） |
| 日期：4/10 (五) | ✓ 已選中（黑底白字） |
| 日期：週一 | 休息（灰色 + 「休」標籤） |
| 時段：13:00 | 推薦（綠色 + badge） |
| 時段：15:00 | ✓ 已選中（黑底白字） |
| 時段：12:00 / 14:00 / 17:00 | 已滿（灰色 disabled） |

---

## 老闆端今日時間軸設計重點

### 核心情境

**老闆剛剪完一個客人，下一個還沒到。5 分鐘空檔，拿出手機。**

他最想看到的是：今天接下來還有誰要來？

### 應用的設計原則

1. **頁首摘要卡片** — 三個數字（今日預約 / 已完成 / 預計收入）一眼看完
2. **時間軸設計** — 過去（淡）/ 現在（亮）/ 未來（待執行）清楚分層
3. **客人資訊內嵌** — 名字 + VIP/熟客/新客標籤 + 第幾次來訪
4. **一鍵操作** — 「✓ 標記完成」按鈕大、好按
5. **空檔也顯示** — 讓老闆知道哪段時間可以休息 / 插單
6. **FAB 快速新增** — 右下浮動按鈕，客人打電話來時快速建預約
7. **底部 Tab Bar** — 今日 / 行事曆 / 客戶 / 設定 四大功能

### 狀態示範

| 時段 | 狀態 | 視覺 |
|------|------|------|
| 11:00 陳先生 (VIP) | 已完成 | 灰色卡片 + 綠色點 |
| 13:00 林小姐 (熟客) | 已完成 | 灰色卡片 + 綠色點 |
| 16:00 王先生 (新客) | 即將到來 | 白色卡片 + 藍色點 + 操作按鈕 |
| 17:00 | 空檔 | 虛線框 + 「暫無預約」 |
| 18:00 張小姐 (VIP) | 即將到來 | 白色卡片 |
| 19:00 李先生 (熟客) | 即將到來 | 白色卡片 |

---

## 下一步

1. **給老闆看 mockup** — 讓他在手機上實際看這兩個頁面
2. **收集回饋** — 他會說「這裡少了什麼」「那裡不對」
3. **迭代調整** — 用 `/design-shotgun` 生成不同變體
4. **確認後才開始寫 code** — 符合「設計先行」原則

---

## 技術說明

- **純 HTML + Inline CSS** — 零依賴，打開就能用
- **Mobile-first** — 最大寬度 430px（iPhone 14 Pro Max）
- **CSS Variables** — 色彩 / 間距 / 圓角統一管理
- **可直接移植** — 這些 CSS variables 可以成為未來 shadcn/ui theme 的基礎
- **支援 safe-area-inset** — iOS 底部圓角螢幕相容

### 實作時可以直接沿用的

- CSS variables（色彩系統）
- 卡片設計（border-radius, shadow）
- Sticky footer 邏輯
- 時間軸連接線設計
- Date strip 橫向滾動
- 狀態 badge 樣式
