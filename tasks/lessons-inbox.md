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
