import { Lock } from "@upstash/lock";
import { getRedis } from "@/lib/redis";
import { ECPAY_CREATE_LOCK_TTL_MS } from "@/lib/utils/constants";

/**
 * Acquire a distributed lock for ECPay create-order flow.
 * Key format: ecpay:create:{bookingId}
 *
 * Prevents two concurrent create-order calls for the same booking from each
 * generating an ECPayOrder (which would race on the DB and leak orphan virtual
 * accounts that the customer never sees).
 */
export async function acquireEcpayCreateLock(bookingId: string): Promise<Lock | null> {
  const lock = new Lock({
    id: `ecpay:create:${bookingId}`,
    lease: ECPAY_CREATE_LOCK_TTL_MS,
    redis: getRedis(),
  });

  const acquired = await lock.acquire();
  return acquired ? lock : null;
}

/**
 * Release a previously acquired ECPay create-order lock.
 * Swallows errors — the lease will expire naturally.
 */
export async function releaseEcpayCreateLock(lock: Lock): Promise<void> {
  try {
    await lock.release();
  } catch {
    // Lock may have already expired — that's OK
  }
}
