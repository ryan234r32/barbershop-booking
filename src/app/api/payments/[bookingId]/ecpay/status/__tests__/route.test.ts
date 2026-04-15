import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { UnauthorizedError } from "@/lib/utils/errors";

const bookingFindFirst = vi.fn();
const ecpayFindFirst = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    booking: { findFirst: (...a: unknown[]) => bookingFindFirst(...a) },
    eCPayOrder: { findFirst: (...a: unknown[]) => ecpayFindFirst(...a) },
  },
}));

const requireBookingAuth = vi.fn();
vi.mock("@/lib/auth/booking-auth", () => ({
  requireBookingAuth: (...a: unknown[]) => requireBookingAuth(...a),
  requireBookingOwnership: vi.fn(),
  requireAdmin: vi.fn(),
}));

import { GET } from "@/app/api/payments/[bookingId]/ecpay/status/route";

const req = () =>
  new NextRequest(new URL("http://x/api/payments/b1/ecpay/status"));
const params = { params: Promise.resolve({ bookingId: "b1" }) };

beforeEach(() => {
  vi.clearAllMocks();
  requireBookingAuth.mockResolvedValue({
    type: "liff",
    lineUserId: "Uabc",
    tenantId: "t1",
  });
});

describe("GET /api/payments/[bookingId]/ecpay/status", () => {
  it("returns order fields (no merchantTradeNo, no raw payloads)", async () => {
    bookingFindFirst.mockResolvedValue({ id: "b1" });
    ecpayFindFirst.mockResolvedValue({
      status: "PENDING",
      vAccount: "1234567890",
      bankCode: "008",
      expireDate: new Date("2026-04-20T03:00:00Z"),
      amount: 500,
    });
    const res = await GET(req(), params);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.status).toBe("PENDING");
    expect(body.vAccount).toBe("1234567890");
    expect(body.bankCode).toBe("008");
    expect(body.amount).toBe(500);
    expect(body.merchantTradeNo).toBeUndefined();
    // select field list must not include raw payloads
    const selectArg = ecpayFindFirst.mock.calls[0][0].select;
    expect(selectArg.rawCreateResponse).toBeUndefined();
    expect(selectArg.rawPaymentInfo).toBeUndefined();
    expect(selectArg.rawReturn).toBeUndefined();
    expect(selectArg.merchantTradeNo).toBeUndefined();
  });

  it("enforces tenant isolation on the booking lookup", async () => {
    bookingFindFirst.mockResolvedValue({ id: "b1" });
    ecpayFindFirst.mockResolvedValue({
      status: "PENDING",
      vAccount: null,
      bankCode: null,
      expireDate: null,
      amount: 500,
    });
    await GET(req(), params);
    expect(bookingFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "b1", tenantId: "t1" },
      })
    );
    expect(ecpayFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { bookingId: "b1", tenantId: "t1" },
      })
    );
  });

  it("404 when booking not found in tenant", async () => {
    bookingFindFirst.mockResolvedValue(null);
    const res = await GET(req(), params);
    const body = await res.json();
    expect(res.status).toBe(404);
    expect(body.code).toBe("BOOKING_NOT_FOUND");
  });

  it("404 when no ECPay order exists yet", async () => {
    bookingFindFirst.mockResolvedValue({ id: "b1" });
    ecpayFindFirst.mockResolvedValue(null);
    const res = await GET(req(), params);
    const body = await res.json();
    expect(res.status).toBe(404);
    expect(body.code).toBe("ECPAY_ORDER_NOT_FOUND");
  });

  it("401 when unauthenticated", async () => {
    requireBookingAuth.mockRejectedValue(new UnauthorizedError());
    const res = await GET(req(), params);
    expect(res.status).toBe(401);
  });
});
