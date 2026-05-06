# Incident Runbook — 出包時翻這本

> 順序：先看「症狀」 → 找對應章節 → 照 SOP 走。每節都標了「需要技術人」還是「老闆自己能解」。

## 00. 我怎麼知道出包了？

訊號來源（依即時程度排）：
1. **LINE 緊急推播** — `ADMIN_LINE_USER_ID` 收到 🔴 開頭的訊息（webhook 連續失敗 / 外部 monitor down / cron 失敗）
2. **客人 LINE 抱怨** — 客人說「預約不能按」「LINE 沒回我」「網頁打不開」
3. **Sentry email** — 註冊 Sentry 帳號收 alert email
4. **每天 11:00 安全報告** — `docs/security-reports/YYYY-MM-DD.md` 自動 commit 進 main，有 ⚠ 就要看
5. **Vercel deployment failed** — 推 GitHub 後沒看到 preview 通過（gh pr checks）

## 01. 整個網站打不開（500 / 502 / timeout）

**症狀**：admin 後台 + LIFF 預約頁全部開不起來
**老闆自己能解？**：❌ 需要技術人

**SOP**：
1. 打開 [Vercel Dashboard](https://vercel.com) → barbershop-booking project → 看最新 deployment
2. **如果 deployment 紅色 FAILED** → 點進去看 Build Logs
   - 通常是 env 沒設、TypeScript error、或 next build 自己掛
   - 緊急回滾：點上一個綠色 deployment → ⋯ menu → 「Promote to Production」
3. **如果 deployment 綠色但網站 500** → 點 Functions tab → 看 runtime logs
   - 通常是 DB / Redis 連不上 → 看 §02
4. **完全沒有 deployment** → GitHub Actions 可能沒觸發 → 手動 `vercel deploy --prod`

**驗證恢復**：`curl https://barbershop-booking-ryan234r32s-projects.vercel.app/api/health`
回 `{"status":"ok","checks":{"database":"ok","redis":"ok"}}` 就是好了。

## 02. DB / Redis 連不上

**症狀**：`/api/health` 回 `{"checks":{"database":"error",...}}`
**老闆自己能解？**：❌ 需要技術人

**SOP**：
1. **Supabase**：[Dashboard](https://supabase.com/dashboard) → Project → Logs → 看是不是 DB 暫停（Free tier 7 天沒活動會 pause）
   - Pause 了：點「Restore project」按鈕
   - Connection limit hit：升級或重啟 connection pool
2. **Upstash Redis**：[Console](https://console.upstash.com) → DB → Logs
   - Free tier 有每日 command 上限，超過會擋
   - 升級 / 等隔天恢復

**驗證**：`curl /api/health` 兩個都 `ok`。

## 03. LINE 訊息全部不會發 / 不會回

**症狀**：客人在 LINE 講話 bot 沒反應；新預約老闆沒收到通知
**老闆自己能解？**：⚠ 部分

**先檢查**：
1. **LINE Messaging API quota** — Channel 的免費月推播額度用光？
   - [LINE Developers Console](https://developers.line.biz) → Channel → Messaging API → Statistics
   - 用光了：升級方案 or 等下個月（推播額度重置）— **老闆自己能做**
2. **Webhook URL 對不對** — 有沒有改過網域
   - Console → Webhook → 確認是 `https://barbershop-booking-...vercel.app/api/webhook`
3. **Channel Access Token 過期** — 用 Long-lived 沒問題；Short-lived 會 30 天過期
   - Console → Channel → 重新 issue token → 更新 Vercel env `LINE_CHANNEL_ACCESS_TOKEN`

**signature 連續失敗**（可能被攻擊）：
- LINE 緊急推播會自動發 `🔴 webhook signature 1 分鐘內失敗 5 次` — 看 Vercel runtime logs 找 source IP
- 確認 LINE_CHANNEL_SECRET 跟 LINE Console 對得上

## 04. ECPay 金流出包

**症狀**：客人說「轉帳了系統沒記到」
**老闆自己能解？**：⚠ 看情況

**先看 admin notifications**：
- 系統會自動把「金額不符」的事件 enqueue 一筆 admin notification
- `/admin/messages` 或 admin LINE push 找最近 24h 的 `ecpay_amount_mismatch` 訊息

**最常見三種狀況**：
1. **客人金額轉錯** — 系統 ACK 給綠界但不會自動標 PAID。手動處理：
   - admin 後台找到該 booking → 改備註「實收 NTxxx，差額」→ 自己決定收不收
2. **綠界 sandbox / production 切換漏改** — HashKey/HashIV 不對 → CheckMacValue 全部失敗
   - 改 Vercel env `ECPAY_HASH_KEY` / `ECPAY_HASH_IV` / `ECPAY_OPERATION_MODE` (Test → Production)
   - **改完一定要 redeploy**（env 變更 Vercel 不會自動 reload runtime）
3. **ECPay webhook 沒打進來** — 看綠界商家後台「交易訂單」是否有該筆紀錄
   - 有：`/api/cron/ecpay-sweeper` 每天 3am 會自動掃 5 分鐘以上 stale 的 CREATED 訂單；可手動觸發
   - 沒有：客人轉錯帳號 / 還沒轉

## 05. 重複預約 / 時段衝突

**症狀**：兩個客人同一時段 booking
**老闆自己能解？**：⚠ 取消其中一筆即可（人工協調）

**根因**：理論上 Redis lock + DB 雙重防護。如果還是發生，多半是：
- Upstash Redis 短暫斷線（lock 沒拿到但程式繼續）
- Service `slotsNeeded` 跨午夜 / 跨閉店（business hours validation）

**處理**：
1. admin 取消其中一筆
2. 主動 LINE 道歉 + 補 9 折券 / 改期
3. 如果一週內發生 >1 次，找技術人看 Sentry / Vercel logs

## 06. Cron job 沒跑

**症狀**：客人應該收到的提醒沒收到 / 週報沒進 LINE / 日結沒推
**老闆自己能解？**：❌ 需要技術人

**SOP**：
1. [Vercel Dashboard](https://vercel.com) → Project → Crons tab → 看每條 cron 的 last run
2. 哪條 last run 太久 → 點進去看 invocation log
3. 通常原因：
   - **CRON_SECRET 不對** → 401 一直被擋（重設 env + redeploy）
   - **Hobby plan quota 用光** → 升 Pro ($20/月)
   - **DB / Redis 連不上** → 看 §02

**手動補跑**：
```bash
curl -X POST -H "Authorization: Bearer $CRON_SECRET" \
  "https://barbershop-booking-ryan234r32s-projects.vercel.app/api/cron/reminders"
```

## 07. DB 資料災難（誤刪、回滾）

**症狀**：客人資料 / 預約紀錄不見了
**老闆自己能解？**：❌ 絕對需要技術人 — 操作前先深呼吸

**Backup 在哪**：GitHub Actions → `db-backup-daily.yml` → 每天 11:00 (Taipei) 跑 `pg_dump`，artifact 保留 90 天

**SOP**（半自動 — 用 `scripts/restore-from-backup.sh`）：
1. **先把 prod DB 暫停寫入** — Vercel Project → 設 Maintenance Mode env var → redeploy
2. GitHub UI → Actions → db-backup-daily → 找災難前那天的 run → 下載 artifact
3. `gunzip backup-YYYY-MM-DD.sql.gz`
4. **新建一個 Supabase project 還原進去**（不要直接覆蓋 prod，先驗證資料）
5. 確認資料對 → 把 prod env DATABASE_URL / DIRECT_URL 切過去 → redeploy
6. 解除 Maintenance Mode

**完整 incident 案例**：見 `docs/v3.8-postmortem-customer-data.md`（5/1 發生過一次客戶資料的事）

## 08. 老闆密碼忘了

**老闆自己能解？**：❌ 需要技術人

**SOP**：
1. 連到 Supabase Studio → SQL Editor
2. 跑：
   ```sql
   SELECT id, email, "tenantId" FROM "AdminUser" WHERE email = '<old-email>';
   ```
3. 用 bcrypt 產生新 hash（隨便找一個 online tool 或本機 `node -e "console.log(require('bcryptjs').hashSync('新密碼', 10))"`）
4. UPDATE 進去：
   ```sql
   UPDATE "AdminUser" SET password = '<new-hash>' WHERE email = '<email>';
   ```
5. 用新密碼登入 `/login` → 立刻去 `/admin/settings` 改一個老闆記得住的密碼

## 09. JWT Token 全部失效（端點全 401）

**症狀**：剛剛還能登入，現在每個 admin 操作都 401
**老闆自己能解？**：❌ 需要技術人

**根因**：JWT_SECRET env 被改了 / Vercel env 漏設
**SOP**：
1. Vercel → Project → Settings → Environment Variables → 看 `JWT_SECRET` 是不是空的或被改
2. 確認 production / preview / development 三個環境都有設
3. 改完 redeploy（env 變更不會自動生效）
4. 老闆所有人重新登入

## 10. CSP 擋住了某個外部資源

**症狀**：admin / LIFF 開啟時某個圖片 / 字體 / API 沒載
**老闆自己能解？**：❌ 需要技術人

**SOP**：
1. 用 Chrome DevTools 打開該頁 → Console → 看 `Content-Security-Policy` 開頭的紅色錯誤
2. 訊息會明確寫「拒絕載入 https://xxx.com 因為 connect-src 沒有它」
3. 在 `next.config.ts` 的 `cspParts` 把該域名加進對應 directive
4. 重 deploy
5. **Why this matters**：CSP 太鬆等於沒設；太緊會讓正常服務跑不動。每加一個外部域名，都該想「為什麼這個服務需要存在」。

## 緊急聯絡

| 服務 | 客服管道 | 備註 |
|---|---|---|
| Vercel | https://vercel.com/help | Pro plan 有 priority support |
| Supabase | https://supabase.com/dashboard → Help | Free tier email-only |
| Upstash | support@upstash.com | |
| LINE Developers | https://developers.line.biz/en/support/ | Forum 通常 24h 內回 |
| Sentry | https://sentry.io/support/ | |
| ECPay 綠界 | 02-2655-1775 / service@ecpay.com.tw | 比 email 快 |

## Don't panic 鐵律

1. **永遠先看 logs，不要猜** — Vercel Functions / Sentry / GitHub Actions 至少看一個
2. **能回滾就先回滾** — Vercel「Promote to Production」之前那個綠色 deploy，5 秒搞定
3. **資料相關的 incident，先停寫入再修** — 防止災難擴大
4. **每次 incident 寫一段 postmortem** — 進 `docs/incidents/YYYY-MM-DD-XXX.md`
5. **不要在恐慌時 git push --force**
