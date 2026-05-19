/**
 * Tests for past-slot filtering on today's bookings (added 2026-04-30).
 * Past dates / tomorrow / future dates are unchanged; only today's already-passed
 * hours are excluded from available slots.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

const serviceFindUnique = vi.fn();
const serviceFindMany = vi.fn();
const holidayFindUnique = vi.fn();
const businessHoursFindUnique = vi.fn();
const bookingFindMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    service: {
      findUnique: (...a: unknown[]) => serviceFindUnique(...a),
      findMany: (...a: unknown[]) => serviceFindMany(...a),
    },
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
    // V3.7 Tier 0.2: getAvailableSlots now uses findMany (sums slotsNeeded
    // across one or more services). Default = haircut-like single service.
    serviceFindMany.mockResolvedValue([{ id: "s-haircut", slotsNeeded: 1 }]);
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
    serviceFindMany.mockResolvedValue([{ id: "s-perm", slotsNeeded: 3 }]);
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

// V3.7 P3 (5/19) — variant-aware caller path: client resolves variant.slotsNeeded
// itself and passes the resolved total to getAvailableSlots, skipping service DB.
describe("getAvailableSlots — V3.7 P3 direct slotsNeeded path", () => {
  beforeEach(() => {
    // Full mock reset — previous describe blocks' calls don't leak into our
    // `not.toHaveBeenCalled()` assertions. clearAllMocks() resets ALL vi.fn()
    // call history at once.
    vi.clearAllMocks();
    serviceFindUnique.mockResolvedValue({ slotsNeeded: 1 });
    serviceFindMany.mockResolvedValue([{ id: "s-haircut", slotsNeeded: 1 }]);
    holidayFindUnique.mockResolvedValue(null);
    businessHoursFindUnique.mockResolvedValue({
      isOpen: true,
      startTime: "11:00",
      endTime: "20:00",
    });
    bookingFindMany.mockResolvedValue([]);
  });

  it("slotsNeeded=1 directly → skips service.findMany lookup, returns all slots", async () => {
    const slots = await getAvailableSlots({
      tenantId: "t1",
      date: "2026-05-01", // tomorrow → past-hour filter inactive
      slotsNeeded: 1,
    });
    expect(serviceFindMany).not.toHaveBeenCalled();
    const startTimes = slots.map((s) => s.startTime);
    expect(startTimes).toContain("11:00");
    expect(startTimes).toContain("19:00");
    // 11..19 = 9 starts when slotsNeeded=1 and shop is 11-20
    expect(startTimes.length).toBe(9);
  });

  it("slotsNeeded=3 (perm) directly → returns starts with 3-consec free window", async () => {
    const slots = await getAvailableSlots({
      tenantId: "t1",
      date: "2026-05-01",
      slotsNeeded: 3,
    });
    expect(serviceFindMany).not.toHaveBeenCalled();
    const startTimes = slots.map((s) => s.startTime);
    // 11..17 valid starts (17 + 3 = 20 = endTime). 18 + 3 = 21 > 20.
    expect(startTimes).toContain("11:00");
    expect(startTimes).toContain("17:00");
    expect(startTimes).not.toContain("18:00");
    expect(startTimes).not.toContain("19:00");
  });

  it("slotsNeeded=0 → falls through to legacy serviceId lookup", async () => {
    // 0 is falsy → caller path drops through; with no serviceId/serviceIds
    // it should return [].
    const slots = await getAvailableSlots({
      tenantId: "t1",
      date: "2026-05-01",
      slotsNeeded: 0,
    });
    expect(slots).toEqual([]);
    expect(serviceFindMany).not.toHaveBeenCalled();
  });

  it("slotsNeeded ignored when explicit serviceIds also passed? prefers slotsNeeded", async () => {
    // Implementation: if slotsNeeded > 0, it wins — no DB hit at all.
    const slots = await getAvailableSlots({
      tenantId: "t1",
      date: "2026-05-01",
      slotsNeeded: 2,
      serviceIds: ["s-haircut"],
    });
    expect(serviceFindMany).not.toHaveBeenCalled();
    const startTimes = slots.map((s) => s.startTime);
    // 2-slot service: 11..18 valid starts (18 + 2 = 20).
    expect(startTimes).toContain("11:00");
    expect(startTimes).toContain("18:00");
    expect(startTimes).not.toContain("19:00");
  });

  it("legacy serviceIds path (multi-service) still works — sums slotsNeeded", async () => {
    serviceFindMany.mockResolvedValue([
      { id: "s-haircut", slotsNeeded: 1 },
      { id: "s-perm", slotsNeeded: 3 },
    ]);
    const slots = await getAvailableSlots({
      tenantId: "t1",
      date: "2026-05-01",
      serviceIds: ["s-haircut", "s-perm"],
    });
    expect(serviceFindMany).toHaveBeenCalled();
    // Total slotsNeeded = 4 → 11..16 valid starts.
    const startTimes = slots.map((s) => s.startTime);
    expect(startTimes).toContain("11:00");
    expect(startTimes).toContain("16:00");
    expect(startTimes).not.toContain("17:00");
  });

  it("legacy serviceIds with one service missing in DB → returns []", async () => {
    // Asked for 2, DB returns 1 → mismatched → caller treats as invalid input.
    serviceFindMany.mockResolvedValue([{ id: "s-haircut", slotsNeeded: 1 }]);
    const slots = await getAvailableSlots({
      tenantId: "t1",
      date: "2026-05-01",
      serviceIds: ["s-haircut", "s-missing"],
    });
    expect(slots).toEqual([]);
  });

  it("no slotsNeeded + no serviceId + no serviceIds → returns []", async () => {
    const slots = await getAvailableSlots({
      tenantId: "t1",
      date: "2026-05-01",
    });
    expect(slots).toEqual([]);
    expect(serviceFindMany).not.toHaveBeenCalled();
  });
});
