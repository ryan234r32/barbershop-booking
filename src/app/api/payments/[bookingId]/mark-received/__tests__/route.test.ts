import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { UnauthorizedError } from "@/lib/utils/errors";

const bookingFindUnique = vi.fn();
const paymentCreate = vi.fn();
const paymentUpdate = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    booking: { findUnique: (...a: unknown[]) => bookingFindUnique(...a) },
    payment: {
      create: (...a: unknown[]) => paymentCreate(...a),
      update: (...a: unknown[]) => paymentUpdate(...a),
    },
  },
}));

const requireBookingAuth = vi.fn();
const requireBookingOwnership = vi.fn();
const requireAdmin = vi.fn();
vi.mock("@/lib/auth/booking-auth", () => ({
  requireBookingAuth: (...a: unknown[]) => requireBookingAuth(...a),
  requireBookingOwnership: (...a: unknown[]) => requireBookingOwnership(...a),
  requireAdmin: (...a: unknown[]) => requireAdmin(...a),
}));

const mockPushMessage = vi.fn().mockResolvedValue({});
vi.mock("@/lib/line/client", () => ({
  getLineClient: () => ({ pushMessage: mockPushMessage }),
}));

import { PATCH } from "@/app/api/payments/[bookingId]/mark-received/route";

const ADMIN_AUTH = { type: "admin", adminId: "a1", tenantId: "t1" };
const LIFF_AUTH = { type: "liff", lineUserId: "Uabc", tenantId: "t1" };

const makeBooking = (overrides: Record<string, unknown> = {}) => ({
  id: "b1",
  tenantId: "t1",
  status: "CONFIRMED",
  date: new Date("2026-05-10T00:00:00Z"),
  startTime: "14:00",
  service: { name: "剪髮", price: 500 },
  user: { lineUserId: "Uabc", displayName: "客戶" },
  payment: null,
  ...overrides,
});

const req = () =>
  new NextRequest(new URL("http://x/api/payments/b1/mark-received"), {
    method: "PATCH",
  });
const params = { params: Promise.resolve({ bookingId: "b1" }) };

beforeEach(() => {
  vi.clearAllMocks();
  requireBookingAuth.mockResolvedValue(ADMIN_AUTH);
  requireAdmin.mockImplementation(() => {});
  requireBookingOwnership.mockImplementation(() => {});
  paymentCreate.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
    Promise.resolve({ ...data })
  );
  paymentUpdate.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
    Promise.resolve({ amount: 500, method: "BANK_TRANSFER", ...data })
  );
});

describe("PATCH /api/payments/[bookingId]/mark-received", () => {
  it("admin marks VERIFYING → RECEIVED with receivedAt", async () => {
    bookingFindUnique.mockResolvedValue(
      makeBooking({ payment: { status: "VERIFYING", amount: 500, method: "BANK_TRANSFER" } })
    );
    const res = await PATCH(req(), params);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.payment.status).toBe("RECEIVED");
    expect(paymentUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { bookingId: "b1" },
        data: expect.objectContaining({ status: "RECEIVED", receivedAt: expect.any(Date) }),
      })
    );
    expect(mockPushMessage).toHaveBeenCalledOnce();
  });

  it("admin marks PENDING (cash walk-in) → RECEIVED", async () => {
    bookingFindUnique.mockResolvedValue(
      makeBooking({ payment: { status: "PENDING", amount: 500, method: "CASH" } })
    );
    const res = await PATCH(req(), params);
    expect(res.status).toBe(200);
    expect(paymentUpdate).toHaveBeenCalled();
  });

  it("no Payment row → creates Payment(CASH, RECEIVED)", async () => {
    bookingFindUnique.mockResolvedValue(makeBooking({ payment: null }));
    const res = await PATCH(req(), params);
    expect(res.status).toBe(200);
    expect(paymentCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          bookingId: "b1",
          amount: 500,
          method: "CASH",
          status: "RECEIVED",
        }),
      })
    );
  });

  it("already RECEIVED → 200 idempotent (no double-push, no update)", async () => {
    const receivedAt = new Date("2026-05-09T10:00:00Z");
    bookingFindUnique.mockResolvedValue(
      makeBooking({ payment: { status: "RECEIVED", receivedAt } })
    );
    const res = await PATCH(req(), params);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.idempotent).toBe(true);
    expect(paymentUpdate).not.toHaveBeenCalled();
    expect(paymentCreate).not.toHaveBeenCalled();
    expect(mockPushMessage).not.toHaveBeenCalled();
  });

  it("WAIVED → 409 PAYMENT_WAIVED", async () => {
    bookingFindUnique.mockResolvedValue(
      makeBooking({ payment: { status: "WAIVED" } })
    );
    const res = await PATCH(req(), params);
    const body = await res.json();
    expect(res.status).toBe(409);
    expect(body.code).toBe("PAYMENT_WAIVED");
  });

  it("non-admin LIFF caller → 401 (requireAdmin)", async () => {
    requireBookingAuth.mockResolvedValue(LIFF_AUTH);
    requireAdmin.mockImplementation(() => {
      throw new UnauthorizedError("僅限店家人員操作");
    });
    const res = await PATCH(req(), params);
    expect(res.status).toBe(401);
  });

  it("cross-tenant admin → 401 (requireBookingOwnership)", async () => {
    bookingFindUnique.mockResolvedValue(makeBooking({ tenantId: "other-tenant" }));
    requireBookingOwnership.mockImplementation(() => {
      throw new UnauthorizedError("無權存取此預約");
    });
    const res = await PATCH(req(), params);
    expect(res.status).toBe(401);
  });

  it("booking not found → 404", async () => {
    bookingFindUnique.mockResolvedValue(null);
    const res = await PATCH(req(), params);
    const body = await res.json();
    expect(res.status).toBe(404);
    expect(body.code).toBe("BOOKING_NOT_FOUND");
  });

  it("skips LINE push for manual-* users", async () => {
    bookingFindUnique.mockResolvedValue(
      makeBooking({
        payment: { status: "VERIFYING", amount: 500 },
        user: { lineUserId: "manual-a1-uuid", displayName: "walk-in" },
      })
    );
    const res = await PATCH(req(), params);
    expect(res.status).toBe(200);
    expect(mockPushMessage).not.toHaveBeenCalled();
  });
});
