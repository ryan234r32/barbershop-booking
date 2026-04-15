# Claude Code + Git Worktree 工作流手冊

> 整理日期：2026-04-15
> 脈絡：一天之內同時開 5–6 個 Claude session 在同一個 `main` 分支修 code，
> 從「狀態一直在變」「不知道是誰改的」「兩個 session 打架」的混亂中，
> 梳理出可複製的工作流。

---

## 1. 🎯 核心概念（一句話版）

**Git Worktree = 同一個 repo 同時攤在多張書桌上。每張書桌獨立的 branch、獨立的檔案，兩張桌子互不干擾。** 配合 Claude Code，就是「每個平行任務一個 worktree、一個 session」。

---

## 2. 🔬 社群頂尖工程師怎麼做（研究結果）

### Boris Cherny（Claude Code 共同作者）
- 稱 worktree 是「單一最大的生產力解放」
- **個人同時跑 10–15 個 session**
- 把 `--worktree` flag 直接內建進 Claude Code CLI（v2.1.50+）
- 建議同時維持 **3–5 個 worktree**
- 來源：[Threads](https://www.threads.com/@boris_cherny)

### incident.io 工程團隊
- 用 worktree + 多 Claude 把 API 生成時間砍 **18%**（~30 秒/次）
- 成本：約 $8 API credits
- 結論：值得
- 來源：[incident.io blog](https://incident.io/blog/shipping-faster-with-claude-code-and-git-worktrees)

### Simon Willison（輕量派代表）
- **還沒採用 worktree**
- 要隔離時直接 `git clone` 到 `/tmp` 一份 fresh checkout
- 理由：心智負擔更低
- 來源：[simonwillison.net/2025/Oct/5](https://simonwillison.net/2025/Oct/5/parallel-coding-agents/)

### 反模式（HN 使用者踩雷）
- 分支關係亂掉、merge 時機沒抓好 → 「變成一坨」
- 解法：建立 parent/child 目錄結構 + 寫 wrapper 強制命名
- 來源：Hacker News 46591395

### 🎯 社群共識
- **粒度**：一 task 一 worktree 一 branch，不是按時間（一天/一週）切
- **不要無腦全用 worktree**：快速 bug fix、一次性探索 **不值得**開
- **判斷點**：只有「真正平行、檔案邊界獨立」的任務才開

---

## 3. ⚠️ 今天踩到的 6 個坑

### 坑 1：多 session 共享 `main` → 狀態一直變
**症狀**：我盤點時看到 2 個未 commit 檔案，過 5 分鐘回來變 5 個，再過 10 分鐘變 8 個。誰改的？不知道。
**根因**：所有 Claude session 在同一個 working tree，互相寫入。
**教訓**：同時超過 2 個「會寫 code」的 session → 強制用 worktree。

### 坑 2：兩個 session 對同一檔案的理解矛盾
**症狀**：付款 session 說「那兩個未 commit 檔是你自己改的」；Gstack session 說「不是我寫的」。
**根因**：第三個 session 改了但沒留 handoff 就關掉。
**教訓**：session 關閉前一定要「盤點 5 問」（任務/改檔/階段/安全/handoff）。

### 坑 3：LIFF 驗證失敗，查了一個下午
**症狀**：`LINE_CHANNEL_ID` env 設錯 → LIFF token `aud` 對不上 → 401。
**根因**：部署時用了 Messaging API channel 的 ID，不是 LIFF 所屬的 Login channel。
**教訓**：LIFF_ID 格式 `<channelId>-<hash>`，前綴就是父 channel 的 ID。
**如何避免**：預設環境變數要加註解說明是哪個 channel 的 ID。

### 坑 4：`ps aux` 意外洩漏 DB 密碼
**症狀**：查 background task 時跑 `ps aux`，Prisma 把 `DATABASE_URL`（含密碼）放在 command-line argument → 整個聊天歷史裡都是。
**教訓**：未來要查 process，用 `ps -o pid,comm`，不要用 `ps aux`。
**已做**：需要 rotate Supabase DB 密碼（尚未處理，建議做）。

### 坑 5：Prisma `@db.Date` 序列化陷阱
**症狀**：前端用 `${b.date}T${b.endTime}` 拼時間 → 變成 `Invalid Date` → 所有預約被濾掉。
**根因**：Prisma `@db.Date` 序列化到前端是 **完整 ISO 字串**（`"2026-04-13T16:00:00.000Z"`），不是 `"YYYY-MM-DD"`。
**修法**：`b.date.slice(0, 10)` 先截日期部分再拼。
**教訓**：跨 timezone + date-only 欄位，不要依賴 DB 做 `gte` 日期比對，改用 JS 端拿 Taipei 時區精準算。

### 坑 6：pgbouncer（port 6543）不支援 `prisma db push`
**症狀**：`npm run db:push` 永遠卡住不動。
**根因**：Supabase 的 6543 走 pgbouncer connection pool，不支援 schema DDL。
**修法**：改走 port 5432 direct connection。
**已在 commit `0bf9c85` 修好**：`prisma.config.ts` 改用 `DIRECT_URL`。

---

## 4. 📋 這個專案接下來要做什麼

### 🔥 立刻（今天/明天）
1. **實機驗證今天修的 3 個 bug**（commit `59aa6cc`）：
   - LINE 對話框輸入「我的預約」→ 4/14 不該再出現
   - LIFF `/my-bookings` 「即將到來」看得到新預約
   - 付款頁送末五碼 / 選現金 → 自動關閉 LIFF 回 LINE → 收到對應 Flex
2. **Rotate Supabase DB 密碼**（坑 4 的後續）
   - Supabase Dashboard → Settings → Database → Reset password
   - `vercel env rm DATABASE_URL production --yes`
   - `vercel env add DATABASE_URL production --value="新 URL"`
   - `vercel --prod`

### 🟡 一週內
3. **補 deferred TODO**：`/api/bookings/[id]/reschedule` 和 `/cancel` 的 body 層 `lineUserId` 冒充防護（CLAUDE.md V1.3 章節有記）
4. **跟老闆對齊 Tier S 金流**：`docs/boss-tier-s-gateway-pitch.md` 話術
5. **歡迎訊息兩段式 + busy notice 6h 冷卻機制**（有方案沒實作）
6. **關 LINE OA 後台的「回應訊息」**（老闆要手動做）

### 🔵 有空再做
7. 取消政策 UI 文案對齊（`cancel-policy-sheet.tsx` 開 LIFF 看一眼確認）
8. 每週日跑一次 `/triage` 把 `tasks/lessons-inbox.md` 的教訓升格到 CLAUDE.md

---

## 5. 🚀 新專案怎麼用新工作流（Setup Guide）

### Step 1：全域設定（一次設好，所有專案都生效）
已在 `~/.claude/settings.json` 設好的 hook（今天做的）：
- `Stop` hook → Glass 音效 + 通知「Claude 回覆完成」
- `Notification` hook → Funk 音效 + 通知「Claude 需要你確認」

### Step 2：新專案起手式
```bash
# 1. clone / init 新專案
git clone <repo> && cd <repo>

# 2. 第一件事：寫專案 CLAUDE.md（給 Claude 看的說明書）
#    - Tech stack
#    - Commands（dev / test / lint / build）
#    - Architecture 概述
#    - Key Conventions

# 3. 建 tasks 資料夾給自己用
mkdir -p tasks
touch tasks/lessons-inbox.md

# 4. 確認 .gitignore 排掉 Claude Code 工具產物
cat >> .gitignore <<EOF
.claude/scheduled_tasks.lock
public/sw.js
EOF
```

### Step 3：每次要做新任務的判斷流程
```
┌────────────────────────────────────────┐
│ 問自己：這個任務要做多久？             │
├────────────────────────────────────────┤
│ < 5 分鐘（typo/文案/讀 code）          │
│   → main 開 claude，做完馬上 commit    │
│                                        │
│ 5–30 分鐘（小 bug fix/小功能）         │
│   → 看 main 是否乾淨                   │
│     乾淨 → main 上做                   │
│     不乾淨 → worktree                  │
│                                        │
│ > 30 分鐘（新功能/重構）               │
│   → 強制 worktree                      │
│   → claude --worktree feat-xxx         │
│   → /rename 中文名                     │
└────────────────────────────────────────┘
```

### Step 4：worktree 實戰指令速查

```bash
# 開新 worktree + 新 session（內建指令，Claude 2.1.50+）
claude --worktree feat-payments

# 手動版（等價）
git worktree add .claude/worktrees/feat-payments -b feat-payments
cd .claude/worktrees/feat-payments
claude

# 進 session 後第一件事：取中文名
/rename 金流串接

# 做完後回到主 repo
cd /path/to/main/repo

# 列出所有 worktree
git worktree list

# 刪除 worktree（branch 也砍）
git worktree remove .claude/worktrees/feat-payments
git branch -D feat-payments
```

### Step 5：紀律規範（照做，別偷懶）

1. **單一 worktree 單一 session**：不要在同個 worktree 開兩個 Claude。
2. **開 session 第一件事**：`/rename 中文任務名` 讓 VS Code 側邊欄看得懂。
3. **關 session 前一定盤點 5 問**：
   - 任務是什麼？
   - 改了哪些檔案？
   - 做到哪個階段？
   - 關掉我安全嗎？
   - Handoff（下一個 session 要知道什麼）？
4. **Working tree 不過夜**：當天結束前 commit 或 stash 乾淨。
5. **每天開工第一件事**：`git status` + `git log --oneline -5`，不要憑記憶繼續。

### Step 6：寫進新專案的 CLAUDE.md（範本）

```markdown
## Workflow Conventions

- **多 session 紀律**：同時要開 2 個以上「會寫 code」的 Claude session 時，
  強制每個 session 用 `claude --worktree <slug>` 開在獨立 worktree，
  不要多個 session 共享 main。開 session 第一件事先 `/rename 中文名字`。
- **換 session 前先盤點**：切到別的 session 之前，在現在這個 session 請它做 5 點盤點
  （任務/改檔/階段/安全/handoff），避免 context 斷裂。
- **Working tree 不過夜**：當天開始前 `git status` 乾淨再動手；當天結束前也要
  commit 或 stash 乾淨。
- **犯錯當下**：小坑/一次性事件 → `/lesson {內容}` 丟進 `tasks/lessons-inbox.md`；
  明顯通則 → 直接加一行到 Key Conventions。每週日 `/triage` 審核升格。
```

---

## 6. 📖 速查表

### 今天學到的 hook 設定（`~/.claude/settings.json`）
```json
"hooks": {
  "Stop": [{"hooks": [{"type": "command",
    "command": "(afplay /System/Library/Sounds/Glass.aiff &) ; osascript -e 'display notification \"Claude 回覆完成\" with title \"Claude Code ✅\"' >/dev/null 2>&1 || true"}]}],
  "Notification": [{"hooks": [{"type": "command",
    "command": "(afplay /System/Library/Sounds/Funk.aiff &) ; osascript -e 'display notification \"Claude 需要你確認\" with title \"Claude Code ⚠️\"' >/dev/null 2>&1 || true"}]}]
}
```

### 今天新增的自訂指令
- `/lesson {內容}` — append 到 `tasks/lessons-inbox.md`
- `/triage` — 每週日審 inbox，升格通則到 CLAUDE.md

### 可能有用的內建指令
- `/rename <name>` — 改 session / tab 標題
- `/hooks` — 查看目前生效的 hook
- `/help` — 查所有指令

---

## 7. 🎓 最重要的一個心得

**並行是昂貴的。** 5 個 session 聽起來爽，但每個 session 你都要追蹤它做了什麼、改到哪、有沒有未 commit 的東西。一旦超過 2–3 個，人腦就開始漏 —— 今天的混亂就是證明。

Boris 能同時跑 10–15 個，是因為他：
1. 每個都在獨立 worktree
2. 任務邊界極清楚
3. 有大量工具自動化追蹤狀態

在你還沒建立這套基礎設施前，**控制在 2–3 個 session 同時活著，會比追求 10 個更實際**。
