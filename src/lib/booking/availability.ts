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
  serviceId: string;
}): Promise<AvailableSlot[]> {
  const { tenantId, date, serviceId } = params;
  const dateObj = new Date(date + "T00:00:00.000Z");

  // 1. Get service to know how many consecutive slots needed
  const service = await prisma.service.findUnique({
    where: { id: serviceId },
    select: { slotsNeeded: true },
  });
  if (!service) return [];

  // 2. Check if this date is a holiday
  const holiday = await prisma.holiday.findUnique({
    where: {
      tenantId_date: { tenantId, date: dateObj },
    },
  });
  if (holiday) return [];

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

  // 6. Mark occupied slots
  const occupiedSlots = new Set<string>();
  for (const booking of bookings) {
    const startH = parseTimeToHour(booking.startTime);
    for (let i = 0; i < booking.slotsOccupied; i++) {
      const h = startH + i;
      occupiedSlots.add(`${h.toString().padStart(2, "0")}:00`);
    }
  }

  // 7. Find available start times for the requested service
  const slotsNeeded = service.slotsNeeded;
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

  const bookings = await prisma.booking.findMany({
    where: {
      tenantId,
      date,
      status: "CONFIRMED",
      ...(excludeBookingId ? { id: { not: excludeBookingId } } : {}),
    },
    select: { startTime: true, slotsOccupied: true },
  });

  for (let i = 0; i < slotsNeeded; i++) {
    const targetH = startH + i;
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
