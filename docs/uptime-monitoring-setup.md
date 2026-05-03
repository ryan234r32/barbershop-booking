# V3.8 — 外部 Uptime Monitoring 設定指南

## 為什麼需要外部監控

我們已經有 `/api/cron/health-check` 偵測 DB / Redis 狀態並推 LINE alert，**但有兩個盲點**：

1. **Vercel Hobby plan cron 一天最多 1 次**
   → 服務從掛掉到 alert 觸發**最壞要 24 小時**，老闆完全不知道客戶打不開預約頁。

2. **Cron 自己掛了沒人知道**
   Vercel cron 被 disable / quota 用完 / Vercel 自己 outage → internal alert 系統跟著沉默。
   要有「dead-man's switch」：如果 25 小時沒收到「我有跑」的訊號，就主動發警報。

→ 用兩個外部服務互相補位：

| 服務 | 角色 | Interval | 補的洞 |
|------|------|---------|-------|
| **Better Stack**（或 UptimeRobot） | 主動 ping `/api/health` | 3 分鐘 | 服務 outage 立刻知道 |
| **healthchecks.io** | 被動等 cron 來敲門 | 24h + 1h grace | cron 自己掛掉也會 alert |

兩家不會同時掛。雙保險。

---

## Part 1 — Better Stack（主動 uptime monitor）

### 1.1 註冊

1. 開 https://betterstack.com/uptime
2. 用 GitHub / Google 登入（免費 plan 包含 10 monitors + 3 分鐘 interval，夠用）

### 1.2 建立 monitor

1. Dashboard → **Create monitor** → 選 **HTTP(S)**
2. 填表：
   - **URL**: `https://barbershop-booking.vercel.app/api/health`
   - **Check frequency**: `3 minutes`（免費版最快）
   - **Request timeout**: `30 seconds`
   - **Recovery period**: `2 minutes`（避免 1 次偶發失敗就 alert）
   - **Confirmation period**: `2 minutes`（連續 2 次失敗才算 down）
   - **HTTP method**: `GET`
   - **Expected status codes**: `200`
3. **不要勾** "SSL monitoring" 之類的次要功能（避免免費額度被 SSL alert 吃掉）

### 1.3 設定 outgoing webhook

1. Better Stack monitor 設定 → **Integrations** → **Add integration** → **Webhook**
2. 填表：
   - **Webhook URL**:
     ```
     https://barbershop-booking.vercel.app/api/webhook/uptime-alert
     ```
   - **HTTP method**: `POST`
   - **Headers**: `Content-Type: application/json`
   - **Body** (JSON template — 變數語法依 Better Stack 文件而定，請對照
     [Better Stack webhook docs](https://betterstack.com/docs/uptime/webhooks/)：
     ```json
     {
       "secret": "<填你 env 的 UPTIME_WEBHOOK_SECRET>",
       "monitor": "{{monitor.url}}",
       "status": "{{incident.status}}",
       "detail": "{{incident.summary}}"
     }
     ```
   - **Trigger on**: `Incident started` ✅ + `Incident resolved` ✅
3. **Test webhook** 按一下 — 應該收到 LINE 推播「📡 外部監控 alert」+ summary。

### 1.4 注意事項

- Better Stack 變數佔位語法（`{{monitor.url}}` 這類）依其官方文件為準。
  如果模板送進來的 `status` 不是 `up`/`down`，server 端會用 Zod 擋成 400。
- 建議在 Better Stack 上勾 "Pause during maintenance"，部署/升級期間不要瘋狂 alert。

---

## Part 2 — Healthchecks.io（被動 dead-man's switch）

### 2.1 註冊

1. 開 https://healthchecks.io
2. GitHub 登入（免費 plan 20 checks，夠用）

### 2.2 建立 check

1. Dashboard → **Add Check**
2. 填表：
   - **Name**: `barbershop-booking — daily health-check cron`
   - **Tags**: `prod` `vercel`
   - **Schedule**: 選 **Simple**
     - **Period**: `1 day`
     - **Grace Time**: `1 hour`
   - 按 **Save**
3. 拿到 **Ping URL**，長這樣：
   ```
   https://hc-ping.com/<uuid>
   ```

> Vercel Hobby cron 每天跑 1 次（pattern 在 `vercel.json` 是 `0 19 * * *` UTC），
> grace period 設 1h 是給「cron 偶發 retry」的緩衝。25h 沒收到 ping → healthchecks.io
> 自動發 email + integration alert。

### 2.3 設 alert channel（可選，但建議）

healthchecks.io → **Integrations** → 加 LINE Notify / Email / Slack。
免費版至少配 email。

> Note: healthchecks.io 沒有原生 LINE Messaging API integration。可以用 LINE Notify
> （需要 personal token）或 webhook 打回 `/api/webhook/uptime-alert`（同 Part 1.3，
> 但 monitor 寫 "healthchecks.io"、status 寫 "down"）。

---

## Part 3 — Env 變數設定

### 3.1 產生 secret

```bash
# 32 字 random secret
openssl rand -hex 16
# 或
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
```

### 3.2 加進 Vercel project env

**Vercel Dashboard → Project → Settings → Environment Variables**

| Key | Value | Environments |
|-----|-------|--------------|
| `UPTIME_WEBHOOK_SECRET` | `<剛產的 32 字 random>` | Production + Preview |
| `HEALTHCHECKS_PING_URL` | `https://hc-ping.com/<你的 uuid>` | Production |

> ⚠️ Preview 環境**不要**塞 healthchecks.io URL，否則每次 PR preview 部署都會打 ping，
> healthchecks.io 會以為「主服務一直在跑」而失準。

### 3.3 同步到本地（如果要在 dev 測試）

```bash
vercel env pull .env.local
```

dev 環境通常不需要兩個變數都設：
- 沒設 `UPTIME_WEBHOOK_SECRET` → webhook fail closed 回 401（測試時要記得帶上 secret）
- 沒設 `HEALTHCHECKS_PING_URL` → `pingHealthcheck()` silent skip（dev 不會打到 healthchecks.io）

---

## Part 4 — 上線後驗證 Checklist

- [ ] **手動觸發 down alert**：Better Stack monitor 上按 "Pause" 再 "Test webhook"
      → 老闆 LINE 應收到 `📡 外部監控 alert / 🔴 DOWN ...`
- [ ] **手動觸發 up alert**：恢復 monitor → Better Stack 送 incident.resolved → LINE 收到 `🟢 RECOVERY ...`
- [ ] **驗證 healthchecks.io 有收到 ping**：
      跑一次 `/api/cron/health-check`（用 cron secret）→ healthchecks.io dashboard
      該 check 的 "Last ping" 應更新成「剛才」。
- [ ] **secret 防護**：用 wrong secret call `/api/webhook/uptime-alert` → 應回 401。
- [ ] **alert cooldown**：1 分鐘內連按 2 次 test webhook → 第 2 次會被 emergency-alert 的
      cooldown 吃掉（5 分鐘內同 kind 只推 1 次），這是預期行為。

---

## Part 5 — 對應的 code 路徑

| 功能 | 檔案 |
|------|------|
| Webhook receiver | `src/app/api/webhook/uptime-alert/route.ts` |
| Webhook tests | `src/app/api/webhook/uptime-alert/__tests__/route.test.ts` |
| Healthcheck ping helper | `src/lib/notifications/healthcheck-ping.ts` |
| Cron 接 ping | `src/app/api/cron/health-check/route.ts` |
| Alert kind 註冊 | `src/lib/notifications/emergency-alert.ts` (`external_monitor`) |

---

## Part 6 — 故障排除

| 症狀 | 可能原因 | 解法 |
|------|---------|------|
| Better Stack 送 webhook 但老闆沒收到 LINE | `ADMIN_LINE_USER_ID` 沒設 | Vercel env 加上 |
| 401 from `/api/webhook/uptime-alert` | secret 對不上 / env 沒設 | 對照 Vercel env + Better Stack body template |
| 400 with `VALIDATION_ERROR` | Better Stack 模板變數沒展開 / status 不是 up/down | 看 Vercel logs 的 issues 欄位 → 修 template |
| healthchecks.io 一直顯示 "down" 但 cron 在跑 | `HEALTHCHECKS_PING_URL` 沒設 / cron 沒跑到 ping line | 看 Vercel cron logs 找 `healthcheck-ping` log |
| 同一個 incident 推 6+ 次 | Better Stack retry 不停 | emergency-alert 的 cooldown (5 min/kind) + hourly limit (6/hr) 會擋住，正常 |
