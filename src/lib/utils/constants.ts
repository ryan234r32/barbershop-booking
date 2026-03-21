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
