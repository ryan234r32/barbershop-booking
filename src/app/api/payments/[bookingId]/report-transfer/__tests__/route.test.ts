import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { UnauthorizedError } from "@/lib/utils/errors";

// ── Prisma mock ─────────────────────────────────────────────────
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

// ── Auth mocks ──────────────────────────────────────────────────
const requireBookingAuth = vi.fn();
const requireBookingOwnership = vi.fn();
vi.mock("@/lib/auth/booking-auth", () => ({
  requireBookingAuth: (...a: unknown[]) => requireBookingAuth(...a),
  requireBookingOwnership: (...a: unknown[]) => requireBookingOwnership(...a),
  requireAdmin: vi.fn(),
}));

// ── Notification mock ───────────────────────────────────────────
const notifyAdminTransferReported = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/notifications/admin-notify", () => ({
  notifyAdminTransferReported: (...a: unknown[]) =>
    notifyAdminTransferReported(...a),
}));

import { POST } from "@/app/api/payments/[bookingId]/report-transfer/route";

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

const req = (body: unknown) =>
  new NextRequest(new URL("http://x/api/payments/b1/report-transfer"), {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
const params = { params: Promise.resolve({ bookingId: "b1" }) };

beforeEach(() => {
  vi.clearAllMocks();
  requireBookingAuth.mockResolvedValue(LIFF_AUTH);
  requireBookingOwnership.mockImplementation(() => {});
  paymentCreate.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
    Promise.resolve({ ...data, verifiedAt: new Date() })
  );
  paymentUpdate.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
    Promise.resolve({ amount: 500, ...data, verifiedAt: new Date() })
  );
});

describe("POST /api/payments/[bookingId]/report-transfer", () => {
  it("happy path: CONFIRMED + valid 5 digits → creates Payment(VERIFYING)", async () => {
    bookingFindUnique.mockResolvedValue(makeBooking());
    const res = await POST(req({ transferLastFive: "12345" }), params);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.payment.status).toBe("VERIFYING");
    expect(paymentCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          bookingId: "b1",
          method: "BANK_TRANSFER",
          status: "VERIFYING",
          transferLastFive: "12345",
          amount: 500,
        }),
      })
    );
  });

  it("existing PENDING payment → updates to VERIFYING", async () => {
    bookingFindUnique.mockResolvedValue(
      makeBooking({ payment: { status: "PENDING", amount: 500 } })
    );
    const res = await POST(req({ transferLastFive: "54321" }), params);
    expect(res.status).toBe(200);
    expect(paymentUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { bookingId: "b1" },
        data: expect.objectContaining({
          status: "VERIFYING",
          method: "BANK_TRANSFER",
          transferLastFive: "54321",
        }),
      })
    );
    expect(paymentCreate).not.toHaveBeenCalled();
  });

  it("payment already VERIFYING → 409 PAYMENT_LOCKED", async () => {
    bookingFindUnique.mockResolvedValue(
      makeBooking({ payment: { status: "VERIFYING" } })
    );
    const res = await POST(req({ transferLastFive: "12345" }), params);
    const body = await res.json();
    expect(res.status).toBe(409);
    expect(body.code).toBe("PAYMENT_LOCKED");
  });

  it("payment RECEIVED → 409 PAYMENT_LOCKED", async () => {
    bookingFindUnique.mockResolvedValue(
      makeBooking({ payment: { status: "RECEIVED" } })
    );
    const res = await POST(req({ transferLastFive: "12345" }), params);
    expect(res.status).toBe(409);
  });

  it("payment WAIVED → 409 PAYMENT_LOCKED", async () => {
    bookingFindUnique.mockResolvedValue(
      makeBooking({ payment: { status: "WAIVED" } })
    );
    const res = await POST(req({ transferLastFive: "12345" }), params);
    expect(res.status).toBe(409);
  });

  it("booking CANCELLED → 422 BOOKING_NOT_CONFIRMED", async () => {
    bookingFindUnique.mockResolvedValue(makeBooking({ status: "CANCELLED" }));
    const res = await POST(req({ transferLastFive: "12345" }), params);
    const body = await res.json();
    expect(res.status).toBe(422);
    expect(body.code).toBe("BOOKING_NOT_CONFIRMED");
  });

  it("booking NO_SHOW → 422", async () => {
    bookingFindUnique.mockResolvedValue(makeBooking({ status: "NO_SHOW" }));
    const res = await POST(req({ transferLastFive: "12345" }), params);
    expect(res.status).toBe(422);
  });

  it("unauthorized (no auth) → 401", async () => {
    requireBookingAuth.mockRejectedValue(new UnauthorizedError());
    const res = await POST(req({ transferLastFive: "12345" }), params);
    expect(res.status).toBe(401);
  });

  it("LIFF user accessing someone else's booking → 401", async () => {
    bookingFindUnique.mockResolvedValue(makeBooking());
    requireBookingOwnership.mockImplementation(() => {
      throw new UnauthorizedError("無權存取此預約");
    });
    const res = await POST(req({ transferLastFive: "12345" }), params);
    expect(res.status).toBe(401);
  });

  it("invalid last5 (4 digits) → 400 ZodError", async () => {
    bookingFindUnique.mockResolvedValue(makeBooking());
    const res = await POST(req({ transferLastFive: "1234" }), params);
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.code).toBe("VALIDATION_ERROR");
  });

  it("invalid last5 (letters) → 400 ZodError", async () => {
    bookingFindUnique.mockResolvedValue(makeBooking());
    const res = await POST(req({ transferLastFive: "abcde" }), params);
    expect(res.status).toBe(400);
  });

  it("booking not found → 404", async () => {
    bookingFindUnique.mockResolvedValue(null);
    const res = await POST(req({ transferLastFive: "12345" }), params);
    const body = await res.json();
    expect(res.status).toBe(404);
    expect(body.code).toBe("BOOKING_NOT_FOUND");
  });
});
