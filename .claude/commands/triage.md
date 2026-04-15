---
description: 每週日審 tasks/lessons-inbox.md，升格通則進 CLAUDE.md、其餘清掉
---

讀 `tasks/lessons-inbox.md` 全部內容。針對每一條教訓，分三類並給一行理由：

- **A（升格 CLAUDE.md）**：真正的通則，會重複發生，適合 `Key Conventions` 段
- **B（升格 spec）**：單一領域的決策，歸去 `docs/` 裡某份已存在的文件
- **C（刪除）**：一次性事件、已過時、太瑣碎、太模糊

**紀律提醒（重要）**：
- 健康比例是 **A:B:C ≈ 1:2:7**
- 如果你想升格超過 30%，停下來重新評估——多半是你在替使用者「表揚努力」，不是真的通則
- 寧可砍過頭，再出現一次再收

**流程**：
1. 先把三類結果列給使用者看，等他確認
2. 使用者點頭後：
   - A 類 → 編輯 `CLAUDE.md` 的 `Key Conventions` 段，加入對應 rule
   - B 類 → 告訴使用者要進哪份 doc（不要擅自改）
   - C 類 → 直接丟棄
3. **清空** `tasks/lessons-inbox.md`（保留 header、清掉所有條目）
4. 提醒使用者 `git add tasks/lessons-inbox.md CLAUDE.md && git commit -m "chore: weekly lessons triage"` — 讓 triage 決策本身進 git history

**不要做**：
- 不要在使用者確認前改 CLAUDE.md
- 不要合併多條成一條（保留使用者原語氣）
- 不要自己加新想法（你不是 lesson 的作者）
