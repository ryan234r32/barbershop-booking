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
