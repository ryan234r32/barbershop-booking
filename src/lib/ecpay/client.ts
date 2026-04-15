/**
 * Thin wrapper around ecpay_aio_nodejs SDK for ATM virtual account flow.
 *
 * Why a wrapper:
 * - SDK is plain JS with no types → we localize the `any` boundary here
 * - PR1 intentionally does NOT expose create-order to API routes yet (that's PR2)
 * - Webhook signature verification reuses the SDK helper (never hand-roll — see
 *   Eng review F9: handwritten CheckMacValue has locale-dependent sort bugs)
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const ECPayPayment = require("ecpay_aio_nodejs");
import type { ECPayAppConfig } from "./config";

export interface AtmCheckoutInput {
  merchantTradeNo: string;
  merchantTradeDate: string;
  totalAmount: number;
  tradeDesc: string;
  itemName: string;
  /** Virtual account expiration in days (1-60). */
  expireDays: number;
}

export interface EcpaySDK {
  // The SDK returns a ready-to-submit HTML form. The browser posts it to ECPay,
  // which then responds with the virtual account page + fires PaymentInfoURL.
  buildAtmCheckoutHtml(input: AtmCheckoutInput): string;
  verifyCheckMacValue(params: Record<string, string>): boolean;
}

/**
 * Create a bound ECPay SDK instance from config.
 *
 * Each instance holds MerchantID + HashKey + HashIV. Never log the returned
 * object — it contains secrets in closed-over state.
 */
export function createEcpaySdk(cfg: ECPayAppConfig): EcpaySDK {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client: any = new ECPayPayment(cfg.sdk);

  return {
    buildAtmCheckoutHtml(input: AtmCheckoutInput): string {
      const params = {
        MerchantTradeNo: input.merchantTradeNo,
        MerchantTradeDate: input.merchantTradeDate,
        TotalAmount: String(input.totalAmount),
        TradeDesc: input.tradeDesc,
        ItemName: input.itemName,
        ReturnURL: cfg.returnUrl,
      };

      // aio_check_out_atm signature:
      //   (parameters, url_return_payinfo, exp_period, client_redirect, invoice)
      return client.payment_client.aio_check_out_atm(
        params,
        cfg.paymentInfoUrl,
        String(input.expireDays),
        cfg.clientRedirectUrl,
        {},
      );
    },

    verifyCheckMacValue(params: Record<string, string>): boolean {
      // SDK helper: rebuilds the mac from params (excluding CheckMacValue itself)
      // and compares. Handles the ECPay-specific urlencode table + case rules
      // that are notoriously easy to get wrong by hand (Eng review F9).
      const supplied = params.CheckMacValue;
      if (!supplied || typeof supplied !== "string") return false;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const helper = (client.payment_client as any).helper;
      const stripped: Record<string, string> = {};
      for (const [k, v] of Object.entries(params)) {
        if (k !== "CheckMacValue") stripped[k] = v;
      }
      const recomputed: string = helper.gen_chk_mac_value(stripped);
      return recomputed === supplied;
    },
  };
}
