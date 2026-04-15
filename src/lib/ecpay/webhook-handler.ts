/**
 * Shared helpers for ECPay webhook route handlers (PaymentInfoURL + ReturnURL).
 *
 * ECPay posts `application/x-www-form-urlencoded` bodies with a CheckMacValue
 * signature. All ACKs must be plain-text `1|OK` or `0|<reason>` — ECPay retries
 * on anything else (including JSON). See PR plan §16.4.
 */

import { loadECPayConfig } from "./config";
import { createEcpaySdk } from "./client";

/** Threshold (ms) past which a CREATED-but-not-PENDING order is considered stale. */
export const ECPAY_STALE_CREATED_THRESHOLD_MS = 5 * 60 * 1000;

export const ECPAY_ACK_SUCCESS = "1|OK";
export const ECPAY_ACK_SIGFAIL = "0|CheckMacValueError";
export const ECPAY_ACK_NOTFOUND = "0|NotFound";
/**
 * Amount-mismatch: we deliberately ACK success to STOP ECPay retrying.
 * The mismatch creates an admin-alert Notification so we can handle it manually.
 * (Retrying the same mismatched payload forever would flood logs + alerts.)
 */
export const ECPAY_ACK_AMOUNT_MISMATCH = "1|OK";

/** Parse ECPay's urlencoded body into a plain Record<string,string>. */
export async function parseEcpayWebhookFormData(
  request: Request
): Promise<Record<string, string>> {
  const form = await request.formData();
  const out: Record<string, string> = {};
  for (const [k, v] of form.entries()) {
    out[k] = typeof v === "string" ? v : String(v);
  }
  return out;
}

/**
 * Verify the CheckMacValue supplied by ECPay.
 * Returns false if config is missing (feature disabled) or sig doesn't match.
 * Never throws — callers translate false → `0|CheckMacValueError`.
 */
export function verifyWebhookSignature(params: Record<string, string>): boolean {
  const cfg = loadECPayConfig();
  if (!cfg) return false;
  try {
    const sdk = createEcpaySdk(cfg);
    return sdk.verifyCheckMacValue(params);
  } catch {
    return false;
  }
}

/**
 * Parse ECPay ExpireDate (`yyyy/MM/dd`) → JS Date at 23:59:59 Taipei that day.
 * Returns null if unparseable — caller should fall back to Date.now + expireDays.
 */
export function parseEcpayExpireDate(raw: string | undefined): Date | null {
  if (!raw) return null;
  const m = raw.match(/^(\d{4})\/(\d{2})\/(\d{2})$/);
  if (!m) return null;
  const [, y, mo, d] = m;
  // 23:59:59 Taipei = 15:59:59 UTC same day (UTC+8)
  return new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d), 15, 59, 59));
}

/** Plain-text response helper — ECPay requires text/plain, not JSON. */
export function plainTextAck(body: string): Response {
  return new Response(body, {
    status: 200,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
