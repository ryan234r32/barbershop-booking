# Rich Menu 設定指南

LINE Rich Menu 是聊天室底部的常駐選單，讓使用者一鍵操作最常用的功能。

## 選單配置（V3，2×2 = 4 格）

V3 改版：6-cell 過於擁擠且「改/取消」與「我的預約」功能重疊；門市資訊使用率低，改放在歡迎訊息與 Flex 卡片 footer。BR 改放使用率高的「匯款資訊」。

### Row 1
| 位置 | 按鈕文字 | 動作 | 說明 |
|------|---------|------|------|
| TL (0-1250) | 立即預約 | URI → LIFF `/booking` | 開啟預約頁面 |
| TR (1250-2500) | 我的預約 | message「我的預約」 | 觸發關鍵字 → 動態 Flex（含本人未來預約清單） |

### Row 2
| 位置 | 按鈕文字 | 動作 | 說明 |
|------|---------|------|------|
| BL (0-1250) | 服務項目 | message「服務價目」 | 觸發關鍵字 → 服務價目 carousel |
| BR (1250-2500) | 匯款資訊 | message「匯款」 | 觸發 payment intent → 帶該客最近一筆 booking 金額的匯款 Flex |

- 尺寸：2500 x 1686
- 佈局：2 欄 x 2 列，每格 1250 × 843
- 底部 Chat Bar 文字：「選單」
- 內部命名：`barbershop-main-menu-v3`（V1 的 `barbershop-main-menu` 與 V2 的 `barbershop-main-menu-v2` 會被刪除）

## 前置條件

1. `.env` 中已設定：
   - `LINE_CHANNEL_ACCESS_TOKEN` — LINE Messaging API Channel Access Token
   - `NEXT_PUBLIC_LIFF_ID` — LIFF App ID

2. 已安裝 `dotenv` 和 `tsx`（已在 devDependencies 中）

## 步驟一：產生 Rich Menu 圖片

1. 用瀏覽器開啟 `scripts/generate-rich-menu-image.html`
2. 選擇顏色主題（預設為 LINE 綠色 #1DB446）
3. 點擊「Save as PNG」下載圖片
4. 將圖片存放至 `scripts/rich-menu.png`

圖片規格要求：
- 尺寸：**2500 x 1686 px**（4 個按鈕，每格 1250 × 843）
- 格式：PNG 或 JPEG
- 檔案大小：1MB 以下（PNG 超過 1MB 用 `sips -s format jpeg -s formatOptions 92 rich-menu.png --out rich-menu.jpg` 壓成 JPEG）

> 配色（V3，與專案 brand 一致）：
> - Forest Green `#003D2B`（TL 主視覺）
> - Cream Beige `#FAF1E0`（TR / BL）
> - Charcoal Brown `#3D3733`（BR 匯款資訊）
> - Sage Mute `#9CB1A4`（英文副標）

## 步驟二：執行設定腳本

```bash
# 方式 A：指定圖片路徑
npx tsx scripts/setup-rich-menu.ts --image scripts/rich-menu.png

# 方式 B：自動偵測 scripts/rich-menu.png
npx tsx scripts/setup-rich-menu.ts
```

腳本會依序執行：
1. 刪除舊的同名 Rich Menu（`barbershop-main-menu`）
2. 建立新的 Rich Menu
3. 上傳圖片
4. 設定為所有使用者的預設選單

## 步驟三：驗證

在 LINE App 中：
1. 開啟理髮廳官方帳號的聊天室
2. 底部應出現「選單」的 Chat Bar
3. 點擊展開後應看到 **4 個按鈕（2×2 排列）**
4. 測試每個按鈕：
   - 「立即預約」→ 應開啟 LIFF 預約頁面
   - 「我的預約」→ 應送「我的預約」並回 Flex 卡片含本人未來預約
   - 「服務項目」→ 應送「服務價目」並收到服務價目 carousel
   - 「匯款資訊」→ 應送「匯款」並收到 payment guide Flex（含銀行帳號 + 該客最近一筆 booking 金額 + 複製按鈕 + 後五碼提示）

## 手動操作（備用）

如果腳本有問題，可以用 curl 手動操作：

### 列出所有 Rich Menu

```bash
curl -s https://api.line.me/v2/bot/richmenu/list \
  -H "Authorization: Bearer $LINE_CHANNEL_ACCESS_TOKEN" | jq
```

### 刪除 Rich Menu

```bash
curl -X DELETE https://api.line.me/v2/bot/richmenu/{richMenuId} \
  -H "Authorization: Bearer $LINE_CHANNEL_ACCESS_TOKEN"
```

### 上傳圖片

```bash
curl -X POST https://api-data.line.me/v2/bot/richmenu/{richMenuId}/content \
  -H "Authorization: Bearer $LINE_CHANNEL_ACCESS_TOKEN" \
  -H "Content-Type: image/png" \
  --data-binary @scripts/rich-menu.png
```

### 設定為預設選單

```bash
curl -X POST https://api.line.me/v2/bot/user/all/richmenu/{richMenuId} \
  -H "Authorization: Bearer $LINE_CHANNEL_ACCESS_TOKEN"
```

### 取消預設選單

```bash
curl -X DELETE https://api.line.me/v2/bot/user/all/richmenu \
  -H "Authorization: Bearer $LINE_CHANNEL_ACCESS_TOKEN"
```

## 故障排除

| 問題 | 解決方式 |
|------|---------|
| 圖片上傳失敗 (413) | 確認圖片為 2500x1686，格式 PNG/JPEG，大小 < 1MB（超過用 `sips` 壓成 JPEG） |
| 選單不顯示 | 確認已設定為預設選單 + 重新加入好友或等待 5 分鐘 |
| LIFF 頁面開不起來 | 確認 LIFF ID 正確，且 LIFF endpoint URL 已設定 |
| Token 過期 | 至 LINE Developers Console 重新發行 Channel Access Token |
