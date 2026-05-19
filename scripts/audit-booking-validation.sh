#!/usr/bin/env bash
#
# scripts/audit-booking-validation.sh
#
# Audit booking-mutating API endpoints for missing validation patterns.
#
# Why this exists:
#   2026-05-19 — 老闆 reported reschedule bug (missing overtime + holiday checks).
#   POST /api/bookings (the gold-standard) has all three, but other endpoints
#   were silently missing them. Rather than spot-fix, this script catches the
#   whole pattern: any endpoint that creates/modifies a booking's time/date
#   must validate (a) business-hours window, (b) holiday, (c) past-date.
#
# Bonus checks:
#   - OCC (`expectedUpdatedAt`) on mutating endpoints
#   - tenant isolation (`tenantId`) on every endpoint
#
# Exit code: 0 if all good, 1 if any gap detected.

set -u

# Resolve repo root from script location (works regardless of cwd).
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

# ---------- colors ----------
if [[ -t 1 ]]; then
  RED=$'\033[31m'
  GRN=$'\033[32m'
  YEL=$'\033[33m'
  BLU=$'\033[34m'
  DIM=$'\033[2m'
  BLD=$'\033[1m'
  RST=$'\033[0m'
else
  RED=""; GRN=""; YEL=""; BLU=""; DIM=""; BLD=""; RST=""
fi

CHECK="${GRN}OK${RST}"
CROSS="${RED}MISS${RST}"
SKIP="${DIM}n/a${RST}"

# ---------- which endpoints mutate booking time/date? ----------
# Format: "label|path|category"
# category:
#   time   = creates or moves a booking → needs all 3 time/date checks
#   mutate = modifies booking state but not time → only OCC + tenant
#   read   = read-only → tenant only
# Endpoints that change a booking's date OR startTime → need all 3 time checks.
# (add-service does NOT change date/startTime — only adds a service; goes in MUTATE.)
TIME_ENDPOINTS=(
  "POST /api/bookings (reference)|src/app/api/bookings/route.ts|time"
  "PATCH /api/bookings/[id]/reschedule|src/app/api/bookings/[id]/reschedule/route.ts|time"
  "POST /api/bookings/[id]/reschedule-undo|src/app/api/bookings/[id]/reschedule-undo/route.ts|time"
)

MUTATE_ENDPOINTS=(
  "PATCH /api/bookings/[id] (cancel/edit)|src/app/api/bookings/[id]/route.ts|mutate"
  "POST /api/bookings/[id]/add-service|src/app/api/bookings/[id]/add-service/route.ts|mutate"
  "POST /api/bookings/[id]/checkin|src/app/api/bookings/[id]/checkin/route.ts|mutate"
  "POST /api/bookings/[id]/checkout|src/app/api/bookings/[id]/checkout/route.ts|mutate"
  "POST /api/bookings/[id]/no-show|src/app/api/bookings/[id]/no-show/route.ts|mutate"
  "POST /api/bookings/[id]/acknowledge|src/app/api/bookings/[id]/acknowledge/route.ts|mutate"
  "PATCH /api/bookings/[id]/settle|src/app/api/bookings/[id]/settle/route.ts|mutate"
)

# ---------- patterns ----------
# (a) overtime / business-hours check
HOURS_PATTERN='parseTimeToHour|startHour|closeHour|OUTSIDE_BUSINESS_HOURS'
# (b) holiday check
HOLIDAY_PATTERN='prisma\.holiday|\.holiday\.|HOLIDAY|CLOSED_WEEKDAY'
# (c) past-date check
PASTDATE_PATTERN='todayInTaipei|PAST_DATE|< today'
# OCC guard
OCC_PATTERN='expectedUpdatedAt|stale_write'
# tenant isolation
TENANT_PATTERN='tenantId'

# Track totals
TOTAL_GAPS=0

# ---------- pretty printer ----------
# Pad a string with trailing spaces to a target visible width, ignoring ANSI.
pad() {
  local raw="$1"; local width="$2"
  local stripped
  stripped="$(printf "%s" "$raw" | sed -E 's/\x1B\[[0-9;]*[mK]//g')"
  local len=${#stripped}
  local diff=$(( width - len ))
  (( diff < 0 )) && diff=0
  printf "%s%*s" "$raw" "$diff" ""
}

check_pattern() {
  # $1 = file, $2 = pattern, $3 = required (1=yes)
  # NOTE: this function is called via $(...) which runs in a subshell, so we
  # cannot mutate TOTAL_GAPS here. Caller checks the exit code instead:
  #   0 = OK, 1 = MISS (required & absent), 2 = file not found.
  local file="$1"; local pat="$2"; local required="$3"
  if [[ ! -f "$file" ]]; then
    printf "%s" "${YEL}404${RST}"
    return 2
  fi
  if grep -Eq "$pat" "$file"; then
    printf "%s" "$CHECK"
    return 0
  else
    if [[ "$required" == "1" ]]; then
      printf "%s" "$CROSS"
      return 1
    else
      printf "%s" "$SKIP"
      return 0
    fi
  fi
}

# ---------- section header ----------
section() {
  echo ""
  echo "${BLD}${BLU}═══ $1 ═══${RST}"
  echo ""
}

# ---------- main report ----------
echo ""
echo "${BLD}booking validation audit${RST}  ${DIM}($(date '+%Y-%m-%d %H:%M:%S'))${RST}"
echo "${DIM}repo: $REPO_ROOT${RST}"

# ===== Section 1: time/date validation =====
section "Time/Date Validation (endpoints that create or move a booking)"

# Header
printf "%s  %s  %s  %s\n" \
  "$(pad "${BLD}endpoint${RST}" 48)" \
  "$(pad "${BLD}hours${RST}" 8)" \
  "$(pad "${BLD}holiday${RST}" 10)" \
  "$(pad "${BLD}past-date${RST}" 10)"
printf "%s  %s  %s  %s\n" \
  "$(pad "$(printf '%.0s-' {1..40})" 48)" \
  "$(pad "------" 8)" \
  "$(pad "-------" 10)" \
  "$(pad "---------" 10)"

for row in "${TIME_ENDPOINTS[@]}"; do
  IFS='|' read -r label path _cat <<< "$row"
  cell_hours="$(check_pattern "$path" "$HOURS_PATTERN" 1)";   [[ $? -eq 1 ]] && TOTAL_GAPS=$((TOTAL_GAPS+1))
  cell_holiday="$(check_pattern "$path" "$HOLIDAY_PATTERN" 1)"; [[ $? -eq 1 ]] && TOTAL_GAPS=$((TOTAL_GAPS+1))
  cell_past="$(check_pattern "$path" "$PASTDATE_PATTERN" 1)";   [[ $? -eq 1 ]] && TOTAL_GAPS=$((TOTAL_GAPS+1))
  printf "%s  %s  %s  %s\n" \
    "$(pad "$label" 48)" \
    "$(pad "$cell_hours" 8)" \
    "$(pad "$cell_holiday" 10)" \
    "$(pad "$cell_past" 10)"
done

# ===== Section 2: OCC + tenant isolation =====
section "OCC Guard + Tenant Isolation (all mutating endpoints)"

printf "%s  %s  %s\n" \
  "$(pad "${BLD}endpoint${RST}" 48)" \
  "$(pad "${BLD}OCC${RST}" 8)" \
  "$(pad "${BLD}tenantId${RST}" 10)"
printf "%s  %s  %s\n" \
  "$(pad "$(printf '%.0s-' {1..40})" 48)" \
  "$(pad "------" 8)" \
  "$(pad "-------" 10)"

ALL=("${TIME_ENDPOINTS[@]}" "${MUTATE_ENDPOINTS[@]}")
for row in "${ALL[@]}"; do
  IFS='|' read -r label path cat <<< "$row"
  # OCC required for all mutating endpoints EXCEPT the create (POST /api/bookings —
  # there's no prior row to guard against).
  if [[ "$label" == *"POST /api/bookings (reference)"* ]]; then
    cell_occ="${DIM}n/a${RST}"
  else
    cell_occ="$(check_pattern "$path" "$OCC_PATTERN" 1)"
    [[ $? -eq 1 ]] && TOTAL_GAPS=$((TOTAL_GAPS+1))
  fi
  cell_tenant="$(check_pattern "$path" "$TENANT_PATTERN" 1)"
  [[ $? -eq 1 ]] && TOTAL_GAPS=$((TOTAL_GAPS+1))
  printf "%s  %s  %s\n" \
    "$(pad "$label" 48)" \
    "$(pad "$cell_occ" 8)" \
    "$(pad "$cell_tenant" 10)"
done

# ===== Footer =====
echo ""
if (( TOTAL_GAPS == 0 )); then
  echo "${GRN}${BLD}PASS${RST}  ${DIM}all booking-mutating endpoints have required validation${RST}"
  echo ""
  exit 0
else
  echo "${RED}${BLD}FAIL${RST}  ${RED}${TOTAL_GAPS} gap(s) detected${RST}  ${DIM}— see ${CROSS} cells above${RST}"
  echo ""
  echo "${DIM}reference impl: src/app/api/bookings/route.ts (POST)${RST}"
  echo "${DIM}patterns checked:${RST}"
  echo "${DIM}  hours    : ${HOURS_PATTERN}${RST}"
  echo "${DIM}  holiday  : ${HOLIDAY_PATTERN}${RST}"
  echo "${DIM}  past-date: ${PASTDATE_PATTERN}${RST}"
  echo "${DIM}  OCC      : ${OCC_PATTERN}${RST}"
  echo "${DIM}  tenant   : ${TENANT_PATTERN}${RST}"
  echo ""
  exit 1
fi
