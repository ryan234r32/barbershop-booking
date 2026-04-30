/**
 * Tests for past-slot filtering on today's bookings (added 2026-04-30).
 * Past dates / tomorrow / future dates are unchanged; only today's already-passed
 * hours are excluded from available slots.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

const serviceFindUnique = vi.fn();
const holidayFindUnique = vi.fn();
const businessHoursFindUnique = vi.fn();
const bookingFindMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    service: { findUnique: (...a: unknown[]) => serviceFindUnique(...a) },
    holiday: { findUnique: (...a: unknown[]) => holidayFindUnique(...a) },
    businessHours: { findUnique: (...a: unknown[]) => businessHoursFindUnique(...a) },
    booking: { findMany: (...a: unknown[]) => bookingFindMany(...a) },
  },
}));

vi.mock("@/lib/utils/time", async () => {
  const actual = await vi.importActual<typeof import("@/lib/utils/time")>("@/lib/utils/time");
  return {
    ...actual,
    todayInTaipei: () => "2026-04-30",
    currentHourTaipei: () => 14, // pretend Taipei 14:30
  };
});

import { getAvailableSlots } from "../availability";

describe("getAvailableSlots — past-hour filter (today only)", () => {
  beforeEach(() => {
    serviceFindUnique.mockResolvedValue({ slotsNeeded: 1 });
    holidayFindUnique.mockResolvedValue(null);
    businessHoursFindUnique.mockResolvedValue({
      isOpen: true,
      startTime: "11:00",
      endTime: "20:00",
    });
    bookingFindMany.mockResolvedValue([]);
  });

  it("today: hides slots whose start hour <= currentHour (14)", async () => {
    const slots = await getAvailableSlots({
      tenantId: "t1",
      date: "2026-04-30",
      serviceId: "s-haircut",
    });
    const startTimes = slots.map((s) => s.startTime);
    expect(startTimes).not.toContain("11:00");
    expect(startTimes).not.toContain("12:00");
    expect(startTimes).not.toContain("13:00");
    expect(startTimes).not.toContain("14:00");
    expect(startTimes).toContain("15:00");
    expect(startTimes).toContain("19:00");
  });

  it("tomorrow: shows ALL slots (filter inactive)", async () => {
    const slots = await getAvailableSlots({
      tenantId: "t1",
      date: "2026-05-01",
      serviceId: "s-haircut",
    });
    const startTimes = slots.map((s) => s.startTime);
    expect(startTimes).toContain("11:00");
    expect(startTimes).toContain("12:00");
    expect(startTimes).toContain("19:00");
  });

  it("today multi-slot service (perm 3 slots): only allows starts where startHour > currentHour", async () => {
    serviceFindUnique.mockResolvedValue({ slotsNeeded: 3 });
    const slots = await getAvailableSlots({
      tenantId: "t1",
      date: "2026-04-30",
      serviceId: "s-perm",
    });
    const startTimes = slots.map((s) => s.startTime);
    expect(startTimes).not.toContain("13:00");
    expect(startTimes).not.toContain("14:00");
    expect(startTimes).toContain("15:00");
    expect(startTimes).toContain("17:00");
  });
});
