import { TIMEZONE } from "./constants";

/**
 * Get current time as a Date whose local components reflect Taipei wall-clock.
 *
 * ⚠️ KNOWN BUG (2026-04-27): when the SERVER's local TZ is not Asia/Taipei
 * (e.g. Vercel = UTC), the returned Date's underlying instant is shifted
 * +8h from the real moment. Calling `.toLocaleDateString({ timeZone: "Asia/Taipei" })`
 * on the result then DOUBLE-converts and returns the wrong day during
 * Taipei afternoon/evening (real Taipei 16:00 → buggy result formats as next day).
 *
 * For "what's today's date in Taipei?", use {@link todayInTaipei} instead.
 * This function is preserved for callers that depend on `.getHours()` etc.
 * returning Taipei wall-clock values (which works by accident on UTC servers).
 *
 * Tracking: TODO migrate Category 2 callers to taipeiHour()/taipeiYmd() helpers,
 * then make this function return real `new Date()`.
 */
export function nowTaipei(): Date {
  return new Date(
    new Date().toLocaleString("en-US", { timeZone: TIMEZONE })
  );
}

/**
 * Returns YYYY-MM-DD for today in Asia/Taipei, robust on any server TZ.
 *
 * Use this in past-date guards, default date pickers, and anywhere you'd
 * have called `nowTaipei().toLocaleDateString("en-CA", { timeZone: "Asia/Taipei" })`.
 * The latter is buggy on UTC servers — see `nowTaipei` JSDoc.
 */
export function todayInTaipei(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: TIMEZONE });
}

/** Format a Date to "HH:mm" string */
export function formatTime(date: Date): string {
  const h = date.getHours().toString().padStart(2, "0");
  const m = date.getMinutes().toString().padStart(2, "0");
  return `${h}:${m}`;
}

/** Parse "HH:mm" string to hour number */
export function parseTimeToHour(time: string): number {
  return parseInt(time.split(":")[0], 10);
}

/** Compare two "HH:mm" strings */
export function compareTime(a: string, b: string): number {
  return parseTimeToHour(a) - parseTimeToHour(b);
}

/** Add N hours to a "HH:mm" string, returns "HH:mm" */
export function addHours(time: string, hours: number): string {
  const h = parseTimeToHour(time) + hours;
  return `${h.toString().padStart(2, "0")}:00`;
}

/** Check if two dates are the same calendar day (in Taipei timezone) */
export function isSameDay(a: Date, b: Date): boolean {
  const aStr = a.toLocaleDateString("en-CA", { timeZone: TIMEZONE });
  const bStr = b.toLocaleDateString("en-CA", { timeZone: TIMEZONE });
  return aStr === bStr;
}

/** Check if a time string is within business hours range */
export function isWithinBusinessHours(
  currentTime: string,
  startTime: string,
  endTime: string
): boolean {
  const current = parseTimeToHour(currentTime);
  const start = parseTimeToHour(startTime);
  const end = parseTimeToHour(endTime);
  return current >= start && current < end;
}

/** Format date to YYYY-MM-DD */
export function formatDateToISO(date: Date): string {
  return date.toLocaleDateString("en-CA", { timeZone: TIMEZONE });
}

/** Get day of week (0=Sun) in Taipei timezone */
export function getDayOfWeek(date: Date): number {
  const taipeiDate = new Date(
    date.toLocaleString("en-US", { timeZone: TIMEZONE })
  );
  return taipeiDate.getDay();
}
