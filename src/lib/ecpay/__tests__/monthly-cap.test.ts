import { describe, it, expect, beforeEach, vi } from "vitest";

const aggregate = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: { eCPayOrder: { aggregate: (...a: unknown[]) => aggregate(...a) } },
}));

import {
  getMonthlyReceivedTotal,
  assertWithinMonthlyCap,
} from "@/lib/ecpay/monthly-cap";
import { ECPAY_MONTHLY_CAP_TWD } from "@/lib/utils/constants";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getMonthlyReceivedTotal", () => {
  it("sums PAID orders in current Taipei month", async () => {
    aggregate.mockResolvedValue({ _sum: { amount: 12345 } });
    const total = await getMonthlyReceivedTotal("t1", new Date("2026-04-15T10:00:00Z"));
    expect(total).toBe(12345);
    const call = aggregate.mock.calls[0][0];
    expect(call.where.tenantId).toBe("t1");
    expect(call.where.status).toBe("PAID");
    // Taipei April 2026 starts at 2026-03-31 16:00:00 UTC.
    expect(call.where.createdAt.gte.toISOString()).toBe("2026-03-31T16:00:00.000Z");
    expect(call.where.createdAt.lt.toISOString()).toBe("2026-04-30T16:00:00.000Z");
  });

  it("treats missing sum (no rows) as 0", async () => {
    aggregate.mockResolvedValue({ _sum: { amount: null } });
    const total = await getMonthlyReceivedTotal("t1", new Date("2026-04-15T10:00:00Z"));
    expect(total).toBe(0);
  });

  it("rolls over December to next year", async () => {
    aggregate.mockResolvedValue({ _sum: { amount: 0 } });
    await getMonthlyReceivedTotal("t1", new Date("2026-12-20T00:00:00Z"));
    const call = aggregate.mock.calls[0][0];
    expect(call.where.createdAt.gte.toISOString()).toBe("2026-11-30T16:00:00.000Z");
    expect(call.where.createdAt.lt.toISOString()).toBe("2026-12-31T16:00:00.000Z");
  });
});

describe("assertWithinMonthlyCap", () => {
  it("passes when total + next is under cap", async () => {
    aggregate.mockResolvedValue({ _sum: { amount: 100_000 } });
    await expect(assertWithinMonthlyCap("t1", 500)).resolves.toBeUndefined();
  });

  it("passes when total + next equals cap exactly", async () => {
    aggregate.mockResolvedValue({ _sum: { amount: ECPAY_MONTHLY_CAP_TWD - 500 } });
    await expect(assertWithinMonthlyCap("t1", 500)).resolves.toBeUndefined();
  });

  it("throws MONTHLY_CAP_EXCEEDED when 280k + 1 would overflow", async () => {
    aggregate.mockResolvedValue({ _sum: { amount: ECPAY_MONTHLY_CAP_TWD } });
    await expect(assertWithinMonthlyCap("t1", 1)).rejects.toMatchObject({
      code: "MONTHLY_CAP_EXCEEDED",
      statusCode: 409,
    });
  });
});
