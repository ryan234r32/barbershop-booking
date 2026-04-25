# In-Flight Work — V3 改版執行追蹤

> **用途**：每天開工前看一眼，避免「咦這個 worktree 在做什麼」。
> **更新頻率**：每次 worktree 建立 / 切換 / merge 都要更新。
> **戰略來源**：[docs/PRD-v3.md §13 執行計劃（Worktree 戰略）](../docs/PRD-v3.md#13-執行計劃worktree-戰略)

---

## 🚦 同時並存上限

**任何時刻最多 2 個 worktree** + main。Solo dev 紀律。

---

## 🟢 Active Worktrees（同時並存上限 2）

| Worktree 路徑 | Branch | Wave | Owner Tab | Status | 動到的檔案區域 | 開工日 |
|--------------|--------|------|-----------|--------|---------------|--------|
| _(目前無)_ | | | | | | |

---

## 📦 Open PRs（等待 review/merge）

| PR # | Title | Wave | Branch | Status | 開 PR 日 |
|------|-------|------|--------|--------|----------|
| _(目前無)_ | | | | | |

---

## ✅ Completed This Wave

### Wave 0：基礎清理（2026-04-25 完成）
- [x] CLAUDE.md 加訪談自動累積/輪替 convention（commit `a7c0b26`）
- [x] PRD-v3 + 訪談 + 週報 + 服務確認表 commit（`c569571`）
- [x] scripts 工具 commit（`f053846`）
- [x] sw.js 加進 .gitignore
- [x] 清掉 wt/build / wt/explore / wt/review 三個舊 worktree
- [x] 救出 PRD-v2.1-decisions.md (untracked，待後續 commit)

### Wave 1：Phase A 雜事
- [ ] 1.1 §5 CRM 兩個常數（10 分）
- [ ] 1.2 §5 segmentation 邏輯重寫（半天）
- [ ] 1.3 §11 #2 後台手動新增預約送出鈕修復（30 分）
- [ ] 1.4 §11 #3a 後台「保持登入 30 天」cookie（30 分）
- [ ] 1.5 §11 #5「我的預約」按鈕效能（1 hr）
- [ ] 1.6 §2 認知通知文案 + 行事曆顯示邏輯（半天）
- [ ] 1.7 §7 關鍵字回覆（燙/染/改/取消）（1.5 天）

### Wave 2：Schema 大改動
- [ ] §1 Service schema + seed.ts 重寫
- [ ] §3 ConsultationRequest 表
- [ ] §8 Coupon 表 + feature flag

### Wave 3：行事曆 + Excel 匯入（並行）
- [ ] §4 行事曆 V3 全套
- [ ] §10.1 2025 Excel 匯入

### Wave 4：依賴 schema 的功能（sequential）
- [ ] §3 諮詢 admin UI + 漂髮關鍵字
- [ ] §6 付款對帳 + LIFF 匯款
- [ ] §8 回購券 A/B test

### Wave 5：報表 + 收尾
- [ ] §10.2 8 個報表 widget
- [ ] §9 品牌設計套用
- [ ] §11 Rich Menu 6 格 + AI 圖替換
- [ ] 全面 QA + dogfood

---

## 🎯 Next Up

**下一個動作**：Wave 1.1 — §5 CRM 兩個常數（當第一個 PR 練習）

---

## 📋 Worktree 操作 cheatsheet

```bash
# 開新 worktree
git worktree add .claude/worktrees/<name> -b wave-N/<feature> origin/main

# 進去工作
cd .claude/worktrees/<name>
npm install   # 第一次需要
npm run dev -- -p 3001   # 跟 main 不同 port

# Worktree 完成 → 推 + PR
git push -u origin wave-N/<feature>
gh pr create --title "wave-N: <feature>" --body "..."

# PR merge 後清理
cd /Users/ryan/Documents/VS_code/理髮廳
git worktree remove .claude/worktrees/<name>
git branch -d wave-N/<feature>
git fetch --prune origin
```

---

## 🚨 反 pattern 提醒（每次看到「想開第 3 個 worktree」的衝動就回來看）

1. ❌ 一次開 5 個 worktree 想「全部平行」 → Solo dev 不可能 deep work 5 件事
2. ❌ Schema 拆 3 個 worktree 平行做 → Prisma migration 順序會打架
3. ❌ Calendar worktree 養 3 週 → main 一直在動，最後 rebase 地獄
4. ❌ Wave 4 三個並行做 → 切 context 兩個都做不深
5. ❌ 跳 wave 順序 → 後面 wave 依賴前面 wave 的 schema/foundation
