import { describe, it, expect, beforeEach, vi } from "vitest";

const redis = {
  incr: vi.fn(),
  expire: vi.fn(),
  ttl: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
};
vi.mock("@/lib/redis", () => ({ getRedis: () => redis }));

import { checkLoginRateLimit, clearLoginAttempts } from "@/lib/auth/login-rate-limit";

beforeEach(() => {
  vi.clearAllMocks();
  redis.ttl.mockResolvedValue(-2);
});

describe("login rate limit", () => {
  it("allows first attempt, sets window TTL", async () => {
    redis.incr.mockResolvedValue(1);
    const res = await checkLoginRateLimit("1.2.3.4");
    expect(res).toEqual({ allowed: true });
    expect(redis.expire).toHaveBeenCalledWith("login:attempts:1.2.3.4", 15 * 60);
  });

  it("allows attempts 2–10 without setting expire again", async () => {
    redis.incr.mockResolvedValue(5);
    const res = await checkLoginRateLimit("1.2.3.4");
    expect(res).toEqual({ allowed: true });
    expect(redis.expire).not.toHaveBeenCalled();
  });

  it("blocks attempt 11 and sets exponential lockout", async () => {
    redis.incr.mockResolvedValue(11);
    const res = await checkLoginRateLimit("1.2.3.4");
    expect(res.allowed).toBe(false);
    if (!res.allowed) expect(res.retryAfterSec).toBe(2 * 60);
    expect(redis.set).toHaveBeenCalledWith("login:lockout:1.2.3.4", "1", { ex: 2 * 60 });
  });

  it("caps exponential lockout at 1 hour", async () => {
    redis.incr.mockResolvedValue(20);
    const res = await checkLoginRateLimit("1.2.3.4");
    expect(res.allowed).toBe(false);
    if (!res.allowed) expect(res.retryAfterSec).toBe(60 * 60);
  });

  it("short-circuits when lockout is active", async () => {
    redis.ttl.mockResolvedValue(300);
    const res = await checkLoginRateLimit("1.2.3.4");
    expect(res).toEqual({ allowed: false, retryAfterSec: 300 });
    expect(redis.incr).not.toHaveBeenCalled();
  });

  it("treats missing IP as allowed (no state pollution)", async () => {
    const res = await checkLoginRateLimit("unknown");
    expect(res).toEqual({ allowed: true });
    expect(redis.incr).not.toHaveBeenCalled();
  });

  it("clearLoginAttempts drops both keys on success", async () => {
    await clearLoginAttempts("1.2.3.4");
    expect(redis.del).toHaveBeenCalledWith("login:attempts:1.2.3.4", "login:lockout:1.2.3.4");
  });
});
