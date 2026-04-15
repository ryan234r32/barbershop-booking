import { describe, it, expect, beforeEach, vi } from "vitest";

// In-memory fake redis — enough surface to satisfy @upstash/lock's SET NX PX.
const store = new Map<string, string>();
const fakeRedis = {
  set: vi.fn(async (key: string, value: string, opts?: { nx?: boolean; px?: number }) => {
    if (opts?.nx && store.has(key)) return null;
    store.set(key, value);
    return "OK";
  }),
  eval: vi.fn(async (_script: string, keys: string[], args: string[]) => {
    // Release script: delete only if value matches.
    const [key] = keys;
    const [value] = args;
    if (store.get(key) === value) {
      store.delete(key);
      return 1;
    }
    return 0;
  }),
};

vi.mock("@/lib/redis", () => ({ getRedis: () => fakeRedis }));

import { acquireEcpayCreateLock, releaseEcpayCreateLock } from "@/lib/ecpay/locks";

beforeEach(() => {
  store.clear();
  vi.clearAllMocks();
});

describe("ecpay locks", () => {
  it("acquires when key is free", async () => {
    const lock = await acquireEcpayCreateLock("b1");
    expect(lock).not.toBeNull();
  });

  it("second acquire returns null while held", async () => {
    const first = await acquireEcpayCreateLock("b1");
    expect(first).not.toBeNull();
    const second = await acquireEcpayCreateLock("b1");
    expect(second).toBeNull();
  });

  it("release frees the key so next acquire succeeds", async () => {
    const first = await acquireEcpayCreateLock("b1");
    expect(first).not.toBeNull();
    await releaseEcpayCreateLock(first!);
    const second = await acquireEcpayCreateLock("b1");
    expect(second).not.toBeNull();
  });

  it("release swallows errors", async () => {
    const lock = await acquireEcpayCreateLock("b1");
    expect(lock).not.toBeNull();
    // Force release to throw by stubbing eval to reject once.
    fakeRedis.eval.mockRejectedValueOnce(new Error("network"));
    await expect(releaseEcpayCreateLock(lock!)).resolves.toBeUndefined();
  });
});
