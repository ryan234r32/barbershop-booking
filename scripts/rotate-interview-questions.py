"""
偵測 docs/ 裡最新的「第 N 次老闆訪談」檔案，自動：
  1. 把 docs/interview-questions/pending-after-interview-{N-1}.md 改名為 resolved-after-interview-{N-1}.md
  2. 建立新的 pending-after-interview-{N}.md（含空白模板）

使用時機：
  - 手動：python3 scripts/rotate-interview-questions.py
  - 自動：Claude 看到新的訪談檔放入 docs/ 時自行執行（規則寫在專案 CLAUDE.md）
"""
from __future__ import annotations

import re
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / "docs"
QUEUE = DOCS / "interview-questions"

# 匹配「第N次老闆訪談...」，N 可能是國字或阿拉伯數字
CN_NUM = {"一": 1, "二": 2, "三": 3, "四": 4, "五": 5, "六": 6, "七": 7, "八": 8, "九": 9, "十": 10}
PATTERN = re.compile(r"第([一二三四五六七八九十0-9]+)次老闆訪談")


def parse_n(s: str) -> int | None:
    m = PATTERN.search(s)
    if not m:
        return None
    raw = m.group(1)
    if raw.isdigit():
        return int(raw)
    if raw in CN_NUM:
        return CN_NUM[raw]
    # 多字國字（例如十一）暫不處理，專案頭幾次訪談到不了
    return None


def find_latest_interview_n() -> int:
    latest = 0
    for f in DOCS.glob("第*次老闆訪談*.md"):
        n = parse_n(f.name)
        if n and n > latest:
            latest = n
    return latest


TEMPLATE = """# 待問老闆的問題（第 {n} 次訪談後 → 第 {next_n} 次訪談前）

> 收集期：第 {n} 次訪談後 → 第 {next_n} 次訪談日
>
> Claude 在對話中想到要問老闆的問題，會自動追加到這裡。訪談結束後此檔會改名為 `resolved-after-interview-{n}.md`。

---

## A. 服務項目

（空）

## B. CRM / 會員分段

（空）

## C. 付款 / 對帳

（空）

## D. 諮詢流程

（空）

## E. 行事曆 UI

（空）

## F. 營收報表 / 儀表板

（空）

## G. 其他

（空）
"""


def rotate():
    latest = find_latest_interview_n()
    if latest == 0:
        print("❌ 找不到任何「第 N 次老闆訪談」檔案，放棄。")
        return

    # 當前 pending 應該是 after-interview-{latest}；如果還沒有就建一個
    pending = QUEUE / f"pending-after-interview-{latest}.md"
    prev_pending = QUEUE / f"pending-after-interview-{latest - 1}.md"

    if prev_pending.exists() and not pending.exists():
        # 需要切換
        resolved = QUEUE / f"resolved-after-interview-{latest - 1}.md"
        shutil.move(str(prev_pending), str(resolved))
        print(f"✅ {prev_pending.name} → {resolved.name}")

        pending.write_text(TEMPLATE.format(n=latest, next_n=latest + 1), encoding="utf-8")
        print(f"✅ 建立新的 {pending.name}")
    elif pending.exists():
        print(f"✓ 目前的 pending 已是 {pending.name}，無需切換。")
    else:
        # 第一次使用
        pending.write_text(TEMPLATE.format(n=latest, next_n=latest + 1), encoding="utf-8")
        print(f"✅ 建立初始 {pending.name}")


if __name__ == "__main__":
    rotate()
