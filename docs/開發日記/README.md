# 開發日記 (Dev Diary)

> 給初學者的 5 行格式 — 每天 ≤ 5 分鐘，超過就不會持續。

## 為什麼要寫

不是為了管理，是為了**敘事與複利**。

- 一週後你會忘記今天為什麼那樣決定 → 寫下來
- 三個月後想回顧成長 → 有東西可看
- 卡關時想「我以前怎麼解過類似的」→ 可搜尋
- 試用觀察期想知道「老闆習慣養成了沒」→ 有時間軸
- 將來要寫部落格 / 演講 / Reddit / IndieHackers 分享 → 素材已經在這

## 格式 (5 行)

```markdown
### YYYY-MM-DD (週幾) · mood-word

- **Done**: (1-2 件具體完成事)
- **Stuck/Decision**: (卡點或決定)
- **TIL**: (今天學到的一件事，技術或商業都行)
- **Tomorrow**: (明天打開電腦的第一個動作)
```

只有 5 個欄位，每個 1 行。寫超過就是過度工程。

## 規則

1. **每月一個檔**：`2026-05.md`、`2026-06.md`...新進度往**下面**插（時間順序，可當故事讀）
2. **空白可以**：偶爾忘記寫不用補，連續性比完美重要（Pieter Levels 也會跳過幾天）
3. **TIL 一定要寫**：哪怕只是「`vaul` 的 `h-[Ndvh]` 在 iOS PWA 比 `vh` 安全」這種小事
4. **不寫感想長文**：要寫長的那種留給 [docs/](../) 底下的 plan / postmortem / handoff
5. **Mood 一個字**：順 / 卡 / 累 / 嗨 / 焦 / 平 — 用來看你哪些活動 drain 你

## 週末 5 分鐘 weekly retro

每週日寫一段在當月檔最下面：

```markdown
## Week of YYYY-MM-DD — Weekly Retro

- **Shipped**: (本週實際出貨的東西，PR 號、commit hash)
- **Learned**: (本週最大收穫一句話)
- **Energy drain**: (什麼最耗能量？要避免？)
- **Next week's bet**: (下週只押一件事)
```

靈感來自 Pragmatic Engineer 的 weekly impact log。

## 與 roadmap 的分工

- **[顧客痛點功能Roadmap.md](../顧客痛點功能Roadmap.md)** — 要去哪（未來）
- **[顧客痛點Roadmap互動表.html](../顧客痛點Roadmap互動表.html)** — 拖拉看板（現在）
- **開發日記/2026-MM.md** — 走過哪（過去）

三者各司其職，**不要重複**：
- Roadmap 變了：改 roadmap，**不**抄到日記
- 日記寫的：是當下的**敘事**（為什麼、心情、TIL），roadmap 不需要這些

## Founder Score (4 軸 × 25 分 = 100)

> 互動 HTML 上方會自動顯示。**Coach 不是 judge** — 永遠針對最弱軸給 1 句具體下一步。

### 為什麼用這 4 軸？

不追蹤 commit 數 / code 行數 — 那是 vanity metric，gameable 會腐敗你。
追蹤這 4 軸是因為它們**直接反映 solo founder 的健康度**。

### 計分公式（透明）

| 軸 | 25 分滿分條件 | 0 分情境 | 數據來源 |
|----|--------------|---------|---------|
| **WIP 自律** | NOW ≤ 3 件 | NOW ≥ 8 件（每超過 1 件扣 5 分） | 卡片 stage 即時 |
| **出貨速度** | 每週完成 ≥ 1.5 張卡片（過去 30 天） | 30 天 0 件 | 卡片移到 DONE 的 `doneAt` |
| **週期時間** | NOW → DONE 平均 ≤ 7 天 | 平均 ≥ 30 天線性扣到 0 | `doneAt - startedAt` 平均 |
| **學習節奏** | 連續 14 天有日記 | 連續 0 天 | 日誌 entry 的 date 連續性 |

**等級**：85+ A / 70+ B / 50+ C / <50 D。

### Coach 提醒邏輯

1. 找出最弱的軸
2. 給該軸對應的具體建議（不是「加油」這種廢話）
3. 4 軸都 OK 時 → 鼓勵下一個進階目標（例如「Now 降到 2 件」）

範例：
- WIP 弱 → 「現在 NOW 有 5 件 (>3)。把優先級最低的 1-2 張拖到 NEXT」
- 速度弱 → 「30 天只完成 1 件。考慮把大卡片拆細，或刪除 NEXT 裡不會做的」
- 週期弱 → 「P16 在 NOW 已 12 天。是 scope 太大還是真的 stuck？」
- 學習弱 → 「日記連續 3 天，少於 7 天。今晚收工時寫 1 行 TIL」

### 自動 timestamp

卡片移到 NOW 時自動記 `startedAt`；移到 DONE 自動記 `doneAt`；如果從 DONE 退回去就清掉 `doneAt` 重算。**不需要你手動填**。

### 用途

- **每週日**：跑完 `/retro` 後看分數變化，找到本週退步的軸 → 寫進 weekly retro 的 "Energy drain"
- **每月底**：對比上月，看哪一軸是慢性問題 → 加進下月實驗
- **卡關時**：Coach 提醒會直接告訴你「下一個 5 分鐘做什麼」

### 不要做的事

- 不要追求滿分 — 100 分意味著太緊繃，留 15-20 分緩衝給意外
- 不要為了刷分數把卡片拆得很碎 — 那是 gaming the system
- 不要在月底壓力大時看分數 — 退一步看趨勢，不看單日

---

## GStack 使用節奏 (Solo founder)

> 一句話：**每天靠 preflight，每週靠 retro + health，每月靠 cso + learn，shipping 靠 review → ship → canary。**

### 🌞 每日 (≤ 10 分鐘)

| 時機 | 動作 | 為什麼 |
|------|------|--------|
| 開始工作 | 讀昨天日記最後一筆 `Tomorrow` | 30 秒進入狀況 |
| commit 前 | `npm run preflight` | typecheck + lint + test，CLAUDE.md 已寫是 pre-commit gate |
| 收尾 | 寫 5 行日記 | Claude 自動寫，你確認即可 |

**不要**每天跑 /review、/codex、/cso — 那是週/月節奏，每天跑會疲勞。

---

### 📅 每週日 (30-60 分鐘) · Weekly Retro

按順序跑：

```
1. /retro          ← 看本週 commits、產出、人員貢獻、趨勢
2. /health         ← 程式碼健康度 (typecheck/lint/test/deadcode 加權)
3. /triage         ← 升格 tasks/lessons-inbox.md 進 CLAUDE.md
4. /gstack-upgrade ← 跟上最新版（無痛）
```

跑完在 `docs/開發日記/2026-MM.md` 當月檔最下面寫 4 行 weekly retro：

```markdown
## Week of 2026-05-04 — Weekly Retro

- **Shipped**: (本週實際出貨，PR 號)
- **Learned**: (本週最大收穫一句話)
- **Energy drain**: (什麼最耗能量？)
- **Next week's bet**: (下週只押一件事)
```

---

### 🗓️ 每月一次 (1-2 小時) · 月底週末

| 順序 | 動作 | 用途 |
|------|------|------|
| 1 | `/cso comprehensive` | 深度安全稽核（OWASP + 供應鏈 + LLM 安全 + 趨勢） |
| 2 | `/document-release` | 同步 README / CLAUDE.md / CHANGELOG，避免文件腐爛 |
| 3 | `/learn` | 整理累積的 lessons，把過時的清掉 |
| 4 | 重看月報 + 回應 P17 | 月報是否真的回答「哪裡偏掉？下個月調什麼？」 |

---

### 🚀 Per-feature pipeline (做新功能時)

```
1. /plan-eng-review     ← 鎖架構、edge case、test coverage
2. (高風險才跑) /codex   ← 200 IQ second opinion
3. 實作 (邊寫邊 commit)
4. npm run preflight    ← gate
5. /review              ← 自動 PR 審查
6. /ship                ← 開 PR
7. /land-and-deploy     ← merge + deploy + 健康檢查
8. /canary              ← 部署後 30 分鐘監控
```

🎯 **Golden Pair**：`/plan-eng-review` → `/codex` 兩個 LLM 視角互相抓漏（CLAUDE.md 列為高 ROI）。

---

### 🐛 Per-bug pipeline (修 bug 時)

```
1. /investigate    ← 根因分析（不是症狀）
2. 寫 fix
3. /review         ← 確認沒引入新 bug
4. /ship → /land-and-deploy
```

🎯 **Iron Law**：沒找到根因之前不寫 fix。

---

### ⚠️ 進入危險區的安全網

- 動 prod / shared infra → `/careful` 或 `/guard`
- debug 時不想動到別的檔 → `/freeze <dir>`
- UI 大改後上線 → `/qa` 或 `/qa-only`
- 設計改版前 → `/plan-design-review`，改版後 → `/design-review`

---

### Claude 在這節奏裡的角色

我（Claude Code）會在你符合下面任一情境時**主動建議**跑對應 skill：

| 你做了什麼 | 我建議 |
|-----------|--------|
| 講「收工 / 晚安」 | 寫日記 + 提醒週日跑 retro / health |
| 講「要做新功能」 | 先 `/plan-eng-review` |
| 寫 ≥ 50 行新 code | commit 前 `/review` |
| 講「準備上線 / push」 | `/ship` → `/land-and-deploy` |
| 出現 bug、500、stack trace | `/investigate`（不直接修） |
| 月底最後一個工作日 | `/cso comprehensive` + `/document-release` |
| 改了大 UI / 多 .tsx 檔 | `/qa` + `/design-review` |

不需要你每次主動講；如果我忘了，這份 README + 我的 memory feedback 都會提醒。

---

## 參考來源

- [John Carmack .plan archive](https://github.com/ESWAT/john-carmack-plan-archive) — 每日工作記錄的經典範本
- [Mark Erikson — Coding Career Advice: Keeping a Daily Work Journal](https://blog.isquaredsoftware.com/2020/09/coding-career-advice-daily-work-journal/) — 10-15 分鐘 markdown 月份結構
- [Gergely Orosz — Work Log Template](https://blog.pragmaticengineer.com/work-log-template-for-software-engineers/) — weekly retro 觀念
- [Pieter Levels — build in public](https://nomadicblueprint.com/case-studies/pieter-levels) — 連續性與透明度
- [How to write a good devlog (IndieGameDev)](https://indiegamedev.net/2020/02/05/how-to-write-a-good-devlog/) — 「踩坑 + 怎麼解」最有價值
