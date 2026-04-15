---
description: 低摩擦記錄一條教訓到 inbox（週末 /triage 再決定升格）
---

將使用者緊接在這個 command 之後提供的內容，append 到 `tasks/lessons-inbox.md`。

**格式**：
```
## YYYY-MM-DD HH:mm
- {內容原文，不要改寫}
  - context: {可選，一句話說明觸發情境，例如「ECPay webhook 測試時發現」}
```

**規則**：
- 不要 summary、不要評論、不要擅自分類
- 時間用 Asia/Taipei（使用 `date "+%Y-%m-%d %H:%M"` 或 `TZ=Asia/Taipei date`）
- 檔案不存在就建立

**然後**：
- 如果使用者這條內容看起來**明顯是通則**（「永遠要 X」「X 時必須 Y」），提醒一句：「這條看起來是通則，要直接寫進 CLAUDE.md Key Conventions 嗎？」然後等使用者回答
- 否則靜默追加即可
