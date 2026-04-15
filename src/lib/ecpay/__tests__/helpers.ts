/**
 * Shared test fixtures for ECPay webhook tests. Uses the public sandbox
 * credentials documented at https://developers.ecpay.com.tw — safe to commit.
 */

export const TEST_MERCHANT = "2000132";
export const TEST_HASH_KEY = "5294y06JbISpM5x9";
export const TEST_HASH_IV = "v77hoKGq4kWxNNIS";

/** Compute a real CheckMacValue for the given params via the SDK. */
export function signParams(raw: Record<string, string>): Record<string, string> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const ECPayPayment = require("ecpay_aio_nodejs");
  const helper = (new ECPayPayment({
    OperationMode: "Test",
    MercProfile: {
      MerchantID: TEST_MERCHANT,
      HashKey: TEST_HASH_KEY,
      HashIV: TEST_HASH_IV,
    },
    IgnorePayment: [],
    IsProjectContractor: false,
  }) as {
    payment_client: {
      helper: { gen_chk_mac_value: (p: Record<string, string>) => string };
    };
  }).payment_client.helper;
  const mac = helper.gen_chk_mac_value(raw);
  return { ...raw, CheckMacValue: mac };
}

const ECPAY_ENV_KEYS = [
  "ECPAY_ENABLED",
  "ECPAY_MERCHANT_ID",
  "ECPAY_HASH_KEY",
  "ECPAY_HASH_IV",
  "ECPAY_ENDPOINT",
  "ECPAY_RETURN_URL",
  "ECPAY_PAYMENT_INFO_URL",
  "ECPAY_CLIENT_REDIRECT_URL",
] as const;

function installEcpayEnv(): Record<string, string | undefined> {
  const prev: Record<string, string | undefined> = {};
  for (const k of ECPAY_ENV_KEYS) prev[k] = process.env[k];
  process.env.ECPAY_ENABLED = "true";
  process.env.ECPAY_MERCHANT_ID = TEST_MERCHANT;
  process.env.ECPAY_HASH_KEY = TEST_HASH_KEY;
  process.env.ECPAY_HASH_IV = TEST_HASH_IV;
  process.env.ECPAY_ENDPOINT = "https://payment-stage.ecpay.com.tw";
  process.env.ECPAY_RETURN_URL = "https://example.com/api/webhooks/ecpay/return";
  process.env.ECPAY_PAYMENT_INFO_URL = "https://example.com/api/webhooks/ecpay/payment-info";
  process.env.ECPAY_CLIENT_REDIRECT_URL = "https://example.com/payment/result";
  return prev;
}

function restoreEcpayEnv(prev: Record<string, string | undefined>): void {
  for (const k of ECPAY_ENV_KEYS) {
    if (prev[k] === undefined) delete (process.env as Record<string, string | undefined>)[k];
    else (process.env as Record<string, string>)[k] = prev[k]!;
  }
}

/**
 * Temporarily install ECPay env vars for the duration of the callback.
 * Awaits promise-returning callbacks so env is restored only after completion.
 */
export async function withEcpayEnv<T>(fn: () => T | Promise<T>): Promise<T> {
  const prev = installEcpayEnv();
  try {
    return await fn();
  } finally {
    restoreEcpayEnv(prev);
  }
}

/** Build a Request with urlencoded body for a webhook POST. */
export function buildFormRequest(url: string, params: Record<string, string>): Request {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params).toString(),
  });
}
