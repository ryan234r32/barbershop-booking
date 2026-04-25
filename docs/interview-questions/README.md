# 訪談問題庫

本資料夾追蹤「每兩次老闆訪談之間，累積想問但還沒問的問題」。

## 檔名規則

- `pending-after-interview-{N}.md` — 第 N 次訪談**之後**累積的問題，等第 N+1 次訪談時拿來問
- `resolved-after-interview-{N}.md` — 第 N+1 次訪談結束後，把 pending 檔改名為 resolved（表示已問完），同時自動建立新的 `pending-after-interview-{N+1}.md`

## 當前狀態

- **最新訪談**：第 2 次（2026-04-15）
- **目前收集中**：`pending-after-interview-2.md`（問題會持續累積到第 3 次訪談日）
- **下次訪談前要問的**：就是 `pending-after-interview-2.md` 裡的全部內容

## Claude 自動化行為（定義於專案 CLAUDE.md）

- 當 Claude 在對話中提到「要問老闆」、「待老闆確認」等語意的問題時，自動追加到最新的 `pending-after-interview-{N}.md`
- 當使用者放入新的 `第 N+1 次老闆訪談-YYYY-MM-DD.md` 或 `第 N+1 次老闆訪談逐字稿-YYYY-MM-DD.md` 到 `docs/` 時，Claude 自動：
  1. 把 `pending-after-interview-{N}.md` 改名為 `resolved-after-interview-{N}.md`
  2. 建立新的空白 `pending-after-interview-{N+1}.md`（含模板）
  3. 根據新訪談檔比對舊問題，標註哪些已解、哪些還沒答到

## 手動切換（助手沒抓到時）

```bash
python3 scripts/rotate-interview-questions.py
```

會自動根據 `docs/` 的訪談檔找出最新的 N，並完成上述切換。
