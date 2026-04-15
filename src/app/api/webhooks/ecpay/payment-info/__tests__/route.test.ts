import { describe, it, expect, beforeEach, vi } from "vitest";

const findUnique = vi.fn();
const update = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    eCPayOrder: {
      findUnique: (...a: unknown[]) => findUnique(...a),
      update: (...a: unknown[]) => update(...a),
    },
  },
}));

import { POST } from "@/app/api/webhooks/ecpay/payment-info/route";
import { signParams, withEcpayEnv, TEST_MERCHANT, buildFormRequest } from "@/lib/ecpay/__tests__/helpers";

const MTN = "TS12345678ABCDEFGHI0";

function signedPaymentInfoBody(overrides: Record<string, string> = {}) {
  return signParams({
    MerchantID: TEST_MERCHANT,
    MerchantTradeNo: MTN,
    TradeNo: "EC000001",
    RtnCode: "2", // ATM payment-info uses RtnCode=2
    RtnMsg: "Get VirtualAccount Succeeded",
    PaymentType: "ATM_TAISHIN",
    BankCode: "812",
    vAccount: "9991234567890123",
    ExpireDate: "2026/04/22",
    TradeAmt: "500",
    ...overrides,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  update.mockResolvedValue({});
});

describe("POST /api/webhooks/ecpay/payment-info", () => {
  it("signature fail → 0|CheckMacValueError", async () => {
    await withEcpayEnv(async () => {
      const body = signedPaymentInfoBody();
      const tampered = { ...body, TradeAmt: "9999" };
      const req = buildFormRequest("http://x/api/webhooks/ecpay/payment-info", tampered);
      const res = await POST(req);
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("text/plain");
      expect(await res.text()).toBe("0|CheckMacValueError");
      expect(findUnique).not.toHaveBeenCalled();
    });
  });

  it("order not found → 0|NotFound", async () => {
    await withEcpayEnv(async () => {
      findUnique.mockResolvedValue(null);
      const req = buildFormRequest(
        "http://x/api/webhooks/ecpay/payment-info",
        signedPaymentInfoBody()
      );
      const res = await POST(req);
      expect(await res.text()).toBe("0|NotFound");
      expect(update).not.toHaveBeenCalled();
    });
  });

  it("happy path → updates ECPayOrder with vAccount + returns 1|OK", async () => {
    await withEcpayEnv(async () => {
      findUnique.mockResolvedValue({
        id: "o1",
        merchantTradeNo: MTN,
        status: "CREATED",
        amount: 500,
      });
      const req = buildFormRequest(
        "http://x/api/webhooks/ecpay/payment-info",
        signedPaymentInfoBody()
      );
      const res = await POST(req);
      expect(await res.text()).toBe("1|OK");
      expect(update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "o1" },
          data: expect.objectContaining({
            bankCode: "812",
            vAccount: "9991234567890123",
            status: "PENDING",
            expireDate: expect.any(Date),
            rawPaymentInfo: expect.any(Object),
          }),
        })
      );
    });
  });

  it("already PAID → idempotent 1|OK, no update", async () => {
    await withEcpayEnv(async () => {
      findUnique.mockResolvedValue({
        id: "o1",
        merchantTradeNo: MTN,
        status: "PAID",
        amount: 500,
      });
      const req = buildFormRequest(
        "http://x/api/webhooks/ecpay/payment-info",
        signedPaymentInfoBody()
      );
      const res = await POST(req);
      expect(await res.text()).toBe("1|OK");
      expect(update).not.toHaveBeenCalled();
    });
  });

  it("already EXPIRED → idempotent 1|OK, no update", async () => {
    await withEcpayEnv(async () => {
      findUnique.mockResolvedValue({
        id: "o1",
        merchantTradeNo: MTN,
        status: "EXPIRED",
        amount: 500,
      });
      const req = buildFormRequest(
        "http://x/api/webhooks/ecpay/payment-info",
        signedPaymentInfoBody()
      );
      const res = await POST(req);
      expect(await res.text()).toBe("1|OK");
      expect(update).not.toHaveBeenCalled();
    });
  });
});
