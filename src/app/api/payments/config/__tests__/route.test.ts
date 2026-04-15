import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/payments/config/route";
import { signAdminToken } from "@/lib/auth/jwt";

const BASE_ENV = {
  ECPAY_MERCHANT_ID: "2000132",
  ECPAY_HASH_KEY: "5294y06JbISpM5x9",
  ECPAY_HASH_IV: "v77hoKGq4kWxNNIS",
  ECPAY_ENDPOINT: "https://payment-stage.ecpay.com.tw",
  ECPAY_RETURN_URL: "https://example.com/api/webhooks/ecpay/return",
  ECPAY_PAYMENT_INFO_URL: "https://example.com/api/webhooks/ecpay/payment-info",
  ECPAY_CLIENT_REDIRECT_URL: "https://example.com/payment/result",
};

const ALL_KEYS = [
  ...Object.keys(BASE_ENV),
  "ECPAY_ENABLED",
  "ECPAY_ALLOWED_USER_IDS",
] as const;

let saved: Record<string, string | undefined> = {};

beforeEach(() => {
  saved = {};
  for (const k of ALL_KEYS) saved[k] = process.env[k];
  for (const k of ALL_KEYS) delete process.env[k];
  Object.assign(process.env, BASE_ENV);
});

afterEach(() => {
  for (const k of ALL_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

function req(url: string, headers: Record<string, string> = {}) {
  return new NextRequest(url, { headers });
}

describe("GET /api/payments/config — feature flag endpoint", () => {
  it("returns ecpayEnabled=false when ECPAY_ENABLED is 'false'", async () => {
    process.env.ECPAY_ENABLED = "false";
    const res = await GET(req("http://localhost/api/payments/config"));
    expect(await res.json()).toEqual({ ecpayEnabled: false });
  });

  it("returns ecpayEnabled=false when required env vars missing", async () => {
    delete process.env.ECPAY_MERCHANT_ID;
    const res = await GET(req("http://localhost/api/payments/config"));
    expect(await res.json()).toEqual({ ecpayEnabled: false });
  });

  it("returns true for everyone when allowlist is unset (normal post-GA)", async () => {
    const res = await GET(
      req("http://localhost/api/payments/config?lineUserId=Urandom"),
    );
    expect(await res.json()).toEqual({ ecpayEnabled: true });
  });

  it("returns true for everyone when allowlist is empty string", async () => {
    process.env.ECPAY_ALLOWED_USER_IDS = "   ";
    const res = await GET(req("http://localhost/api/payments/config"));
    expect(await res.json()).toEqual({ ecpayEnabled: true });
  });

  it("returns true for allowlisted LINE user", async () => {
    process.env.ECPAY_ALLOWED_USER_IDS = "Uallowed,Ualso";
    const res = await GET(
      req("http://localhost/api/payments/config?lineUserId=Uallowed"),
    );
    expect(await res.json()).toEqual({ ecpayEnabled: true });
  });

  it("returns false for non-allowlisted LINE user", async () => {
    process.env.ECPAY_ALLOWED_USER_IDS = "Uallowed,Ualso";
    const res = await GET(
      req("http://localhost/api/payments/config?lineUserId=Ustranger"),
    );
    expect(await res.json()).toEqual({ ecpayEnabled: false });
  });

  it("returns false for missing lineUserId when allowlist set", async () => {
    process.env.ECPAY_ALLOWED_USER_IDS = "Uallowed";
    const res = await GET(req("http://localhost/api/payments/config"));
    expect(await res.json()).toEqual({ ecpayEnabled: false });
  });

  it("tolerates whitespace in allowlist entries", async () => {
    process.env.ECPAY_ALLOWED_USER_IDS = "  Uone ,  Utwo  ";
    const res = await GET(
      req("http://localhost/api/payments/config?lineUserId=Utwo"),
    );
    expect(await res.json()).toEqual({ ecpayEnabled: true });
  });

  it("admin JWT bypasses the allowlist (authenticated operator context)", async () => {
    process.env.JWT_SECRET = "test-jwt-secret";
    process.env.ECPAY_ALLOWED_USER_IDS = "Uallowed";
    const token = signAdminToken({
      adminId: "admin-1",
      tenantId: "tenant-1",
      role: "OWNER",
    });
    const res = await GET(
      req("http://localhost/api/payments/config", {
        Authorization: `Bearer ${token}`,
      }),
    );
    expect(await res.json()).toEqual({ ecpayEnabled: true });
  });
});
