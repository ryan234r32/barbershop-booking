# 日常操作 cookbook

> 給老闆 / 店員用。每一篇都是「我要做 X，怎麼點？」的最短路徑。

## 登入後台

1. 用手機瀏覽器（建議 Safari）打開 [https://barbershop-booking-ryan234r32s-projects.vercel.app/login](https://barbershop-booking-ryan234r32s-projects.vercel.app/login)
2. 輸入 email + 密碼 → 「登入」
3. **加到主畫面**（iOS Safari → 分享 → 加到主畫面）— 之後從主畫面開像 app 一樣
4. **30 天免登入**：勾「自動保持登入」，cookie 過期時系統會用 localStorage token 自動續

## Top 10 常用操作

### 1. 看今天有誰來

`/calendar` 或 `/reports?view=daily`
- 上方 hero 卡 = 今日預估營收 + 已對帳進度
- 下方 = 每筆預約 + 客戶資訊（segment 標籤：VIP / 常客 / 新客 / 流失中）
- 紅色框 = 已服務但未對帳（要記得去結帳）

### 2. 客人打電話來預約（手動建）

`/bookings/new` 或日曆右下角 `+` 按鈕
1. 服務 → 日期 → 時段 → 顧客資訊（電話搜尋自動帶名字）
2. 「新增預約」
3. 系統 **不會** 推 LINE 給客人（admin 建立的不推）— 自己提醒客人時間

### 3. 改期 / 取消

點預約 → 全頁 sheet 打開
- **改期**：「改期」按鈕 → 重選日期時段 → 確認
  - 不會新建一筆，是 update 同一筆 booking + 保留付款狀態
- **取消**：滑到底「取消預約」→ 確認
  - 客人收到 LINE 取消通知

### 4. 客人來了：標報到

預約 sheet 上方有三段式 segment：
```
[尚未到來]  [已報到]  [爽約]
```
點「已報到」即可。沒按確認 dialog（reversible）。再按一次「尚未到來」可以還原。

### 5. 服務完成：結帳

點預約 → 「進行結帳」按鈕（只有「已報到」才會出現）→
1. 輸入金額（預設 = 服務定價，可以改）
2. 選付款方式：**現金** / **銀行轉帳** / **綠界 ATM**
3. 加備註（選填，例如「今天沒打折」）
4. 「完成結帳」→ status 變 COMPLETED + 客人收 LINE 收據

### 6. 客人爽約

點預約 → 「爽約」segment → 確認
- 系統自動加 `user.violationCount += 1`
- 累積 3 次 → 該客戶下個月只能打電話預約（系統會擋線上預約）
- 違規次數會在客戶 CRM 顯示

### 7. 客人匯款後對帳

兩種來源：
- **客人在 LINE 傳「末五碼」**（5 位數字）→ 系統自動 status 升 VERIFYING + 推老闆 LINE
- **綠界 ATM** → 客人轉成功後綠界 webhook 自動標 RECEIVED（不用手動）

老闆對帳：
1. 收到 LINE 推播 → 點連結進 admin 看
2. 對銀行 app 看末五碼是否對得上
3. 對得上 → admin 後台「確認收款」按鈕 → status RECEIVED
4. 對不上（金額錯 / 找不到）→ 點 booking → 改備註 + LINE 客人

### 8. 推行銷訊息

`/admin/campaigns`
1. 選分群（VIP / 常客 / 新客 / AT_RISK 60 天沒來 / LAPSED 120 天沒來）
2. 看 segment 人數（系統自動算）
3. 寫訊息 → 預覽
4. 「發送」
- ⚠ LINE 推播是有 **月免費額度**的（200 / 500 / 1000 則看方案），超過會收費
- 退一步：用 retention-push cron 自動推（規則寫死，比手動穩）

### 9. 看月報 / 年報

`/reports?view=monthly` 或 `view=annual`
- **每月**：營收 / 服務客數 / 客單 / RFM 矩陣 / 達成率 / 自然語言摘要 / 預警
- **每年**：12 月趨勢 / 客戶結構 / 服務組合 / Highlights / 情境模擬

讀 NL 摘要那段。系統會直接告訴你「該做什麼」。例如：
> 染髮客單比上月跌 8%，主因是 AT_RISK 群組 23% 流失。建議：對該群組推染髮 9 折券。

### 10. 月底打烊：日結

`/admin/day-close` 或 daily view 右上「📋 結帳」
- 確認今天所有 COMPLETED 預約都有對到帳
- 紅色「未對帳」要逐筆處理完才能結帳
- 結完後 `dayClosedAt` 寫進 DB，當天的數字就鎖死了（之後不會再變）

## 客戶 CRM

`/admin/customers` — 全部顧客列表，按最近來訪排序
- 點進去看：訪問次數 / 上次來訪 / 偏好服務 / 累積消費 / 違規次數 / 備註
- 「合併時間軸」顯示這個人所有預約 + 對帳狀態 + LINE 對話歷史
- 點「打電話」直撥 / 點「LINE」開私訊

## 服務管理

`/admin/services`
- 增 / 改 / 刪 / 排序
- 每個服務的欄位：名稱、價格、時段數（1=剪髮 1 小時 / 3-4=染燙）、描述、圖片、是否啟用
- 改完後 LINE 「服務價格」回覆和 LIFF 預約頁的 carousel 會自動更新

## 公休日

`/admin/settings` → 公休日 tab
- 加單日：選日期 → 「加入」
- 加週幾固定休：在 `Tenant.businessConfig.closedDays` 改（接手者要技術介入）
- 公休日當天客人在 LIFF 預約畫面看不到時段

## 預約規則

`/admin/settings` → 預約規則 tab
- 預約窗口（預設 45 天）
- 取消政策（預設：24 小時前免費，當天打電話）
- 違規次數上限（預設 3 次 / 月）

## 抽獎 / 優惠券

`/admin/lottery` — 隨機抽 N 個符合條件的客戶（ORDER BY random()）
- 抽中的人會被 tag 起來（之後不會重複抽到）
- 通知按鈕 → 推 LINE 通知

`/admin/coupons` — 看所有發出去的券 + 使用率
- 發券通常從 campaigns / lottery 流程觸發，這頁是看歷史

## 出包了？

**不要驚慌。** 翻 [RUNBOOK.md](RUNBOOK.md)。如果 RUNBOOK 沒有，打給賣方 / 開 GitHub issue。

## PWA tips

- 建議用「加到主畫面」當 app 用
- iOS Safari 加完後第一次打開要先連 wifi（service worker 安裝）
- 第二次起就可以離線看「歷史資料」（看不到即時資料）
- 收到 push 通知 → 點開直達相關 booking
