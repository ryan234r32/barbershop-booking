import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

const findFirst = vi.fn();
const $transaction = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    booking: {
      findFirst: (...a: unknown[]) => findFirst(...a),
    },
    $transaction: (cb: (tx: unknown) => unknown) => $transaction(cb),
  },
}));

const getAdminFromCookie = vi.fn();
vi.mock("@/lib/auth/jwt", () => ({
  getAdminFromCookie: (...a: unknown[]) => getAdminFromCookie(...a),
}));

const scheduleThankYou = vi.fn().mockResolvedValue(undefined);
const scheduleFollowUp = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/notifications/scheduler", () => ({
  scheduleThankYou: (...a: unknown[]) => scheduleThankYou(...a),
  scheduleFollowUp: (...a: unknown[]) => scheduleFollowUp(...a),
}));

const issueCouponForCompletedBooking = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/coupons/issue", () => ({
  issueCouponForCompletedBooking: (...a: unknown[]) => issueCouponForCompletedBooking(...a),
}));

vi.mock("@/lib/utils/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { POST } from "@/app/api/bookings/[id]/checkout/route";

const ADMIN = { adminId: "a1", tenantId: "t1", role: "OWNER" };
const req = (body: object, id = "b1") =>
  new NextRequest(new URL(`http://x/api/bookings/${id}/checkout`), {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
const params = (id = "b1") => ({ params: Promise.resolve({ id }) });

const baseBooking = {
  id: "b1",
  tenantId: "t1",
  userId: "u1",
  status: "CONFIRMED",
  checkedInAt: new Date("2026-05-01T08:00:00Z"),
  updatedAt: new Date("2026-05-01T08:00:00Z"),
  user: { id: "u1", lineUserId: "U_alice", firstVisitAt: null },
  service: { name: "剪髮", price: 1000 },
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/bookings/[id]/checkout", () => {
  it("rejects unauthenticated → 401", async () => {
    getAdminFromCookie.mockResolvedValue(null);
    const res = await POST(req({ method: "CASH" }), params());
    expect(res.status).toBe(401);
  });

  it("validates body (missing method) → 400", async () => {
    getAdminFromCookie.mockResolvedValue(ADMIN);
    const res = await POST(req({}), params());
    expect(res.status).toBe(400);
  });

  it("returns 404 when booking not found", async () => {
    getAdminFromCookie.mockResolvedValue(ADMIN);
    findFirst.mockResolvedValue(null);
    const res = await POST(req({ method: "CASH" }), params());
    expect(res.status).toBe(404);
  });

  it("idempotent: already COMPLETED → 200 wasNoOp=true, no transaction", async () => {
    getAdminFromCookie.mockResolvedValue(ADMIN);
    findFirst.mockResolvedValue({ ...baseBooking, status: "COMPLETED" });
    const res = await POST(req({ method: "CASH" }), params());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.wasNoOp).toBe(true);
    expect($transaction).not.toHaveBeenCalled();
  });

  it("rejects non-CONFIRMED bookings (e.g. CANCELLED) → 400", async () => {
    getAdminFromCookie.mockResolvedValue(ADMIN);
    findFirst.mockResolvedValue({ ...baseBooking, status: "CANCELLED" });
    const res = await POST(req({ method: "CASH" }), params());
    expect(res.status).toBe(400);
  });

  it("completes a checked-in booking with CASH at service price", async () => {
    getAdminFromCookie.mockResolvedValue(ADMIN);
    findFirst.mockResolvedValue(baseBooking);

    const txBookingUpdateMany = vi.fn().mockResolvedValue({ count: 1 });
    const txUserUpdate = vi.fn().mockResolvedValue({});
    const txPaymentUpsert = vi.fn().mockResolvedValue({});
    const txBookingFindFirst = vi.fn().mockResolvedValue({
      id: "b1",
      status: "COMPLETED",
      checkedInAt: baseBooking.checkedInAt,
      updatedAt: new Date("2026-05-01T11:00:00Z"),
      payment: { id: "p1", method: "CASH", amount: 1000 },
    });

    $transaction.mockImplementation(async (cb: (tx: unknown) => unknown) =>
      cb({
        booking: { updateMany: txBookingUpdateMany, findFirst: txBookingFindFirst },
        user: { update: txUserUpdate },
        payment: { upsert: txPaymentUpsert },
      }),
    );

    const res = await POST(req({ method: "CASH" }), params());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.wasNoOp).toBe(false);

    expect(txBookingUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "b1",
          status: "CONFIRMED",
          updatedAt: baseBooking.updatedAt,
        }),
        data: expect.objectContaining({ status: "COMPLETED" }),
      }),
    );

    expect(txPaymentUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { bookingId: "b1" },
        create: expect.objectContaining({
          bookingId: "b1",
          amount: 1000,
          method: "CASH",
          status: "RECEIVED",
        }),
      }),
    );

    expect(txUserUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ totalVisits: { increment: 1 } }),
      }),
    );

    // Best-effort post-effects fired
    expect(scheduleThankYou).toHaveBeenCalled();
    expect(scheduleFollowUp).toHaveBeenCalled();
    expect(issueCouponForCompletedBooking).toHaveBeenCalled();
  });

  it("auto-checkin: NULL checkedInAt → set to now() before completing", async () => {
    getAdminFromCookie.mockResolvedValue(ADMIN);
    findFirst.mockResolvedValue({ ...baseBooking, checkedInAt: null });

    const txBookingUpdateMany = vi.fn().mockResolvedValue({ count: 1 });
    $transaction.mockImplementation(async (cb: (tx: unknown) => unknown) =>
      cb({
        booking: {
          updateMany: txBookingUpdateMany,
          findFirst: vi.fn().mockResolvedValue({
            id: "b1",
            status: "COMPLETED",
            checkedInAt: new Date(),
            updatedAt: new Date(),
            payment: null,
          }),
        },
        user: { update: vi.fn().mockResolvedValue({}) },
        payment: { upsert: vi.fn().mockResolvedValue({}) },
      }),
    );

    const res = await POST(req({ method: "CASH" }), params());
    expect(res.status).toBe(200);
    expect(txBookingUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "COMPLETED",
          checkedInAt: expect.any(Date),
        }),
      }),
    );
  });

  it("respects explicit amount override (e.g. discount)", async () => {
    getAdminFromCookie.mockResolvedValue(ADMIN);
    findFirst.mockResolvedValue(baseBooking);

    const txPaymentUpsert = vi.fn().mockResolvedValue({});
    $transaction.mockImplementation(async (cb: (tx: unknown) => unknown) =>
      cb({
        booking: {
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          findFirst: vi.fn().mockResolvedValue({
            id: "b1",
            status: "COMPLETED",
            checkedInAt: baseBooking.checkedInAt,
            updatedAt: new Date(),
            payment: null,
          }),
        },
        user: { update: vi.fn().mockResolvedValue({}) },
        payment: { upsert: txPaymentUpsert },
      }),
    );

    const res = await POST(req({ method: "BANK_TRANSFER", amount: 800 }), params());
    expect(res.status).toBe(200);
    expect(txPaymentUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ amount: 800, method: "BANK_TRANSFER" }),
      }),
    );
  });

  it("stale write (expectedUpdatedAt mismatch) → 409, no transaction", async () => {
    getAdminFromCookie.mockResolvedValue(ADMIN);
    findFirst.mockResolvedValue(baseBooking);
    const res = await POST(
      req({ method: "CASH", expectedUpdatedAt: "2025-01-01T00:00:00.000Z" }),
      params(),
    );
    const body = await res.json();
    expect(res.status).toBe(409);
    expect(body.error).toBe("stale_write");
    expect($transaction).not.toHaveBeenCalled();
  });
});
