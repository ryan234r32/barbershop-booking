import { prisma } from "@/lib/prisma";
import { generateAllSlots } from "@/lib/utils/constants";
import { getDayOfWeek, parseTimeToHour, todayInTaipei, currentHourTaipei } from "@/lib/utils/time";
import { rankAndRecommendSlots } from "./smart-suggest";

export interface AvailableSlot {
  startTime: string;
  endTime: string;
  isRecommended: boolean;
}

/**
 * Core slot availability engine.
 * Given a date and service, computes which time slots are available.
 * For multi-slot services (perm=3, color=4), finds consecutive available slots.
 */
export async function getAvailableSlots(params: {
  tenantId: string;
  date: string; // "YYYY-MM-DD"
  /** V3.7 P3 (5/19) — preferred: client already knows total slots (variant
   *  resolved on client side). Skips DB roundtrip for service lookup. */
  slotsNeeded?: number;
  /** Single-service path (legacy). One of serviceId / serviceIds must be set
   *  when slotsNeeded is not provided. */
  serviceId?: string;
  /** V3.7 Tier 0.2 multi-service path: slotsNeeded = sum across all services. */
  serviceIds?: string[];
}): Promise<AvailableSlot[]> {
  const { tenantId, date } = params;
  const dateObj = new Date(date + "T00:00:00.000Z");

  // 1. Resolve total slotsNeeded. Prefer explicit `slotsNeeded` from caller
  //    (variant-aware); fall back to service lookup for legacy callers.
  let slotsNeeded: number;
  if (params.slotsNeeded && params.slotsNeeded > 0) {
    slotsNeeded = params.slotsNeeded;
  } else {
    const ids = params.serviceIds && params.serviceIds.length ? params.serviceIds : params.serviceId ? [params.serviceId] : [];
    if (!ids.length) return [];
    const services = await prisma.service.findMany({
      where: { id: { in: ids } },
      select: { id: true, slotsNeeded: true },
    });
    if (services.length !== ids.length) return [];
    slotsNeeded = services.reduce((sum, s) => sum + s.slotsNeeded, 0);
  }

  // 2. Check if this date is a holiday (full-day or partial closure window)
  const holiday = await prisma.holiday.findUnique({
    where: {
      tenantId_date: { tenantId, date: dateObj },
    },
    select: { startTime: true, endTime: true },
  });
  // V3.7 P1-3: only short-circuit when this is a FULL-day closure
  // (both NULL). Partial closure feeds into occupiedSlots below.
  if (holiday && !holiday.startTime && !holiday.endTime) return [];

  // 3. Get business hours for this day of week
  const dayOfWeek = getDayOfWeek(dateObj);
  const hours = await prisma.businessHours.findUnique({
    where: {
      tenantId_dayOfWeek: { tenantId, dayOfWeek },
    },
  });
  if (!hours || !hours.isOpen) return [];

  // 4. Generate all possible slots for the day
  const allSlots = generateAllSlots(hours.startTime, hours.endTime);

  // 5. Get existing bookings for this date
  const bookings = await prisma.booking.findMany({
    where: {
      tenantId,
      date: dateObj,
      status: { in: ["CONFIRMED", "COMPLETED"] },
    },
    select: { startTime: true, endTime: true, slotsOccupied: true },
  });

  // 6. Mark occupied slots — bookings + partial-day holiday window.
  const occupiedSlots = new Set<string>();
  for (const booking of bookings) {
    const startH = parseTimeToHour(booking.startTime);
    for (let i = 0; i < booking.slotsOccupied; i++) {
      const h = startH + i;
      occupiedSlots.add(`${h.toString().padStart(2, "0")}:00`);
    }
  }
  // V3.7 P1-3: 部分時段公休（週四 11-13 健身）以 occupiedSlots 形式扣除。
  if (holiday && holiday.startTime && holiday.endTime) {
    const holStart = parseTimeToHour(holiday.startTime);
    const holEnd = parseTimeToHour(holiday.endTime);
    for (let h = holStart; h < holEnd; h++) {
      occupiedSlots.add(`${h.toString().padStart(2, "0")}:00`);
    }
  }

  // 7. Find available start times for the requested service(s)
  const available: AvailableSlot[] = [];

  // 2026-04-30: 過濾已過時段（只在 date === 今天時生效）。
  // 規則：startHour > currentHour（嚴格大於），即 13:00 整點時 13 點 slot 已不可選。
  // 老闆 walk-in 仍可走 admin 結帳介面手動建單。
  const isToday = date === todayInTaipei();
  const currentHour = isToday ? currentHourTaipei() : -1;

  for (let i = 0; i <= allSlots.length - slotsNeeded; i++) {
    const startTime = allSlots[i];
    const startHour = parseTimeToHour(startTime);

    // Skip if this slot's start hour already past (today only)
    if (isToday && startHour <= currentHour) continue;

    // Check if all consecutive slots are free
    let allFree = true;
    for (let j = 0; j < slotsNeeded; j++) {
      if (occupiedSlots.has(allSlots[i + j])) {
        allFree = false;
        break;
      }
    }

    if (allFree) {
      const endH = startHour + slotsNeeded;
      const endTime = `${endH.toString().padStart(2, "0")}:00`;

      available.push({
        startTime,
        endTime,
        isRecommended: false,
      });
    }
  }

  // 8. Apply smart slot recommendations
  return rankAndRecommendSlots(available, occupiedSlots);
}

/**
 * Check if a specific slot is still available (used inside booking transaction).
 */
export async function isSlotAvailable(params: {
  tenantId: string;
  date: Date;
  startTime: string;
  slotsNeeded: number;
  excludeBookingId?: string;
}): Promise<boolean> {
  const { tenantId, date, startTime, slotsNeeded, excludeBookingId } = params;
  const startH = parseTimeToHour(startTime);

  const [bookings, holiday] = await Promise.all([
    prisma.booking.findMany({
      where: {
        tenantId,
        date,
        status: "CONFIRMED",
        ...(excludeBookingId ? { id: { not: excludeBookingId } } : {}),
      },
      select: { startTime: true, slotsOccupied: true },
    }),
    // V3.7 P1-3 — also block partial-day closure window inside the lock.
    prisma.holiday.findUnique({
      where: { tenantId_date: { tenantId, date } },
      select: { startTime: true, endTime: true },
    }),
  ]);

  // Full-day closures are caught higher up; here we only worry about partial
  // closures (start AND end set) — those translate to blocked hours.
  const holStart = holiday?.startTime ? parseTimeToHour(holiday.startTime) : null;
  const holEnd = holiday?.endTime ? parseTimeToHour(holiday.endTime) : null;

  for (let i = 0; i < slotsNeeded; i++) {
    const targetH = startH + i;
    if (holStart != null && holEnd != null && targetH >= holStart && targetH < holEnd) {
      return false;
    }
    for (const booking of bookings) {
      const bStartH = parseTimeToHour(booking.startTime);
      for (let j = 0; j < booking.slotsOccupied; j++) {
        if (bStartH + j === targetH) {
          return false;
        }
      }
    }
  }

  return true;
}
