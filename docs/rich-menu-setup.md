# Rich Menu 設定指南

LINE Rich Menu 是聊天室底部的常駐選單，讓使用者一鍵操作最常用的功能。

## 選單配置

| 位置 | 按鈕文字 | 動作 | 說明 |
|------|---------|------|------|
| 左 (0-833px) | 立即預約 | URI → LIFF `/booking` | 開啟預約頁面 |
| 中 (833-1667px) | 我的預約 | URI → LIFF `/my-bookings` | 查看/取消預約 |
| 右 (1667-2500px) | 服務價目 | 傳送「服務」 | 觸發關鍵字回覆，顯示服務價目表 |

- 尺寸：2500 x 843 (compact)
- 佈局：3 欄 x 1 列
- 底部 Chat Bar 文字：「選單」

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
- 尺寸：2500 x 843 px
- 格式：PNG 或 JPEG
- 檔案大小：1MB 以下

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
3. 點擊展開後應看到三個按鈕
4. 測試每個按鈕：
   - 「立即預約」→ 應開啟 LIFF 預約頁面
   - 「我的預約」→ 應開啟 LIFF 我的預約頁面
   - 「服務價目」→ 應在聊天室送出「服務」，並收到服務價目表回覆

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
| 圖片上傳失敗 | 確認圖片為 2500x843，格式 PNG/JPEG，大小 < 1MB |
| 選單不顯示 | 確認已設定為預設選單 + 重新加入好友或等待 5 分鐘 |
| LIFF 頁面開不起來 | 確認 LIFF ID 正確，且 LIFF endpoint URL 已設定 |
| Token 過期 | 至 LINE Developers Console 重新發行 Channel Access Token |
