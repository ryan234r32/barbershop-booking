import { describe, it, expect, beforeEach, vi } from "vitest";

const $executeRaw = vi.fn();
const tenantFindMany = vi.fn();
const userUpdateMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $executeRaw: (...a: unknown[]) => $executeRaw(...a),
    tenant: {
      findMany: (...a: unknown[]) => tenantFindMany(...a),
    },
    user: {
      updateMany: (...a: unknown[]) => userUpdateMany(...a),
    },
  },
}));

import { recalculateSegments, resetExpiredViolations } from "@/lib/crm/segmentation";

beforeEach(() => {
  vi.clearAllMocks();
  $executeRaw.mockResolvedValue(0);
  tenantFindMany.mockResolvedValue([]);
  userUpdateMany.mockResolvedValue({ count: 0 });
});

describe("recalculateSegments — CTE single-pass (PRD-v3 §5 + E-10)", () => {
  it("calls $executeRaw exactly once per tenant (replaces 4-step updateMany chain)", async () => {
    await recalculateSegments("tenant-1");
    expect($executeRaw).toHaveBeenCalledTimes(1);
  });

  it("passes tenantId, atRiskDate, lapsedDate, window60d as raw SQL params", async () => {
    const before = Date.now();
    await recalculateSegments("tenant-x");
    const after = Date.now();

    expect($executeRaw).toHaveBeenCalledTimes(1);
    // $executeRaw template literal call signature: (TemplateStringsArray, ...values)
    const call = $executeRaw.mock.calls[0];
    const values = call.slice(1);

    // Plan A SQL parameter count (each `${}` is one param, even on value reuse):
    //   tenantId × 2 (subquery JOIN + outer WHERE)
    //   Date params × 7:
    //     lapsedDate × 1, atRiskDate × 2 (AT_RISK + REGULAR recent),
    //     vipRecentDate × 2 (VIP segment + is_vip), window180d × 1, window365d × 1
    //   Numeric thresholds × 3: VIP_VISITS_180D × 2, REGULAR_VISITS_365D × 1
    const tenantIdAppearances = values.filter((v) => v === "tenant-x").length;
    expect(tenantIdAppearances).toBe(2);

    const dates = values.filter((v): v is Date => v instanceof Date);
    expect(dates.length).toBe(7);
    for (const d of dates) {
      expect(d.getTime()).toBeLessThanOrEqual(after);
      // All within last 400 days (widest window is 365)
      expect(d.getTime()).toBeGreaterThan(before - 400 * 24 * 60 * 60 * 1000);
    }
  });

  it("processes all active tenants when no tenantId provided", async () => {
    tenantFindMany.mockResolvedValue([{ id: "t1" }, { id: "t2" }, { id: "t3" }]);

    const result = await recalculateSegments();

    expect(tenantFindMany).toHaveBeenCalledWith({
      where: { isActive: true },
      select: { id: true },
    });
    expect($executeRaw).toHaveBeenCalledTimes(3);
    expect(result.tenantsProcessed).toBe(3);
  });

  it("returns tenantsProcessed:1 for single-tenant call", async () => {
    const result = await recalculateSegments("solo");
    expect(result.tenantsProcessed).toBe(1);
  });

  it("SQL must filter COMPLETED bookings only (not CANCELLED/NO_SHOW etc)", async () => {
    await recalculateSegments("t");
    const sqlFragments = $executeRaw.mock.calls[0][0]; // TemplateStringsArray
    const fullSql = Array.isArray(sqlFragments) ? sqlFragments.join("?") : String(sqlFragments);
    expect(fullSql).toContain("status = 'COMPLETED'");
  });

  it("SQL must respect BLACKLISTED users (no auto-segment change)", async () => {
    await recalculateSegments("t");
    const sqlFragments = $executeRaw.mock.calls[0][0];
    const fullSql = Array.isArray(sqlFragments) ? sqlFragments.join("?") : String(sqlFragments);
    expect(fullSql).toContain("BLACKLISTED");
  });

  it("SQL must reference VIP threshold (180-day window) + recent-visit gate", async () => {
    await recalculateSegments("t");
    const sqlFragments = $executeRaw.mock.calls[0][0];
    const fullSql = Array.isArray(sqlFragments) ? sqlFragments.join("?") : String(sqlFragments);
    expect(fullSql).toContain("cnt_180d");
    expect(fullSql).toContain("'VIP'");
    // VIP must check recent activity (last_visit_at >= vipRecentDate)
    expect(fullSql).toMatch(/last_visit_at\s*>=/);
  });

  it("SQL must reference REGULAR threshold (365-day window)", async () => {
    await recalculateSegments("t");
    const sqlFragments = $executeRaw.mock.calls[0][0];
    const fullSql = Array.isArray(sqlFragments) ? sqlFragments.join("?") : String(sqlFragments);
    expect(fullSql).toContain("cnt_365d");
    expect(fullSql).toContain("'REGULAR'");
  });

  it("SQL pre-filters bookings to 365-day window (perf bound)", async () => {
    await recalculateSegments("t");
    const sqlFragments = $executeRaw.mock.calls[0][0];
    const fullSql = Array.isArray(sqlFragments) ? sqlFragments.join("?") : String(sqlFragments);
    // The aggregate's date >= ${window365d} ensures we don't scan all bookings
    expect(fullSql).toMatch(/v\.date\s*>=/);
  });
});

describe("resetExpiredViolations — unchanged (regression guard)", () => {
  it("resets users whose restrictedUntil has passed", async () => {
    userUpdateMany.mockResolvedValue({ count: 7 });

    const count = await resetExpiredViolations();

    expect(count).toBe(7);
    expect(userUpdateMany).toHaveBeenCalledWith({
      where: {
        bookingRestricted: true,
        restrictedUntil: { lte: expect.any(Date) },
      },
      data: {
        bookingRestricted: false,
        restrictedUntil: null,
        violationCount: 0,
      },
    });
  });
});
