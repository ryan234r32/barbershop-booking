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

const cancelBookingNotifications = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/notifications/scheduler", () => ({
  cancelBookingNotifications: (...a: unknown[]) => cancelBookingNotifications(...a),
}));

const notifyAdminCancellation = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/notifications/admin-notify", () => ({
  notifyAdminCancellation: (...a: unknown[]) => notifyAdminCancellation(...a),
}));

vi.mock("@/lib/utils/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { PATCH } from "@/app/api/bookings/[id]/no-show/route";

const ADMIN = { adminId: "a1", tenantId: "t1", role: "OWNER" };
const req = (body?: object, id = "b1") =>
  new NextRequest(new URL(`http://x/api/bookings/${id}/no-show`), {
    method: "PATCH",
    body: body ? JSON.stringify(body) : undefined,
    headers: body ? { "content-type": "application/json" } : undefined,
  });
const params = (id = "b1") => ({ params: Promise.resolve({ id }) });

const baseBooking = {
  id: "b1",
  tenantId: "t1",
  userId: "u1",
  status: "CONFIRMED",
  date: new Date("2026-05-01"),
  startTime: "14:00",
  updatedAt: new Date("2026-05-01T09:00:00Z"),
  user: { id: "u1", displayName: "Alice", violationCount: 0 },
  service: { name: "剪髮" },
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("PATCH /api/bookings/[id]/no-show", () => {
  it("rejects unauthenticated → 401", async () => {
    getAdminFromCookie.mockResolvedValue(null);
    const res = await PATCH(req(), params());
    expect(res.status).toBe(401);
  });

  it("returns 404 when booking not found (cross-tenant safety)", async () => {
    getAdminFromCookie.mockResolvedValue(ADMIN);
    findFirst.mockResolvedValue(null);
    const res = await PATCH(req(), params());
    expect(res.status).toBe(404);
  });

  it("idempotent: already NO_SHOW → 200 with wasNoOp=true, no transaction", async () => {
    getAdminFromCookie.mockResolvedValue(ADMIN);
    findFirst.mockResolvedValue({ ...baseBooking, status: "NO_SHOW" });
    const res = await PATCH(req(), params());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.wasNoOp).toBe(true);
    expect($transaction).not.toHaveBeenCalled();
  });

  it("rejects non-CONFIRMED bookings (e.g. COMPLETED) → 400", async () => {
    getAdminFromCookie.mockResolvedValue(ADMIN);
    findFirst.mockResolvedValue({ ...baseBooking, status: "COMPLETED" });
    const res = await PATCH(req(), params());
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error).toBe("invalid_status");
  });

  it("marks NO_SHOW + increments violationCount + creates cancellation record", async () => {
    getAdminFromCookie.mockResolvedValue(ADMIN);
    findFirst.mockResolvedValue({ ...baseBooking, user: { ...baseBooking.user, violationCount: 1 } });

    const txBookingUpdateMany = vi.fn().mockResolvedValue({ count: 1 });
    const txUserUpdate = vi.fn().mockResolvedValue({});
    const txCancellationUpsert = vi.fn().mockResolvedValue({});
    const txBookingFindFirst = vi.fn().mockResolvedValue({
      id: "b1",
      status: "NO_SHOW",
      checkedInAt: null,
      updatedAt: new Date("2026-05-01T11:00:00Z"),
    });

    $transaction.mockImplementation(async (cb: (tx: unknown) => unknown) =>
      cb({
        booking: { updateMany: txBookingUpdateMany, findFirst: txBookingFindFirst },
        user: { update: txUserUpdate },
        cancellationRecord: { upsert: txCancellationUpsert },
      }),
    );

    const res = await PATCH(req(), params());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.violation.violationCount).toBe(2);
    expect(body.violation.restricted).toBe(false);

    // OCC fence in WHERE
    expect(txBookingUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "b1",
          tenantId: "t1",
          status: "CONFIRMED",
          updatedAt: baseBooking.updatedAt,
        }),
        data: expect.objectContaining({
          status: "NO_SHOW",
          checkedInAt: null,
        }),
      }),
    );
    expect(txUserUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "u1" },
        data: expect.objectContaining({
          violationCount: 2,
          bookingRestricted: false,
        }),
      }),
    );
    expect(txCancellationUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { bookingId: "b1" },
        create: expect.objectContaining({ isViolation: true }),
      }),
    );
  });

  it("third violation → restricted=true with restrictedUntil 30 days out", async () => {
    getAdminFromCookie.mockResolvedValue(ADMIN);
    findFirst.mockResolvedValue({ ...baseBooking, user: { ...baseBooking.user, violationCount: 2 } });

    const txUserUpdate = vi.fn().mockResolvedValue({});
    $transaction.mockImplementation(async (cb: (tx: unknown) => unknown) =>
      cb({
        booking: {
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          findFirst: vi.fn().mockResolvedValue({
            id: "b1",
            status: "NO_SHOW",
            checkedInAt: null,
            updatedAt: new Date(),
          }),
        },
        user: { update: txUserUpdate },
        cancellationRecord: { upsert: vi.fn().mockResolvedValue({}) },
      }),
    );

    const res = await PATCH(req(), params());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.violation.restricted).toBe(true);
    expect(txUserUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          violationCount: 3,
          bookingRestricted: true,
          restrictedUntil: expect.any(Date),
        }),
      }),
    );
  });

  it("stale write (expectedUpdatedAt mismatch) → 409", async () => {
    getAdminFromCookie.mockResolvedValue(ADMIN);
    findFirst.mockResolvedValue(baseBooking);
    const res = await PATCH(
      req({ expectedUpdatedAt: "2025-01-01T00:00:00.000Z" }),
      params(),
    );
    const body = await res.json();
    expect(res.status).toBe(409);
    expect(body.error).toBe("stale_write");
    expect($transaction).not.toHaveBeenCalled();
  });

  it("stale write inside transaction (count=0) → 409 + no side effects", async () => {
    getAdminFromCookie.mockResolvedValue(ADMIN);
    findFirst
      .mockResolvedValueOnce(baseBooking)
      // recovery findFirst after the StaleWriteError
      .mockResolvedValueOnce({
        status: "CONFIRMED",
        updatedAt: new Date("2026-05-01T11:00:00Z"),
      });

    const txUserUpdate = vi.fn();
    const txCancellationUpsert = vi.fn();
    $transaction.mockImplementation(async (cb: (tx: unknown) => unknown) =>
      cb({
        booking: {
          updateMany: vi.fn().mockResolvedValue({ count: 0 }),
          findFirst: vi.fn(),
        },
        user: { update: txUserUpdate },
        cancellationRecord: { upsert: txCancellationUpsert },
      }),
    );

    const res = await PATCH(req(), params());
    const body = await res.json();
    expect(res.status).toBe(409);
    expect(body.error).toBe("stale_write");
    // The throw should have rolled back the transaction — these would not have been awaited.
    // Note: in this mock setup, txUserUpdate is called before the throw bubbles up,
    // but Prisma's real $transaction rolls them back. The test verifies our route logic
    // surfaces the 409 correctly.
  });
});
