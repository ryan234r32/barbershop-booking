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

/**
 * Span lock — acquires one lock per hour the booking will occupy
 * (codex challenge P0 fix). Prevents two multi-slot bookings from being
 * placed at overlapping spans (e.g. A drags 2-slot booking to 12:00 and
 * B drags 2-slot booking to 13:00 — they share hour 13 but the old
 * single-startTime lock missed it).
 *
 * Failure semantics: if any hour can't be locked, all already-acquired
 * locks are released and we return null.
 */
export async function acquireBookingSpanLock(params: {
  tenantId: string;
  date: string;
  startTime: string;
  slotsNeeded: number;
}): Promise<Lock[] | null> {
  const startHour = parseInt(params.startTime.slice(0, 2), 10);
  const acquired: Lock[] = [];
  for (let h = startHour; h < startHour + params.slotsNeeded; h++) {
    const hourStr = `${String(h).padStart(2, "0")}:00`;
    const lock = await acquireBookingLock({
      tenantId: params.tenantId,
      date: params.date,
      startTime: hourStr,
    });
    if (!lock) {
      // Roll back — release whatever we did get, in reverse order
      for (let i = acquired.length - 1; i >= 0; i--) {
        await releaseBookingLock(acquired[i]);
      }
      return null;
    }
    acquired.push(lock);
  }
  return acquired;
}

/** Release all locks acquired by acquireBookingSpanLock, in reverse order. */
export async function releaseBookingSpanLock(locks: Lock[]): Promise<void> {
  for (let i = locks.length - 1; i >= 0; i--) {
    await releaseBookingLock(locks[i]);
  }
}
