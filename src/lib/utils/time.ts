import { TIMEZONE } from "./constants";

/** Get current time in Asia/Taipei */
export function nowTaipei(): Date {
  return new Date(
    new Date().toLocaleString("en-US", { timeZone: TIMEZONE })
  );
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
