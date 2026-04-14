# Web Push (VAPID) 設定

## 一次性：產生 VAPID 金鑰

在本機跑：

```bash
npx web-push generate-vapid-keys
```

會印出：

```
Public Key:
BNXxxx...xxx

Private Key:
pQyxxx...xxx
```

## 設到環境變數

### Vercel

到 Vercel Dashboard → 你的專案 → Settings → Environment Variables，新增三個：

| Name | Value | Environment |
|---|---|---|
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | 上面的 Public Key | Production + Preview + Development |
| `VAPID_PRIVATE_KEY` | 上面的 Private Key | Production + Preview + Development |
| `VAPID_SUBJECT` | `mailto:你的email@example.com` | Production + Preview + Development |

`NEXT_PUBLIC_` 前綴是**必要**的，讓前端 JS 讀得到 public key。

### 本機 `.env.local`

```
NEXT_PUBLIC_VAPID_PUBLIC_KEY=BNXxxx...
VAPID_PRIVATE_KEY=pQyxxx...
VAPID_SUBJECT=mailto:你的email@example.com
```

## 啟用管理員通知

1. Deploy 後，手機 Chrome / Safari 開 PWA
2. 進「更多」分頁 → 推播通知 → 點「開啟」
3. 允許瀏覽器通知
4. 回到 PWA 主畫面，往下建個測試預約，手機應該立刻跳通知

## 故障排除

- **Safari（iOS）**：必須是 iOS 16.4+、且已把 PWA「加入主畫面」才會出現通知權限
- **通知沒跳**：檢查 Vercel Function Logs，看是否有 `Web Push disabled — VAPID keys not configured` 的警告
- **安靜時段**：20:00-08:00 Taipei 時間不會推播（`src/lib/push/web-push.ts`），這是刻意設計
- **頻道雙推**：若同時設了 `ADMIN_LINE_USER_ID`，你會收到 LINE 訊息 + Web Push 兩個通知，建議擇一

## LINE push 的 opt-in 機制

`ADMIN_LINE_USER_ID` env 若**不設**，LINE push 自動不送。這讓 Web Push 能獨立運作而不干擾。
