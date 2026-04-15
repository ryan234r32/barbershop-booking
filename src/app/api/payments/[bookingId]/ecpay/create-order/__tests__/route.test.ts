import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { UnauthorizedError, AppError } from "@/lib/utils/errors";

const requireBookingAuth = vi.fn();
vi.mock("@/lib/auth/booking-auth", () => ({
  requireBookingAuth: (...a: unknown[]) => requireBookingAuth(...a),
  requireBookingOwnership: vi.fn(),
  requireAdmin: vi.fn(),
}));

const createOrder = vi.fn();
vi.mock("@/lib/ecpay/order-service", () => ({
  createEcpayAtmOrder: (...a: unknown[]) => createOrder(...a),
}));

import { POST } from "@/app/api/payments/[bookingId]/ecpay/create-order/route";

const req = () =>
  new NextRequest(
    new URL("http://x/api/payments/b1/ecpay/create-order"),
    { method: "POST" }
  );
const params = { params: Promise.resolve({ bookingId: "b1" }) };

beforeEach(() => {
  vi.clearAllMocks();
  requireBookingAuth.mockResolvedValue({
    type: "liff",
    lineUserId: "Uabc",
    tenantId: "t1",
  });
});

describe("POST /api/payments/[bookingId]/ecpay/create-order", () => {
  it("returns 201 + { html, merchantTradeNo, amount } on success", async () => {
    createOrder.mockResolvedValue({
      html: "<form>...</form>",
      merchantTradeNo: "TS12345678ABCDEFGHI",
      amount: 500,
    });
    const res = await POST(req(), params);
    const body = await res.json();
    expect(res.status).toBe(201);
    expect(body.html).toBe("<form>...</form>");
    expect(body.merchantTradeNo).toBe("TS12345678ABCDEFGHI");
    expect(body.amount).toBe(500);
    expect(createOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        bookingId: "b1",
        tenantId: "t1",
        actor: { type: "liff", lineUserId: "Uabc" },
      })
    );
  });

  it("passes admin actor when caller is admin", async () => {
    requireBookingAuth.mockResolvedValue({
      type: "admin",
      adminId: "a1",
      tenantId: "t1",
    });
    createOrder.mockResolvedValue({
      html: "h",
      merchantTradeNo: "TSADMIN0000000000A1",
      amount: 800,
    });
    await POST(req(), params);
    expect(createOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: { type: "admin", adminId: "a1" },
      })
    );
  });

  it("401 when auth is missing", async () => {
    requireBookingAuth.mockRejectedValue(new UnauthorizedError());
    const res = await POST(req(), params);
    expect(res.status).toBe(401);
  });

  it("maps AppError to its statusCode", async () => {
    createOrder.mockRejectedValue(
      new AppError("本月綠界收款額度接近上限", 409, "MONTHLY_CAP_EXCEEDED")
    );
    const res = await POST(req(), params);
    const body = await res.json();
    expect(res.status).toBe(409);
    expect(body.code).toBe("MONTHLY_CAP_EXCEEDED");
  });

  it("maps ECPAY_DISABLED to 503", async () => {
    createOrder.mockRejectedValue(
      new AppError("金流服務暫時關閉", 503, "ECPAY_DISABLED")
    );
    const res = await POST(req(), params);
    expect(res.status).toBe(503);
  });
});
