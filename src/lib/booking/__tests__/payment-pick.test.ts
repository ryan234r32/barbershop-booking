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
    // 5/19: payment.createdAt is required for the tie-break logic.
    bookingFindMany.mockResolvedValue([
      makeBooking({ id: "b1", payment: { status: "RECEIVED", transferLastFive: null, method: "BANK_TRANSFER", createdAt: new Date("2026-05-19T10:00:00Z") } }),
      makeBooking({ id: "b2", payment: { status: "PENDING", transferLastFive: null, method: "BANK_TRANSFER", createdAt: new Date("2026-05-19T10:05:00Z") } }),
    ]);
    const r = await pickEligibleBookingForPayment("u1", "t1");
    // V3.7 P3 tie-break: payment.createdAt DESC → b2 (later) wins.
    expect(r.eligible?.id).toBe("b2");
    expect(r.hasOnlyPaidBookings).toBe(false);
  });

  it("returns booking with AWAITING_BANK payment as eligible", async () => {
    bookingFindMany.mockResolvedValue([
      makeBooking({ id: "b1", payment: { status: "AWAITING_BANK", transferLastFive: null, method: "BANK_TRANSFER", createdAt: new Date("2026-05-19T10:00:00Z") } }),
    ]);
    const r = await pickEligibleBookingForPayment("u1", "t1");
    expect(r.eligible?.id).toBe("b1");
  });

  it("V3.7 P3: tie-break by Payment.createdAt DESC (admin 剛建那筆 wins, not 距 now 最近)", async () => {
    // Repro 5/19 bug: customer has booking A (closer date) + booking B (further).
    // Admin checks out B → creates Payment for B (newer createdAt).
    // Customer types 5 碼 → should write to B (matches the Flex admin pushed).
    vi.setSystemTime(new Date("2026-05-19T14:00:00Z"));
    const bookingA = makeBooking({
      id: "a-染-tomorrow",
      date: new Date("2026-05-20"),
      endTime: "12:00",
      payment: {
        status: "RECEIVED",
        transferLastFive: null,
        method: "BANK_TRANSFER",
        createdAt: new Date("2026-05-18T10:00:00Z"), // older
      },
    });
    const bookingB = makeBooking({
      id: "b-剪-4-days-out",
      date: new Date("2026-05-23"),
      endTime: "12:00",
      payment: {
        status: "RECEIVED",
        transferLastFive: null,
        method: "BANK_TRANSFER",
        createdAt: new Date("2026-05-19T13:55:00Z"), // newer (admin 剛 checkout)
      },
    });
    bookingFindMany.mockResolvedValue([bookingA, bookingB]);
    const r = await pickEligibleBookingForPayment("u1", "t1");
    expect(r.eligible?.id).toBe("b-剪-4-days-out");
    vi.useRealTimers();
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
