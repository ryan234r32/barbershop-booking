import { Lock } from "@upstash/lock";
import { getRedis } from "@/lib/redis";
import { BOOKING_LOCK_TTL_MS } from "@/lib/utils/constants";

/**
 * Acquire a distributed lock for a specific booking slot.
 * Key format: booking:{tenantId}:{date}:{startTime}
 */
export async function acquireBookingLock(params: {
  tenantId: string;
  date: string;
  startTime: string;
}): Promise<Lock | null> {
  const { tenantId, date, startTime } = params;
  const lockId = `booking:${tenantId}:${date}:${startTime}`;

  const lock = new Lock({
    id: lockId,
    lease: BOOKING_LOCK_TTL_MS,
    redis: getRedis(),
  });

  const acquired = await lock.acquire();
  return acquired ? lock : null;
}

/**
 * Release a previously acquired lock.
 */
export async function releaseBookingLock(lock: Lock): Promise<void> {
  try {
    await lock.release();
  } catch {
    // Lock may have expired — that's OK
  }
}
