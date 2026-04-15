import { describe, it, expect } from "vitest";
import { loadECPayConfig, isEcpayEnabled } from "@/lib/ecpay/config";

const REQUIRED_ENV = [
  "ECPAY_ENABLED",
  "ECPAY_MERCHANT_ID",
  "ECPAY_HASH_KEY",
  "ECPAY_HASH_IV",
  "ECPAY_ENDPOINT",
  "ECPAY_RETURN_URL",
  "ECPAY_PAYMENT_INFO_URL",
  "ECPAY_CLIENT_REDIRECT_URL",
] as const;

function withEnv(overrides: Partial<Record<(typeof REQUIRED_ENV)[number], string>>, fn: () => void) {
  const original: Record<string, string | undefined> = {};
  for (const k of REQUIRED_ENV) original[k] = process.env[k];
  try {
    // Clear all first
    for (const k of REQUIRED_ENV) delete process.env[k];
    // Apply overrides
    for (const [k, v] of Object.entries(overrides)) {
      if (v !== undefined) process.env[k] = v;
    }
    fn();
  } finally {
    // Restore
    for (const k of REQUIRED_ENV) {
      if (original[k] === undefined) delete process.env[k];
      else process.env[k] = original[k];
    }
  }
}

const validEnv = {
  ECPAY_MERCHANT_ID: "2000132",
  ECPAY_HASH_KEY: "5294y06JbISpM5x9",
  ECPAY_HASH_IV: "v77hoKGq4kWxNNIS",
  ECPAY_ENDPOINT: "https://payment-stage.ecpay.com.tw",
  ECPAY_RETURN_URL: "https://example.com/api/webhooks/ecpay/return",
  ECPAY_PAYMENT_INFO_URL: "https://example.com/api/webhooks/ecpay/payment-info",
  ECPAY_CLIENT_REDIRECT_URL: "https://example.com/payment/result",
};

describe("loadECPayConfig", () => {
  it("returns a valid config when all env vars are set", () => {
    withEnv(validEnv, () => {
      const cfg = loadECPayConfig();
      expect(cfg).not.toBeNull();
      expect(cfg!.enabled).toBe(true);
      expect(cfg!.sdk.MercProfile.MerchantID).toBe("2000132");
      expect(cfg!.sdk.OperationMode).toBe("Test");
    });
  });

  it("detects Production mode from non-stage endpoint", () => {
    withEnv(
      { ...validEnv, ECPAY_ENDPOINT: "https://payment.ecpay.com.tw" },
      () => {
        const cfg = loadECPayConfig();
        expect(cfg!.sdk.OperationMode).toBe("Production");
      },
    );
  });

  it("returns null when ECPAY_ENABLED is explicitly 'false'", () => {
    withEnv({ ...validEnv, ECPAY_ENABLED: "false" }, () => {
      expect(loadECPayConfig()).toBeNull();
    });
  });

  it.each([
    "ECPAY_MERCHANT_ID",
    "ECPAY_HASH_KEY",
    "ECPAY_HASH_IV",
    "ECPAY_RETURN_URL",
    "ECPAY_PAYMENT_INFO_URL",
    "ECPAY_CLIENT_REDIRECT_URL",
  ] as const)("returns null when %s is missing", (missing) => {
    const partial = { ...validEnv } as Record<string, string>;
    delete partial[missing];
    withEnv(partial, () => {
      expect(loadECPayConfig()).toBeNull();
    });
  });
});

describe("isEcpayEnabled", () => {
  it("returns true iff config is loadable", () => {
    withEnv(validEnv, () => {
      expect(isEcpayEnabled()).toBe(true);
    });
    withEnv({}, () => {
      expect(isEcpayEnabled()).toBe(false);
    });
  });
});
