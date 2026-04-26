# In-Flight Work — V3 改版執行追蹤（Branch-only 模式）

> **用途**：每天開工前看一眼，確認今天該做什麼、有什麼 blocker。
> **更新頻率**：每次開新 branch / 開 PR / merge 都要更新。
> **戰略來源**：[docs/PRD-v3.md §13 執行計劃](../docs/PRD-v3.md#13-執行計劃branch-based-wave-執行模型)
> **執行模式**：Branch-only（一次一條 branch、sequential 工作、不開 worktree）

---

## 🚦 工作紀律（鐵律）

| 規則 | 數值 |
|------|------|
| 同時 active branch 上限 | **1 條**（solo dev 一次做一件事） |
| 例外：Wave 3 calendar 期間 | 可開 1 條獨立 polish branch（純 docs / asset） |
| 每個 branch 壽命 | 1–3 天（calendar 例外可到 14 天，內部分階段 sub-PR） |
| 跳 Wave 順序 | **絕對禁止**（後波依賴前波 schema/foundation） |
| 直接 push main | **絕對禁止**（GitHub branch protection 強制） |

---

## 🟢 Active Branch（同時上限 1）

| Branch | Wave | Status | Open PR # | 預估完成 |
|--------|------|--------|-----------|----------|
| `wave-1.1/crm-thresholds` | 1.1 | PR open，等 review | _待補_ | 2026-04-25 |

---

## 📦 Open PRs（等待 review/merge/Vercel preview 驗證）

| PR # | Title | Wave | Branch | Vercel Preview | Status |
|------|-------|------|--------|----------------|--------|
| _(目前無)_ | | | | | |

---

## 🚧 Blockers（等外部回應，無法推進）

| Blocker | 影響 Wave | 等誰 | 自從 |
|---------|----------|------|------|
| 服務項目確認表 | Wave 2a (§1 Service seed.ts finalize) | 老闆 Ken | 2026-04-24（已寄） |
| 第三次老闆訪談時間 | Wave 5 中期 demo | 老闆 Ken | 待約 |
| service-name-map.json | Wave 3.B (Excel import) | 自己（Wave 2a 完成後可開始）| — |

---

## ✅ Completed

### Wave 0：基礎清理（2026-04-25 完成）
- [x] CLAUDE.md 加訪談自動累積/輪替 convention（commit `a7c0b26`）
- [x] PRD-v3 + 訪談 + 週報 + 服務確認表 commit（`c569571`）
- [x] scripts 工具 commit（`f053846`）
- [x] sw.js 加進 .gitignore
- [x] 清掉 wt/build / wt/explore / wt/review 三個舊 worktree
- [x] 救出 PRD-v2.1-decisions.md
- [x] PRD-v3 §13 執行計劃 v2 commit（`c11f88d`）
- [x] PRD-v2.1-decisions.md commit（`c81d26a`）
- [x] **切換到 branch-only 工作模式**（CEO + Eng review 雙確認 worktree 是 over-engineering）

### Wave 1：Phase A 雜事（branch-only sequential）
- [x] 1.1 §5 CRM 兩個常數（10 分）— PR 開立 2026-04-25 `wave-1.1/crm-thresholds`
- [ ] 1.2 §5 segmentation 邏輯重寫（半天 + E-10 CTE）
- [ ] 1.3 §11 #2 後台手動新增預約送出鈕修復（30 分）
- [ ] 1.4 §11 #3a 後台「保持登入 30 天」cookie（30 分）
- [ ] 1.5 §11 #5「我的預約」按鈕效能（1 hr）
- [ ] 1.6a §2 認知通知文案 only（1 hr）
- [ ] 1.7 §7 關鍵字回覆（燙/染/改/取消，不含漂髮）（1.5 天）
- [ ] 1.8 §11 #1 Rich Menu 4→6 格重構（1 天，可能等素材）

### Wave 2：Schema 三條獨立 branch（sequential）
- [ ] Wave 2a `wave-2a/service-schema` — §1 Service 重構（3 天，等老闆服務表）
- [ ] Wave 2b `wave-2b/consultation-schema` — §3 ConsultationRequest 表（1 天）
- [ ] Wave 2c `wave-2c/coupon-schema` — §8 Coupon 表 + flag（1 天）

### Wave 3：Calendar 長 branch + Excel 短 branch
- [ ] Wave 3.A `wave-3a/calendar-v3` — §4 行事曆 V3（10-14 天，內部拆 sub-PR 階段 merge）
- [ ] Wave 3.B `wave-3b/excel-import` — §10.1 Excel 匯入（4-5 天，Wave 2a 後可開）

### Wave 4：依賴 schema 的功能（sequential）
- [ ] Wave 4a `wave-4a/consultation-flow` — §3 諮詢 admin UI + 漂髮關鍵字
- [ ] Wave 4b `wave-4b/payment-ux` — §6 付款對帳 + LIFF 匯款
- [ ] Wave 4c `wave-4c/coupon-ab` — §8 回購券 A/B test

### Wave 5：報表 + 收尾
- [ ] Wave 5 `wave-5/reports` — §10.2 8 個報表 widget
- [ ] §9 品牌設計套用（小 PR 可直接 main，純 CSS）
- [ ] §11 AI 圖片替換
- [ ] 全面 QA + dogfood 3-5 天

---

## 🎯 Next Up

**今天**：Wave 1.1 PR review + merge 後接 Wave 1.2（§5 segmentation 邏輯重寫，整合 E-10 CTE）

---

## 📋 Branch SOP cheatsheet

### 開新 task（5 秒）
```bash
cd /Users/ryan/Documents/VS_code/理髮廳
git checkout main
git pull origin main
git checkout -b wave-N/feature-name
```

### 開發中（隨時）
```bash
git add .
git commit -m "feat(area): 描述 (PRD-v3 §X)"
git push -u origin wave-N/feature-name   # 第一次推
git push                                  # 後續推
```

### 開 PR（1 分鐘）
```bash
npm run lint && npm run test   # 自驗
gh pr create --title "wave N: feature" --body "
## 動什麼
- ...

## PRD 出處
- §X

## 驗證
- [x] lint pass
- [x] test pass
- [ ] Vercel preview URL 親眼測過
"
```

### Vercel preview 驗證
- 開 PR 後 Vercel 自動部署 → bot 在 PR 留 preview URL
- 親自打開 → 測新功能 + spot-check 幾個既有功能不要 regression
- OK 才按 Merge button

### Merge 後收尾（5 秒）
```bash
git checkout main
git pull origin main
git branch -d wave-N/feature-name        # 砍本地分支
git fetch --prune                         # 清掉遠端已刪 branch 的引用
```

---

## 🚨 反 pattern 提醒（看到衝動就回來看）

1. ❌ 一次開 2 個以上 branch 同時改 → 你會搞不清楚哪個改到哪
2. ❌ 直接 commit 到 main → GitHub branch protection 會擋，但別嘗試
3. ❌ Schema migration 沒先 Supabase snapshot 就 push → 出包無法回
4. ❌ Wave 順序跳 → Wave 4 依賴 Wave 2 schema，先做空中樓閣
5. ❌ 用 `db:push` 不用 `prisma migrate dev` → autoplan E-20 明確禁止
6. ❌ PR 沒看 Vercel preview 就按 Merge → 失去最後一道安全網
7. ❌ Pre-push hook 失敗用 `--no-verify` 繞過 → 失去 build/test 保護
8. ❌ PR 太大（>500 行）→ 拆，diff review 視線會放過 bug

---

## 📝 為什麼從 worktree 改成 branch-only

2026-04-25 跑 CEO + Eng review，雙確認：

- Worktree 真正的 unique value 是「**多個 dev server 同時跑**」「**Claude 多 session 並行**」
- 我（solo dev）兩個都不會發生 — 我是 sequential 工作者
- Worktree 帶來的多餘 overhead：管理 4 個資料夾、merge 衝突風險、注意力碎裂
- Branch + GitHub PR + Vercel preview 已經完整覆蓋「不動 main」需求
- Linus Torvalds 自己 30 年 Linux kernel 也很少用 worktree

**結論**：worktree 是 over-engineering for solo sequential dev。Branch-only 是更合身的工具。
