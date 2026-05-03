# Lessons Inbox

> 低摩擦 capture 區，每週日 `/triage` 審核。
> 90% 應該被丟棄，10% 升格進 `CLAUDE.md` 或 `docs/`。
> 這是 **stream**，不是 archive——不怕丟東西。

---

## 2026-04-30 — Next.js dynamic-segment slug 衝突會在 runtime 才爆，preflight + Vercel build 都抓不到

**踩到**：V3.7 PR #55 加 `/api/payments/[paymentId]/note/route.ts`，跟既有
`/api/payments/[bookingId]/mark-received/route.ts` 共用同一層 dynamic segment
但用了不同 slug 名（`paymentId` vs `bookingId`）。

**症狀**：
- `npm run preflight` 全綠（vitest 不跑 Next.js route registration）
- Vercel build 顯示 `success`（webpack 編譯成功）
- **runtime 啟動瞬間 throw `Error: You cannot use different slug names for the
  same dynamic path ('bookingId' !== 'paymentId').`**
- 整個 `/api/*` 樹陷入 fail-loop，每個請求都 `INTERNAL_FUNCTION_INVOCATION_TIMEOUT`
  504 → 看起來像 DB 掛掉，實際是 router 沒啟動
- Supabase dashboard 因此顯示 Unhealthy（沒人查它，free tier 自動降級）—
  但 root cause 不在 DB

**規則**（升格進 CLAUDE.md「Landmines」候選）：
> 在 Next.js App Router 加新 dynamic-segment endpoint 前，先 grep 同層既有
> `[xxx]/` 目錄。如果同一層已有別的 dynamic 名（如 `[bookingId]`），新 route
> **必須**用同一個 slug 名，否則整個 router 樹炸掉。要嘛沿用既有名（必要時讓
> caller 多 query 一次反查），要嘛搬到完全不同 parent path（最乾淨）。

**修法**：把 `/api/payments/[paymentId]/note` 整個搬到 `/api/payment-notes/[paymentId]`
（PR #58 hotfix）。

**為什麼 preflight 沒抓到**：vitest 直接 import handler，繞過 Next.js routing
layer。要在 CI 加 `next build && next start` 真實跑一下 health check 才會抓到。
但這個 cost 太高，**寧可 grep + 自我紀律** 也不要每次 PR 跑 e2e。

---

## 2026-04-30 — 視覺排版 overflow / 重疊是反覆出問題的高頻 lesson（升格候選）

**現象彙整**（一個 demo 內踩 3 種 variant）：
1. **Pill 內文被擠成直排**：MTag 沒加 `whitespace-nowrap`，KpiCard 的 flex
   header 在標題長（"新客 90 天回訪率"）時會把「紅燈」擠成「紅 / 燈」直排
2. **絕對定位 tier label 重疊**：BenchmarkRail 用 `position: absolute` +
   `left: X%` 排業界標籤，標籤 text 太長（"業界平均 40%" 9 字）+ 起點 0%
   tier 太靠左 → "0%" 跟 "業界平均 40%" 重疊在窄畫面
3. **數字截斷**：Hero 卡 `truncate` + `text-xl` 在 360px mobile 把
   "NT$3,000" 砍成 "NT$3,..."

**規則**（升格進 CLAUDE.md「Landmines」候選）：

> 任何 admin/reports 視覺元件預設：
> - **所有 pill / badge / tag**：必須 `whitespace-nowrap shrink-0`
> - **絕對定位的 tier label**：標籤 ≤ 5 字（不要寫「業界平均 X%」，寫「業界 X%」），
>   且不要包含 0% / 100% 這種會重疊起點 / 終點的 tier
> - **數字 / 金額 cells**：必須 `whitespace-nowrap`，不要用 `truncate`（截斷數字
>   破壞 scannability）
> - **預設想 360px iPhone SE 寬**，不是 desktop 1280px
> - 三欄 grid 在 360px 每欄只剩 ~110px：金額 + label + 任何輔助文字必須
>   能在這寬度裡完整顯示

**修法 pattern**（複用）：
- pill: `inline-flex items-center whitespace-nowrap shrink-0 ...`
- benchmark tier: 標籤 ≤ 5 字 + 不要 0% tier
- 數字 cell: `whitespace-nowrap` 不 `truncate`

**為什麼一直再犯**：
- preflight (typecheck + lint + vitest) 完全不檢視覺 — 沒任何自動 guard
- 開發時習慣在 desktop 看，沒切到 360px viewport 驗證
- 字體 / spacing / column 這種「品味」改動 review 時一掃而過

**lesson 結論**：每次動 reports 視覺元件，必須:
1. 把 mobile 視窗縮到 360-375px 親眼看一遍
2. 每個 pill / badge / 數字 cell grep 確認有 `whitespace-nowrap`
3. 想清楚「這個 element 在最窄 viewport 裡會不會重疊隔壁」


## 2026-05-02 — 🚨 P0 Data Loss Incident — clean-test-data.ts + import 漏 2025

**踩到**：5/1 凌晨 01:28-01:51（**不在我那輪 PR #60-72 的 timeline**）有人/某 session
跑了 `scripts/clean-test-data.ts --commit` + `scripts/import-historical-excel.ts`，
但 import 漏了 `2025預約表Ken老師.xlsx`（檔名跟其他不同：多了「Ken老師」）。

**結果**：
- 4/30 audit 看到 2783 booking → 5/2 user 開報表發現 478 booking
- 2024: 1216 → 472（剩 hist- 部分）
- **2025: 1169 → 0（整年消失）**
- 2026: 398 → 6（剩 hist- 部分）
- 共 2305 筆消失，1614 筆是 dev/test data（接受丟）+ 691 筆是 hist 真實營業歷史（救回）

**為什麼能救**：
1. 原始 Excel `docs/{2024,2025,2026}預約表*.xlsx` 都還在
2. `import-historical-excel.ts` 是 idempotent (`hist-{sha1}` deterministic ID)
3. 跑 `--all --commit --allow-no-contact` + DIRECT_URL（pgbouncer 6543 timeout 太短）
   兩輪後（第一輪有 33 筆 transaction timeout，第二輪補上）完全恢復
4. 跑 `recalculateSegments()` 把 segment snapshot 重新算

**規則**（升格進 CLAUDE.md「Landmines」候選）：

> 任何 destructive DB script (clean-*.ts / cleanup-*.ts / dedup-*.ts) 必須：
> 1. **檔頭明確警示「這個 script 會刪 prod 資料」+ 預期影響範圍**
> 2. **預設 dry-run，--commit 才寫**（多數已有，但要強制）
> 3. **不要混用 --reset 跟 import script** — reset + 部分 import 比完全 reset
>    更糟（resulting state 跟 source data 不一致）
> 4. **DB write script 必須用 `DIRECT_URL`（port 5432）** 不要用 pgbouncer
>    pooled connection（6543）— pooler timeout 30s，大批 import 會炸
> 5. **任何重大 DB op 前先 `pg_dump` 或確認 Supabase PITR 啟用**

**為什麼一直再犯**：
- destructive script 留在 scripts/ folder，沒有區分「可重跑 vs 一次性危險」
- 用 same script 名稱 (clean-*.ts)，多 session 不知道哪些已跑過
- Supabase pooler 6543 在 multi-tenant 多 session 下 connection slot 又少又快 timeout

**這次 fix**：
- `clean-test-data.ts` + `cleanup-test-bookings.ts` 加上 archive notice +
  改名為 `*.archived.ts.bak` 避免 tab-completion 誤觸
- import script 應該支援 `--connection=direct` flag 自動選 DIRECT_URL

**incident 完整 timeline**：
- 4/30 14:00 — Ryan 跑 audit script + recalc + Test prefix（無 destructive）
- 5/1 01:28 — UNKNOWN session 跑 `clean-test-data.ts --commit`（622 user 砍 → 重建 hist）
- 5/1 01:35-51 — UNKNOWN session 跑 import 但只用 `--year=2024 + --year=2026`，
  漏掉 2025（Excel 檔名 `2025預約表Ken老師.xlsx` 跟 default pattern 不同）
- 5/2 17:30 — Ryan 看報表發現整年 2025 沒了
- 5/2 17:45 — Ryan 跑 `--all --commit --allow-no-contact` (DIRECT_URL) 恢復

