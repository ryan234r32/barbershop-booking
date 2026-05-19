/**
 * Tests for pickEligibleBookingForPayment — the shared helper that ensures
 * webhook's `payment` intent (Flex shown) and `payment-last5` intent (DB write)
 * agree on the target booking. Regression guard for the 2026-04-29 bug.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

const bookingFindMany = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    booking: { findMany: (...args: unknown[]) => bookingFindMany(...args) },
  },
}));

import { pickEligibleBookingForPayment } from "../payment-pick";

function makeBooking(overrides: Record<string, unknown> = {}) {
  return {
    id: "b1",
    tenantId: "t1",
    date: new Date("2026-04-29"),
    startTime: "14:00",
    endTime: "15:00",
    service: { name: "男性剪髮", price: 1000 },
    payment: null,
    ...overrides,
  };
}

describe("pickEligibleBookingForPayment", () => {
  beforeEach(() => bookingFindMany.mockReset());

  it("returns null + hasNoBookings when DB returns []", async () => {
    bookingFindMany.mockResolvedValue([]);
    const r = await pickEligibleBookingForPayment("u1", "t1");
    expect(r.eligible).toBeNull();
    expect(r.hasNoBookings).toBe(true);
    expect(r.hasOnlyPaidBookings).toBe(false);
  });

  it("returns null + hasOnlyPaidBookings when ALL bookings are VERIFYING/RECEIVED", async () => {
    bookingFindMany.mockResolvedValue([
      makeBooking({ id: "b1", payment: { status: "VERIFYING", transferLastFive: "12345" } }),
      makeBooking({ id: "b2", payment: { status: "RECEIVED", transferLastFive: "67890" } }),
    ]);
    const r = await pickEligibleBookingForPayment("u1", "t1");
    expect(r.eligible).toBeNull();
    expect(r.hasNoBookings).toBe(false);
    expect(r.hasOnlyPaidBookings).toBe(true);
  });

  it("returns the booking with no payment", async () => {
    bookingFindMany.mockResolvedValue([
      makeBooking({ id: "b1", payment: { status: "RECEIVED", transferLastFive: "12345" } }),
      makeBooking({ id: "b2", payment: null }),
    ]);
    const r = await pickEligibleBookingForPayment("u1", "t1");
    expect(r.eligible?.id).toBe("b2");
  });

  it("V3.7 P3: both PENDING and RECEIVED with null last5 are eligible (waiting on customer 5 碼)", async () => {
    // Admin checkout flow sets payment.status=RECEIVED immediately but last5
    // is null until customer reports. Helper must NOT filter these out.
    bookingFindMany.mockResolvedValue([
      makeBooking({ id: "b1", payment: { status: "RECEIVED", transferLastFive: null } }),
      makeBooking({ id: "b2", payment: { status: "PENDING", transferLastFive: null } }),
    ]);
    const r = await pickEligibleBookingForPayment("u1", "t1");
    // Tie-break by endTime distance — both eligible, mocks have same date+endTime → first wins.
    expect(["b1", "b2"]).toContain(r.eligible?.id);
    expect(r.hasOnlyPaidBookings).toBe(false);
  });

  it("returns booking with AWAITING_BANK payment as eligible", async () => {
    bookingFindMany.mockResolvedValue([
      makeBooking({ id: "b1", payment: { status: "AWAITING_BANK", transferLastFive: null } }),
    ]);
    const r = await pickEligibleBookingForPayment("u1", "t1");
    expect(r.eligible?.id).toBe("b1");
  });

  it("among multiple eligible, picks closest endTime to now", async () => {
    // Set "now" to the day before so all dates are in the future
    vi.setSystemTime(new Date("2026-04-28T10:00:00Z"));

    const today = makeBooking({
      id: "near",
      date: new Date("2026-04-28"), // today
      endTime: "15:00",
      payment: null,
    });
    const farFuture = makeBooking({
      id: "far",
      date: new Date("2026-05-03"), // 5 days later
      endTime: "15:00",
      payment: null,
    });
    bookingFindMany.mockResolvedValue([today, farFuture]);
    const r = await pickEligibleBookingForPayment("u1", "t1");
    expect(r.eligible?.id).toBe("near");

    vi.useRealTimers();
  });

  it("respects tenant + user filtering in query (V3.7 P3 includes COMPLETED)", async () => {
    bookingFindMany.mockResolvedValue([]);
    await pickEligibleBookingForPayment("u-foo", "t-bar");
    const callArgs = bookingFindMany.mock.calls[0][0] as { where: Record<string, unknown> };
    expect(callArgs.where.userId).toBe("u-foo");
    expect(callArgs.where.tenantId).toBe("t-bar");
    expect(callArgs.where.status).toEqual({ in: ["CONFIRMED", "COMPLETED"] });
  });
});
