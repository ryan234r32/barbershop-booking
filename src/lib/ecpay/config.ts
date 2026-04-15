/**
 * ECPay (綠界) configuration loader.
 *
 * Reads env vars and produces a typed config object for the ecpay_aio_nodejs SDK.
 * Sandbox vs Production is driven by ECPAY_ENDPOINT (the SDK accepts an
 * OperationMode of "Test" or "Production").
 *
 * Feature-flag guard: call isEcpayEnabled() at the API boundary before
 * attempting any ECPay operation. Missing env vars → feature disabled.
 */

export type ECPayOperationMode = "Test" | "Production";

export interface ECPaySDKConfig {
  OperationMode: ECPayOperationMode;
  MercProfile: {
    MerchantID: string;
    HashKey: string;
    HashIV: string;
  };
  IgnorePayment: string[];
  IsProjectContractor: boolean;
}

export interface ECPayAppConfig {
  sdk: ECPaySDKConfig;
  returnUrl: string;
  paymentInfoUrl: string;
  clientRedirectUrl: string;
  /**
   * Enabled iff all required env vars are set AND ECPAY_ENABLED !== "false".
   * When false, Tier S is completely off: UI hides the option, API returns 503.
   */
  enabled: boolean;
}

/**
 * Load ECPay config from process.env. Returns null if disabled or misconfigured.
 *
 * Never throws — callers get null and should surface a user-friendly error.
 */
export function loadECPayConfig(): ECPayAppConfig | null {
  const enabled = process.env.ECPAY_ENABLED !== "false";
  const merchantId = process.env.ECPAY_MERCHANT_ID;
  const hashKey = process.env.ECPAY_HASH_KEY;
  const hashIV = process.env.ECPAY_HASH_IV;
  const endpoint = process.env.ECPAY_ENDPOINT ?? "https://payment-stage.ecpay.com.tw";
  const returnUrl = process.env.ECPAY_RETURN_URL;
  const paymentInfoUrl = process.env.ECPAY_PAYMENT_INFO_URL;
  const clientRedirectUrl = process.env.ECPAY_CLIENT_REDIRECT_URL;

  if (!enabled || !merchantId || !hashKey || !hashIV || !returnUrl || !paymentInfoUrl || !clientRedirectUrl) {
    return null;
  }

  const mode: ECPayOperationMode = endpoint.includes("stage") ? "Test" : "Production";

  return {
    sdk: {
      OperationMode: mode,
      MercProfile: { MerchantID: merchantId, HashKey: hashKey, HashIV: hashIV },
      IgnorePayment: [],
      IsProjectContractor: false,
    },
    returnUrl,
    paymentInfoUrl,
    clientRedirectUrl,
    enabled: true,
  };
}

/**
 * Feature-flag check for API routes and UI. Returns true only when config
 * is fully loadable — acts as the single gate for Tier S activation.
 */
export function isEcpayEnabled(): boolean {
  return loadECPayConfig() !== null;
}
