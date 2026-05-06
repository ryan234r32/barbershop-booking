#!/usr/bin/env bash
# session-stats.sh — 算出指定時段的 git 產出，給 sessions.md 用
# Usage: ./scripts/session-stats.sh "2026-05-05 06:00" "2026-05-05 07:53"

set -euo pipefail

SINCE="${1:-}"
UNTIL="${2:-}"

if [ -z "$SINCE" ] || [ -z "$UNTIL" ]; then
  echo "Usage: $0 \"YYYY-MM-DD HH:MM\" \"YYYY-MM-DD HH:MM\""
  exit 1
fi

since_ts=$(date -j -f "%Y-%m-%d %H:%M" "$SINCE" +%s 2>/dev/null || echo "0")
until_ts=$(date -j -f "%Y-%m-%d %H:%M" "$UNTIL" +%s 2>/dev/null || echo "0")
if [ "$since_ts" -gt 0 ] && [ "$until_ts" -gt 0 ]; then
  duration=$(( (until_ts - since_ts) / 60 ))
else
  duration="?"
fi

cd "$(dirname "$0")/.."

echo "## Session window: $SINCE → $UNTIL ($duration 分)"
echo
echo "**Commits**:"
git log --all --since="$SINCE" --until="$UNTIL" --pretty=format:"- \`%h\` %s" 2>/dev/null
echo
echo
echo "**Files changed**:"
git log --since="$SINCE" --until="$UNTIL" --name-only --pretty=format:"" 2>/dev/null | sort -u | grep -v "^$" | sed 's/^/- /'
echo
stats=$(git log --since="$SINCE" --until="$UNTIL" --shortstat --pretty=format:"" 2>/dev/null | grep -E "files? changed" | awk '
  { for (i=1; i<=NF; i++) {
      if ($i ~ /file/) files += $(i-1);
      if ($i ~ /insertion/) ins += $(i-1);
      if ($i ~ /deletion/) del += $(i-1);
    }
  }
  END { printf "%d files, +%d -%d", files, ins, del }')
echo "**Diff total**: $stats"
echo
echo "**PRs (this window)**:"
git log --since="$SINCE" --until="$UNTIL" --pretty=format:"%s" 2>/dev/null | grep -oE "#[0-9]+" | sort -u | sed 's/^/- /'
echo
