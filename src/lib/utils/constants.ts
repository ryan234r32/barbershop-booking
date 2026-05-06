export const TIMEZONE = "Asia/Taipei";

export const SLOT_DURATION_MINUTES = 60;

export const DEFAULT_BUSINESS_HOURS = {
  startTime: "11:00",
  endTime: "20:00",
};

/**
 * 客戶端 LIFF 日曆最遠可預約天數。
 * Single source of truth — LIFF calendar、`/api/bookings` 後端驗證、`/api/business-config`
 * 都從這裡取值，避免 30 / 45 / 60 在不同檔案 drift。
 */
export const MAX_ADVANCE_DAYS = 45;

/**
 * Admin 手動建單 / 改期 / 報表瀏覽最遠天數。
 * 老闆有時會幫熟客排半年後預約 (常客 / 染髮回診)，所以放寬到 1 年。
 * 同時也是 admin 行事曆 + 對帳報表 DateStrip 的最大值（讓老闆能滑到任何
 * 已建立的預約日期）。
 *
 * LIFF 客戶仍只能訂 MAX_ADVANCE_DAYS = 45 天內。
 */
export const ADMIN_MAX_ADVANCE_DAYS = 365;

// Generates all possible slot start times: ["11:00", "12:00", ..., "19:00"]
export function generateAllSlots(startTime: string, endTime: string): string[] {
  const slots: string[] = [];
  const [startH] = startTime.split(":").map(Number);
  const [endH] = endTime.split(":").map(Number);
  for (let h = startH; h < endH; h++) {
    slots.push(`${h.toString().padStart(2, "0")}:00`);
  }
  return slots;
}

export const MAX_VIOLATIONS = 3;
export const VIOLATION_RESTRICTION_MONTHS = 1;

// CRM segment thresholds (Plan A — 2026-04-29，依 1008 真實 3.36 次/年訪頻校準)
//
// 規則 (priority: BLACKLISTED > LAPSED > AT_RISK > VIP > REGULAR > NEW):
//   LAPSED:   最後一次 > 240 天前
//   AT_RISK:  最後一次 > 120 天前 (≤ 240)
//   VIP:      180 天內 ≥ 6 次 + 最近 ≤ 60 天前 (月剪一次的死忠)
//   REGULAR:  365 天內 ≥ 3 次 + 最近 ≤ 120 天前 (建立關係)
//   else:     NEW
export const AT_RISK_DAYS = 120;
export const LAPSED_DAYS = 240;
export const VIP_RECENT_DAYS = 60;
export const VIP_VISITS_180D = 6;
export const REGULAR_VISITS_365D = 3;

export const BOOKING_LOCK_TTL_MS = 10_000;

export const CRON_REMINDER_INTERVAL_MINUTES = 15;

// ECPay Tier S
export const ECPAY_CREATE_LOCK_TTL_MS = 15_000;
export const ECPAY_API_TIMEOUT_MS = 8_000;
// NT$280k guardrail (個人戶月度上限 NT$300k 的 93%)
export const ECPAY_MONTHLY_CAP_TWD = 280_000;
export const ECPAY_STALE_CREATED_THRESHOLD_MS = 5 * 60_000;
