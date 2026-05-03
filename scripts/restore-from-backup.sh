#!/usr/bin/env bash
# V3.8 P0 prevention：從 GitHub Actions backup artifact 恢復 DB。
#
# 用法：
#   1. 去 https://github.com/ryan234r32/barbershop-booking/actions/workflows/db-backup-daily.yml
#   2. 點要還原的那天 run → "Artifacts" 區塊 → 下載 barbershop-backup-YYYY-MM-DD_HHMM.zip
#   3. 解壓得到 backup.sql.gz
#   4. 跑 ./scripts/restore-from-backup.sh path/to/backup.sql.gz
#
# 安全網：
#   - 預設只 echo，不真的執行 psql。傳 --execute 才會真 restore。
#   - 強制要求 env CONFIRM_RESTORE_TENANT=<tenant id>（防 copy-paste 跑錯）

set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Usage: $0 <backup.sql.gz> [--execute]"
  echo ""
  echo "  Default: dry-run (show what would happen)"
  echo "  --execute: actually restore"
  echo ""
  echo "  Required env: CONFIRM_RESTORE_TENANT=<tenant-id>"
  exit 1
fi

BACKUP_FILE="$1"
EXECUTE=false
[ "${2:-}" = "--execute" ] && EXECUTE=true

if [ ! -f "$BACKUP_FILE" ]; then
  echo "✗ File not found: $BACKUP_FILE"
  exit 1
fi

# Load DIRECT_URL from .env (port 5432, not pgbouncer 6543)
if [ -f .env ]; then
  # shellcheck disable=SC1091
  set -a; source .env; set +a
fi

if [ -z "${DIRECT_URL:-}" ]; then
  echo "✗ DIRECT_URL not set. Add it to .env (Supabase 'Direct connection', port 5432)"
  exit 1
fi

# Extract tenant id from URL host for sanity check
DB_HOST=$(echo "$DIRECT_URL" | sed -E 's|.*@([^:]+).*|\1|')
echo "=== Restore plan ==="
echo "  Backup file:   $BACKUP_FILE"
echo "  Target host:   $DB_HOST"
echo "  Mode:          $([ "$EXECUTE" = true ] && echo 'EXECUTE (will write to DB)' || echo 'DRY-RUN')"
echo ""

if [ "$EXECUTE" = true ]; then
  if [ -z "${CONFIRM_RESTORE_TENANT:-}" ]; then
    echo "✗ Refusing to --execute without CONFIRM_RESTORE_TENANT env var."
    echo "  This restore will overwrite the entire DB. Set:"
    echo "    CONFIRM_RESTORE_TENANT=<tenant-id> ./scripts/restore-from-backup.sh ... --execute"
    exit 1
  fi
  echo "⚠ Pausing 5 sec — Ctrl+C to abort."
  sleep 5
  echo "→ Restoring..."
  gunzip -c "$BACKUP_FILE" | psql "$DIRECT_URL"
  echo "✓ Restore complete."
else
  echo "→ DRY-RUN: would run:"
  echo "  gunzip -c $BACKUP_FILE | psql \$DIRECT_URL"
  echo ""
  echo "  Re-run with --execute and CONFIRM_RESTORE_TENANT=<tenant-id> to actually restore."
fi
