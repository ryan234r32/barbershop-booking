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

/**
 * Booking-level mutex (PRD-v3 E-6). Prevents two concurrent reschedules of
 * the SAME booking from racing each other (last-write-wins). The slot lock
 * (acquireBookingLock above) only guards the *target slot* — it does not
 * prevent two admins from dragging the same source booking to two different
 * targets at the same time.
 *
 * Key: booking:row:{bookingId}
 */
export async function acquireBookingRowLock(bookingId: string): Promise<Lock | null> {
  const lock = new Lock({
    id: `booking:row:${bookingId}`,
    lease: BOOKING_LOCK_TTL_MS,
    redis: getRedis(),
  });
  const acquired = await lock.acquire();
  return acquired ? lock : null;
}
