import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

const aggregate = vi.fn();
const count = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    eCPayOrder: {
      aggregate: (...a: unknown[]) => aggregate(...a),
      count: (...a: unknown[]) => count(...a),
    },
  },
}));

const getAdminFromCookie = vi.fn();
vi.mock("@/lib/auth/jwt", () => ({
  getAdminFromCookie: (...a: unknown[]) => getAdminFromCookie(...a),
}));

import { GET } from "@/app/api/admin/ecpay/monthly-summary/route";

const ADMIN_A = { adminId: "a1", tenantId: "tenantA", role: "OWNER" };
const req = () =>
  new NextRequest(new URL("http://x/api/admin/ecpay/monthly-summary"));

beforeEach(() => {
  vi.clearAllMocks();
  getAdminFromCookie.mockResolvedValue(ADMIN_A);
  aggregate.mockResolvedValue({ _sum: { amount: 0 } });
  count.mockResolvedValue(0);
});

describe("GET /api/admin/ecpay/monthly-summary", () => {
  it("unauthenticated → 401", async () => {
    getAdminFromCookie.mockResolvedValue(null);
    const res = await GET(req());
    expect(res.status).toBe(401);
  });

  it("tenant-isolated: count scoped to admin tenantId", async () => {
    await GET(req());
    expect(count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: "tenantA",
          status: "PAID",
        }),
      })
    );
  });

  it("returns { count, total, cap, percentage }", async () => {
    aggregate.mockResolvedValue({ _sum: { amount: 140_000 } });
    count.mockResolvedValue(12);
    const res = await GET(req());
    const body = await res.json();
    expect(body).toEqual({
      count: 12,
      total: 140_000,
      cap: 280_000,
      percentage: 50,
    });
  });

  it("percentage rounds to int", async () => {
    aggregate.mockResolvedValue({ _sum: { amount: 140_001 } });
    const res = await GET(req());
    const body = await res.json();
    expect(body.percentage).toBe(50);
  });

  it("percentage caps at 999 to avoid absurd display", async () => {
    aggregate.mockResolvedValue({ _sum: { amount: 999_999_999 } });
    const res = await GET(req());
    const body = await res.json();
    expect(body.percentage).toBeLessThanOrEqual(999);
  });

  it("null _sum.amount treated as 0", async () => {
    aggregate.mockResolvedValue({ _sum: { amount: null } });
    const res = await GET(req());
    const body = await res.json();
    expect(body.total).toBe(0);
    expect(body.percentage).toBe(0);
  });
});
