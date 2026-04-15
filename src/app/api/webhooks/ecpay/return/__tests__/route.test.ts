import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const orderFindUnique = vi.fn();
const orderUpdate = vi.fn();
const paymentUpdate = vi.fn();
const notificationCreate = vi.fn();

// $transaction receives either (fn) or (array). Emulate both.
const mockTx = {
  eCPayOrder: { update: (...a: unknown[]) => orderUpdate(...a) },
  payment: { update: (...a: unknown[]) => paymentUpdate(...a) },
  notification: { create: (...a: unknown[]) => notificationCreate(...a) },
};

vi.mock("@/lib/prisma", () => ({
  prisma: {
    eCPayOrder: {
      findUnique: (...a: unknown[]) => orderFindUnique(...a),
      update: (...a: unknown[]) => orderUpdate(...a),
    },
    payment: { update: (...a: unknown[]) => paymentUpdate(...a) },
    notification: { create: (...a: unknown[]) => notificationCreate(...a) },
    $transaction: async (arg: unknown) => {
      if (typeof arg === "function") {
        return (arg as (tx: typeof mockTx) => Promise<unknown>)(mockTx);
      }
      return Promise.all(arg as Promise<unknown>[]);
    },
  },
}));

import { POST } from "@/app/api/webhooks/ecpay/return/route";
import { signParams, withEcpayEnv, TEST_MERCHANT, buildFormRequest } from "@/lib/ecpay/__tests__/helpers";

const MTN = "TS12345678ABCDEFGHI1";

function signedReturn(overrides: Record<string, string> = {}) {
  return signParams({
    MerchantID: TEST_MERCHANT,
    MerchantTradeNo: MTN,
    TradeNo: "EC99999",
    RtnCode: "1",
    RtnMsg: "Succeeded",
    TradeAmt: "500",
    PaymentType: "ATM_TAISHIN",
    ...overrides,
  });
}

const baseOrder = () => ({
  id: "o1",
  tenantId: "t1",
  paymentId: "p1",
  bookingId: "b1",
  merchantTradeNo: MTN,
  amount: 500,
  status: "PENDING",
  booking: {
    id: "b1",
    user: { lineUserId: "Ucustomer", displayName: "小明" },
    service: { name: "剪髮", price: 500 },
  },
});

const prevAdmin = process.env.ADMIN_LINE_USER_ID;
beforeEach(() => {
  vi.clearAllMocks();
  orderUpdate.mockResolvedValue({});
  paymentUpdate.mockResolvedValue({});
  notificationCreate.mockResolvedValue({});
  process.env.ADMIN_LINE_USER_ID = "Uadmin";
});
afterEach(() => {
  if (prevAdmin === undefined) delete process.env.ADMIN_LINE_USER_ID;
  else process.env.ADMIN_LINE_USER_ID = prevAdmin;
});

describe("POST /api/webhooks/ecpay/return", () => {
  it("signature fail → 0|CheckMacValueError", async () => {
    await withEcpayEnv(async () => {
      const body = signedReturn();
      const tampered = { ...body, TradeAmt: "9999" };
      const res = await POST(
        buildFormRequest("http://x/api/webhooks/ecpay/return", tampered)
      );
      expect(await res.text()).toBe("0|CheckMacValueError");
      expect(orderFindUnique).not.toHaveBeenCalled();
    });
  });

  it("order not found → 0|NotFound", async () => {
    await withEcpayEnv(async () => {
      orderFindUnique.mockResolvedValue(null);
      const res = await POST(
        buildFormRequest("http://x/api/webhooks/ecpay/return", signedReturn())
      );
      expect(await res.text()).toBe("0|NotFound");
    });
  });

  it("amount mismatch → does NOT mark PAID + creates admin alert + returns 1|OK", async () => {
    await withEcpayEnv(async () => {
      orderFindUnique.mockResolvedValue({ ...baseOrder(), amount: 500 });
      const res = await POST(
        buildFormRequest(
          "http://x/api/webhooks/ecpay/return",
          signedReturn({ TradeAmt: "300" })
        )
      );
      expect(await res.text()).toBe("1|OK");
      expect(orderUpdate).not.toHaveBeenCalled();
      expect(paymentUpdate).not.toHaveBeenCalled();
      expect(notificationCreate).toHaveBeenCalledTimes(1);
      const call = notificationCreate.mock.calls[0][0];
      expect(call.data.messagePayload.kind).toBe("ecpay_amount_mismatch");
      expect(call.data.messagePayload.expected).toBe(500);
      expect(call.data.messagePayload.actual).toBe(300);
      expect(call.data.lineUserId).toBe("Uadmin");
    });
  });

  it("happy path: RtnCode=1 + amount matches → PAID + RECEIVED + 2 notifications", async () => {
    await withEcpayEnv(async () => {
      orderFindUnique.mockResolvedValue(baseOrder());
      const res = await POST(
        buildFormRequest("http://x/api/webhooks/ecpay/return", signedReturn())
      );
      expect(await res.text()).toBe("1|OK");
      expect(orderUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "o1" },
          data: expect.objectContaining({ status: "PAID", tradeNo: "EC99999" }),
        })
      );
      expect(paymentUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "p1" },
          data: expect.objectContaining({ status: "RECEIVED", receivedAt: expect.any(Date) }),
        })
      );
      expect(notificationCreate).toHaveBeenCalledTimes(2);
      const kinds = notificationCreate.mock.calls.map(
        (c: unknown[]) => (c[0] as { data: { messagePayload: { kind: string } } }).data.messagePayload.kind
      );
      expect(kinds).toContain("ecpay_received");
      expect(kinds).toContain("ecpay_admin_notify");
    });
  });

  it("RtnCode != 1 → no state change, returns 1|OK", async () => {
    await withEcpayEnv(async () => {
      orderFindUnique.mockResolvedValue(baseOrder());
      const res = await POST(
        buildFormRequest(
          "http://x/api/webhooks/ecpay/return",
          signedReturn({ RtnCode: "0", RtnMsg: "Failure" })
        )
      );
      expect(await res.text()).toBe("1|OK");
      expect(orderUpdate).not.toHaveBeenCalled();
      expect(paymentUpdate).not.toHaveBeenCalled();
      expect(notificationCreate).not.toHaveBeenCalled();
    });
  });

  it("duplicate webhook (status=PAID) → idempotent, no duplicate notifications", async () => {
    await withEcpayEnv(async () => {
      orderFindUnique.mockResolvedValue({ ...baseOrder(), status: "PAID" });
      const res = await POST(
        buildFormRequest("http://x/api/webhooks/ecpay/return", signedReturn())
      );
      expect(await res.text()).toBe("1|OK");
      expect(orderUpdate).not.toHaveBeenCalled();
      expect(paymentUpdate).not.toHaveBeenCalled();
      expect(notificationCreate).not.toHaveBeenCalled();
    });
  });

  it("skips customer notification for manual-* lineUserId (admin-created bookings)", async () => {
    await withEcpayEnv(async () => {
      const order = baseOrder();
      order.booking.user.lineUserId = "manual-a1-xxx";
      orderFindUnique.mockResolvedValue(order);
      const res = await POST(
        buildFormRequest("http://x/api/webhooks/ecpay/return", signedReturn())
      );
      expect(await res.text()).toBe("1|OK");
      // Only admin notification, not customer
      expect(notificationCreate).toHaveBeenCalledTimes(1);
      const kinds = notificationCreate.mock.calls.map(
        (c: unknown[]) => (c[0] as { data: { messagePayload: { kind: string } } }).data.messagePayload.kind
      );
      expect(kinds).toEqual(["ecpay_admin_notify"]);
    });
  });
});
