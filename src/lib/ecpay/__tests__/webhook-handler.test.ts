import { describe, it, expect } from "vitest";
import {
  parseEcpayWebhookFormData,
  verifyWebhookSignature,
  parseEcpayExpireDate,
} from "@/lib/ecpay/webhook-handler";
import { signParams, withEcpayEnv, TEST_MERCHANT, buildFormRequest } from "./helpers";

describe("parseEcpayWebhookFormData", () => {
  it("reads urlencoded body into plain object", async () => {
    const req = buildFormRequest("http://x/webhook", {
      MerchantID: "2000132",
      MerchantTradeNo: "TSABCDEF",
      TradeAmt: "500",
    });
    const out = await parseEcpayWebhookFormData(req);
    expect(out.MerchantTradeNo).toBe("TSABCDEF");
    expect(out.TradeAmt).toBe("500");
  });
});

describe("verifyWebhookSignature", () => {
  it("returns false when config missing (feature disabled)", () => {
    const prev = process.env.ECPAY_MERCHANT_ID;
    delete process.env.ECPAY_MERCHANT_ID;
    try {
      expect(verifyWebhookSignature({ CheckMacValue: "x" })).toBe(false);
    } finally {
      if (prev) process.env.ECPAY_MERCHANT_ID = prev;
    }
  });

  it("returns true for a correctly signed payload", async () => {
    await withEcpayEnv(() => {
      const signed = signParams({
        MerchantID: TEST_MERCHANT,
        MerchantTradeNo: "TSROUND1",
        TradeAmt: "500",
        RtnCode: "1",
      });
      expect(verifyWebhookSignature(signed)).toBe(true);
    });
  });

  it("returns false when a param is tampered after signing", async () => {
    await withEcpayEnv(() => {
      const signed = signParams({
        MerchantID: TEST_MERCHANT,
        MerchantTradeNo: "TSTAMPER1",
        TradeAmt: "500",
      });
      const tampered = { ...signed, TradeAmt: "50000" };
      expect(verifyWebhookSignature(tampered)).toBe(false);
    });
  });

  it("returns false when CheckMacValue missing", async () => {
    await withEcpayEnv(() => {
      expect(verifyWebhookSignature({ MerchantID: TEST_MERCHANT })).toBe(false);
    });
  });
});

describe("parseEcpayExpireDate", () => {
  it("parses yyyy/MM/dd to end-of-day Taipei (UTC 15:59:59)", () => {
    const d = parseEcpayExpireDate("2026/04/20");
    expect(d).not.toBeNull();
    expect(d!.getUTCFullYear()).toBe(2026);
    expect(d!.getUTCMonth()).toBe(3);
    expect(d!.getUTCDate()).toBe(20);
    expect(d!.getUTCHours()).toBe(15);
    expect(d!.getUTCMinutes()).toBe(59);
  });

  it("returns null on bad input", () => {
    expect(parseEcpayExpireDate("")).toBeNull();
    expect(parseEcpayExpireDate(undefined)).toBeNull();
    expect(parseEcpayExpireDate("2026-04-20")).toBeNull();
    expect(parseEcpayExpireDate("garbage")).toBeNull();
  });
});
