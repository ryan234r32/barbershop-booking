/**
 * Login-specific brute-force throttle.
 *
 * The middleware's per-IP limiter allows 60 requests/min across ALL API
 * routes, which is fine for app usage but too permissive for /api/auth/login
 * specifically. A bcrypt compare takes ~100ms, so without this a single IP
 * could try ~86,400 admin passwords/day.
 *
 * Uses Redis so multiple Vercel Fluid Compute instances share state.
 * Per-IP sliding window: 10 login attempts per 15 min, then throttle with
 * exponential backoff up to 1 hour.
 */

import { getRedis } from "@/lib/redis";

const WINDOW_SECONDS = 15 * 60;
const MAX_ATTEMPTS = 10;
const LOCKOUT_MAX_SECONDS = 60 * 60;

type CheckResult = { allowed: true } | { allowed: false; retryAfterSec: number };

function keyFor(ip: string): string {
  return `login:attempts:${ip}`;
}
function lockoutKey(ip: string): string {
  return `login:lockout:${ip}`;
}

export async function checkLoginRateLimit(ip: string): Promise<CheckResult> {
  if (!ip || ip === "unknown") return { allowed: true };
  const redis = getRedis();

  const lockoutTtl = await redis.ttl(lockoutKey(ip));
  if (lockoutTtl > 0) {
    return { allowed: false, retryAfterSec: lockoutTtl };
  }

  const count = await redis.incr(keyFor(ip));
  if (count === 1) {
    await redis.expire(keyFor(ip), WINDOW_SECONDS);
  }

  if (count > MAX_ATTEMPTS) {
    // Exponential backoff: 2^(overflow) minutes, capped at 1h.
    const overflow = count - MAX_ATTEMPTS;
    const penaltySec = Math.min(2 ** overflow * 60, LOCKOUT_MAX_SECONDS);
    await redis.set(lockoutKey(ip), "1", { ex: penaltySec });
    return { allowed: false, retryAfterSec: penaltySec };
  }

  return { allowed: true };
}

/** Call on successful login so a legitimate user doesn't accumulate penalty. */
export async function clearLoginAttempts(ip: string): Promise<void> {
  if (!ip || ip === "unknown") return;
  const redis = getRedis();
  await redis.del(keyFor(ip), lockoutKey(ip));
}
