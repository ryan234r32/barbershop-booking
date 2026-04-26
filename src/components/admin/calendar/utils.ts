/**
 * Shared constants + helpers for admin calendar views (Wave 3.A / A1 refactor).
 */

import type { Booking } from "./types";

export const HOURS = Array.from({ length: 9 }, (_, i) => `${(11 + i).toString().padStart(2, "0")}:00`);
export const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];
export const SLOT_HEIGHT = 96;

export const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function formatDate(d: Date) {
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Taipei" });
}

export function toTaipeiDate(d: Date) {
  return new Date(d.toLocaleString("en-US", { timeZone: "Asia/Taipei" }));
}

export function isPaid(b: Booking): boolean {
  return b.payment?.status === "RECEIVED";
}

/** Returns the card background class based on completion/payment status. */
export function cardBgClass(b: Booking): string {
  if (b.status === "COMPLETED" || isPaid(b)) {
    return "bg-[var(--color-success)]/15";
  }
  if (b.slotsOccupied > 1) {
    return "bg-[var(--color-brand)]/10";
  }
  return "bg-[var(--color-surface)]";
}

function isLiveBooking(b: Booking): boolean {
  return b.status !== "CANCELLED" && b.status !== "CANCELLED_BY_ADMIN";
}

export function getBookingsForDate(bookings: Booking[], dateStr: string): Booking[] {
  return bookings.filter((b) => b.date.startsWith(dateStr) && isLiveBooking(b));
}

export function getBookingAtSlot(
  bookings: Booking[],
  dateStr: string,
  hour: string,
): Booking | undefined {
  return bookings.find(
    (b) => b.date.startsWith(dateStr) && b.startTime === hour && isLiveBooking(b),
  );
}

export function isSlotOccupied(bookings: Booking[], dateStr: string, hour: string): boolean {
  return bookings.some(
    (b) =>
      b.date.startsWith(dateStr) &&
      b.startTime <= hour &&
      b.endTime > hour &&
      isLiveBooking(b),
  );
}

/**
 * Service-name abbreviations for compact week / day chips
 * (PRD-v3 §4 — 碩展訪談 2.2: "see 2-3 chars even when block is small").
 * Order matters — longer matches first so 補染 → 染、漂頭髮 → 漂.
 */
const SERVICE_ABBR: Array<[RegExp, string]> = [
  [/補染|染髮|染/, "染"],
  [/燙髮|燙/, "燙"],
  [/漂髮|漂/, "漂"],
  [/護髮|護/, "護"],
  [/瀏海|瀏/, "瀏"],
  [/西髮|西/, "西"],
  [/剪髮|剪/, "剪"],
];

/** Returns a 1-character abbreviation for a service name (best-effort). */
export function abbreviateService(name: string): string {
  for (const [re, abbr] of SERVICE_ABBR) {
    if (re.test(name)) return abbr;
  }
  return name.slice(0, 1) || "?";
}

/**
 * Truncate the customer name for compact display:
 *   ≤3 chars → keep
 *   >3 chars → first 3 + "…"
 */
export function truncateCustomerName(name: string | null | undefined, maxLen = 3): string {
  const s = (name ?? "顧客").trim();
  if (s.length <= maxLen) return s;
  return s.slice(0, maxLen) + "…";
}

/**
 * Service-categorised chip color (PRD-v3 §4 / GC-style).
 * Used by both day-view text-rule blocks and month-view chips so colors stay
 * consistent across views. `paid` overrides everything (success green).
 */
export function chipClassForService(serviceName: string, paid: boolean): string {
  if (paid) return "bg-[var(--color-success)]/25 text-[var(--color-success)]";
  if (serviceName.includes("漂")) {
    return "bg-[var(--color-warning)]/25 text-[var(--color-warning)]";
  }
  if (serviceName.includes("染")) {
    return "bg-[var(--color-service-color)]/15 text-[var(--color-service-color)]";
  }
  if (serviceName.includes("燙")) {
    return "bg-[var(--color-service-perm)]/15 text-[var(--color-service-perm)]";
  }
  if (serviceName.includes("剪")) {
    return "bg-[var(--color-brand)]/15 text-[var(--color-brand)]";
  }
  return "bg-[var(--color-text-muted)]/15 text-[var(--color-text-body)]";
}
