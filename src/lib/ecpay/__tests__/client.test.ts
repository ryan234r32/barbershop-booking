import { describe, it, expect } from "vitest";
import { createEcpaySdk } from "@/lib/ecpay/client";
import type { ECPayAppConfig } from "@/lib/ecpay/config";

/**
 * Test config uses ECPay's official public sandbox credentials:
 *   MerchantID: 2000132, HashKey: 5294y06JbISpM5x9, HashIV: v77hoKGq4kWxNNIS
 * These are documented at https://developers.ecpay.com.tw — safe to commit.
 */
const testConfig: ECPayAppConfig = {
  sdk: {
    OperationMode: "Test",
    MercProfile: {
      MerchantID: "2000132",
      HashKey: "5294y06JbISpM5x9",
      HashIV: "v77hoKGq4kWxNNIS",
    },
    IgnorePayment: [],
    IsProjectContractor: false,
  },
  returnUrl: "https://example.com/api/webhooks/ecpay/return",
  paymentInfoUrl: "https://example.com/api/webhooks/ecpay/payment-info",
  clientRedirectUrl: "https://example.com/payment/result",
  enabled: true,
};

describe("buildAtmCheckoutHtml", () => {
  const sdk = createEcpaySdk(testConfig);

  it("returns an HTML form with auto-submit script", () => {
    const html = sdk.buildAtmCheckoutHtml({
      merchantTradeNo: "TS12345678ABCDEFGHI",
      merchantTradeDate: "2026/04/15 14:30:00",
      totalAmount: 500,
      tradeDesc: "剪髮服務",
      itemName: "剪髮",
      expireDays: 1,
    });
    expect(html).toContain("<form");
    expect(html).toContain("CheckMacValue");
    expect(html).toContain("TS12345678ABCDEFGHI");
    expect(html).toContain("500");
  });

  it("submits to the stage endpoint in Test mode", () => {
    const html = sdk.buildAtmCheckoutHtml({
      merchantTradeNo: "TSTEST0000000000001",
      merchantTradeDate: "2026/04/15 14:30:00",
      totalAmount: 100,
      tradeDesc: "test",
      itemName: "test",
      expireDays: 1,
    });
    expect(html).toContain("payment-stage.ecpay.com.tw");
  });

  it("handles Chinese characters in itemName without crashing", () => {
    const html = sdk.buildAtmCheckoutHtml({
      merchantTradeNo: "TSTEST0000000000002",
      merchantTradeDate: "2026/04/15 14:30:00",
      totalAmount: 2000,
      tradeDesc: "染髮",
      itemName: "染髮＋護髮",
      expireDays: 1,
    });
    expect(html).toContain("<form");
    expect(html.length).toBeGreaterThan(100);
  });
});

describe("verifyCheckMacValue", () => {
  const sdk = createEcpaySdk(testConfig);

  it("round-trips: params that produce a valid CheckMacValue verify true", () => {
    // Build a form; the generated HTML contains the correct CheckMacValue for
    // these params. We don't parse the HTML — instead we rely on the SDK's
    // internal helper to recompute using the same inputs.
    const params: Record<string, string> = {
      MerchantID: "2000132",
      MerchantTradeNo: "TSTESTROUNDTRIP001",
      MerchantTradeDate: "2026/04/15 14:30:00",
      PaymentType: "aio",
      TotalAmount: "500",
      TradeDesc: "test",
      ItemName: "test-item",
      ReturnURL: "https://example.com/api/webhooks/ecpay/return",
      ChoosePayment: "ATM",
      EncryptType: "1",
    };
    // Compute mac using the private helper (same one webhook will use).
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ECPayPayment = require("ecpay_aio_nodejs");
    const helper = (new ECPayPayment(testConfig.sdk) as { payment_client: { helper: { gen_chk_mac_value: (p: Record<string, string>) => string } } }).payment_client.helper;
    const mac: string = helper.gen_chk_mac_value(params);

    const withMac = { ...params, CheckMacValue: mac };
    expect(sdk.verifyCheckMacValue(withMac)).toBe(true);
  });

  it("rejects tampered params", () => {
    const params: Record<string, string> = {
      MerchantID: "2000132",
      MerchantTradeNo: "TSTAMPER0000000001",
      TotalAmount: "500",
      CheckMacValue: "0000000000000000000000000000000000000000000000000000000000000000",
    };
    expect(sdk.verifyCheckMacValue(params)).toBe(false);
  });

  it("rejects missing CheckMacValue", () => {
    expect(sdk.verifyCheckMacValue({ MerchantID: "2000132" })).toBe(false);
  });

  it("detects amount tampering (simulating replay with different amount)", () => {
    const params: Record<string, string> = {
      MerchantID: "2000132",
      MerchantTradeNo: "TSTAMPER0000000002",
      TotalAmount: "500",
      TradeDesc: "test",
      ItemName: "test",
      PaymentType: "aio",
      ReturnURL: "https://example.com/api/webhooks/ecpay/return",
      ChoosePayment: "ATM",
      EncryptType: "1",
      MerchantTradeDate: "2026/04/15 14:30:00",
    };
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ECPayPayment = require("ecpay_aio_nodejs");
    const helper = (new ECPayPayment(testConfig.sdk) as { payment_client: { helper: { gen_chk_mac_value: (p: Record<string, string>) => string } } }).payment_client.helper;
    const mac: string = helper.gen_chk_mac_value(params);

    // Attacker changes amount after signing
    const tampered = { ...params, TotalAmount: "50000", CheckMacValue: mac };
    expect(sdk.verifyCheckMacValue(tampered)).toBe(false);
  });
});
