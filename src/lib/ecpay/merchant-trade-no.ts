/**
 * MerchantTradeNo generator for ECPay.
 *
 * Constraints (per ECPay spec):
 * - ≤ 20 characters
 * - alphanumeric only (no hyphens / underscores)
 * - globally unique per MerchantID
 *
 * Format: TS + {bookingId prefix 8 chars, hex} + {timestamp base36 last 9 chars}
 * Total: 2 + 8 + 9 = 19 chars. Leaves 1 char safety margin.
 *
 * Collision resistance: bookingId is a UUID (high entropy in first 8 chars of hex).
 * Timestamp encoded in base36 gives us ~7-day rollover at 9 chars, good enough.
 */

const PREFIX = "TS";

/** Strip non-alphanumeric characters and uppercase. */
function sanitize(s: string): string {
  return s.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
}

export interface GenerateMerchantTradeNoInput {
  bookingId: string;
  /** Override for testing. Defaults to Date.now(). */
  now?: number;
}

export function generateMerchantTradeNo(input: GenerateMerchantTradeNoInput): string {
  const { bookingId, now = Date.now() } = input;

  const bookingPart = sanitize(bookingId).slice(0, 8).padEnd(8, "0");
  // base36 of millis: 9 chars holds values up to 101 trillion; Date.now() fits easily.
  const timestampPart = now.toString(36).toUpperCase().slice(-9).padStart(9, "0");

  const result = `${PREFIX}${bookingPart}${timestampPart}`;

  // Invariant check (defensive; should be unreachable with the math above)
  if (result.length > 20) {
    throw new Error(`MerchantTradeNo exceeds 20 chars: ${result}`);
  }
  if (!/^[A-Z0-9]+$/.test(result)) {
    throw new Error(`MerchantTradeNo contains invalid chars: ${result}`);
  }

  return result;
}

/**
 * Format a Date as ECPay's required MerchantTradeDate string:
 * "yyyy/MM/dd HH:mm:ss" in Asia/Taipei timezone.
 */
export function formatMerchantTradeDate(date: Date): string {
  // Intl-based formatter — avoids manual timezone math and DST landmines.
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  const y = get("year");
  const mo = get("month");
  const d = get("day");
  let h = get("hour");
  if (h === "24") h = "00"; // some locales render midnight as 24
  const mi = get("minute");
  const s = get("second");
  return `${y}/${mo}/${d} ${h}:${mi}:${s}`;
}
