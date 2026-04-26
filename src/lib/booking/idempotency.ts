/**
 * Idempotency-key cache for write endpoints (PRD-v3 E-5).
 *
 * Used by drag-reschedule on the calendar so a flaky network / accidental
 * double-tap can't create two reschedule operations. Caller passes a key
 * shaped `{bookingId}-{targetDate}-{targetStart}` — same key within the
 * TTL returns the cached response instead of re-executing.
 */

import { getRedis } from "@/lib/redis";

const NAMESPACE = "idempotency";
const DEFAULT_TTL_SECONDS = 60;

function key(scope: string, idempotencyKey: string): string {
  return `${NAMESPACE}:${scope}:${idempotencyKey}`;
}

/** Returns the previously stored result for this key, or null if none. */
export async function getIdempotentResult<T>(
  scope: string,
  idempotencyKey: string,
): Promise<T | null> {
  try {
    const raw = await getRedis().get<string>(key(scope, idempotencyKey));
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/** Stores the result for the given key with a short TTL. Best-effort. */
export async function storeIdempotentResult<T>(
  scope: string,
  idempotencyKey: string,
  value: T,
  ttlSeconds: number = DEFAULT_TTL_SECONDS,
): Promise<void> {
  try {
    await getRedis().set(key(scope, idempotencyKey), JSON.stringify(value), {
      ex: ttlSeconds,
    });
  } catch {
    // Idempotency is best-effort; don't fail the request if the cache write fails
  }
}
