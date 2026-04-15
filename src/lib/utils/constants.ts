export const TIMEZONE = "Asia/Taipei";

export const SLOT_DURATION_MINUTES = 60;

export const DEFAULT_BUSINESS_HOURS = {
  startTime: "11:00",
  endTime: "20:00",
};

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

export const AT_RISK_DAYS = 60;
export const LAPSED_DAYS = 120;

export const BOOKING_LOCK_TTL_MS = 10_000;

export const CRON_REMINDER_INTERVAL_MINUTES = 15;

// ECPay Tier S
export const ECPAY_CREATE_LOCK_TTL_MS = 15_000;
export const ECPAY_API_TIMEOUT_MS = 8_000;
// NT$280k guardrail (個人戶月度上限 NT$300k 的 93%)
export const ECPAY_MONTHLY_CAP_TWD = 280_000;
export const ECPAY_STALE_CREATED_THRESHOLD_MS = 5 * 60_000;
