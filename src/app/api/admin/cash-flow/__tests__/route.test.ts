import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

const findMany = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    payment: {
      findMany: (...a: unknown[]) => findMany(...a),
    },
  },
}));

const getAdminFromCookie = vi.fn();
vi.mock("@/lib/auth/jwt", () => ({
  getAdminFromCookie: (...a: unknown[]) => getAdminFromCookie(...a),
}));

vi.mock("@/lib/utils/time", () => ({
  todayInTaipei: () => "2026-04-27",
}));

import { GET } from "@/app/api/admin/cash-flow/route";

const ADMIN = { adminId: "a1", tenantId: "t1", role: "OWNER" };
const req = (search = "") =>
  new NextRequest(new URL(`http://x/api/admin/cash-flow${search}`));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/admin/cash-flow", () => {
  it("rejects unauthenticated → 401", async () => {
    getAdminFromCookie.mockResolvedValue(null);
    const res = await GET(req());
    expect(res.status).toBe(401);
  });

  it("validates date format → 400", async () => {
    getAdminFromCookie.mockResolvedValue(ADMIN);
    const res = await GET(req("?date=2026/04/27"));
    expect(res.status).toBe(400);
    expect(findMany).not.toHaveBeenCalled();
  });

  it("defaults to today (Taipei) when date param omitted", async () => {
    getAdminFromCookie.mockResolvedValue(ADMIN);
    findMany.mockResolvedValue([]);
    const res = await GET(req());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.date).toBe("2026-04-27");
    expect(body.totalReceived).toBe(0);
    expect(body.byMethod.CASH).toEqual({ fromCheckout: 0, fromDeposit: 0, total: 0 });
  });

  it("filters by tenantId via nested booking relation", async () => {
    getAdminFromCookie.mockResolvedValue(ADMIN);
    findMany.mockResolvedValue([]);
    await GET(req("?date=2026-04-27"));
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: "RECEIVED",
          booking: { tenantId: "t1" },
        }),
      }),
    );
  });

  it("buckets ECPAY_ATM as fromDeposit, CASH+BANK_TRANSFER as fromCheckout (method-based, status-independent)", async () => {
    getAdminFromCookie.mockResolvedValue(ADMIN);
    findMany.mockResolvedValue([
      { amount: 1000, method: "CASH", receivedAt: new Date() },
      { amount: 500, method: "CASH", receivedAt: new Date() },
      { amount: 800, method: "BANK_TRANSFER", receivedAt: new Date() },
      { amount: 600, method: "ECPAY_ATM", receivedAt: new Date() },
    ]);
    const res = await GET(req("?date=2026-04-27"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.totalReceived).toBe(2900);
    expect(body.fromCheckout).toBe(2300); // CASH 1500 + BANK 800
    expect(body.fromDeposit).toBe(600); // ECPay only
    expect(body.byMethod.CASH).toEqual({
      fromCheckout: 1500,
      fromDeposit: 0,
      total: 1500,
    });
    expect(body.byMethod.BANK_TRANSFER).toEqual({
      fromCheckout: 800,
      fromDeposit: 0,
      total: 800,
    });
    expect(body.byMethod.ECPAY_ATM).toEqual({
      fromCheckout: 0,
      fromDeposit: 600,
      total: 600,
    });
    expect(body.count).toBe(4);
  });

  it("classifier is status-independent — old deposits don't reclassify when bookings flip to COMPLETED", async () => {
    // Codex P1 regression: previously, a deposit collected before service was
    // reclassified into fromCheckout once its booking flipped to COMPLETED,
    // retroactively rewriting historical reports. Method-based classification
    // is stable: no booking.status field is read at all.
    getAdminFromCookie.mockResolvedValue(ADMIN);
    findMany.mockResolvedValue([
      // Same ECPay deposit, regardless of whether the booking later completed,
      // must still classify as fromDeposit:
      { amount: 600, method: "ECPAY_ATM", receivedAt: new Date() },
    ]);
    const res = await GET(req("?date=2026-04-27"));
    const body = await res.json();
    expect(body.fromDeposit).toBe(600);
    expect(body.fromCheckout).toBe(0);
    // Verify findMany is NOT selecting booking status anymore (regression
    // pin — the old impl included `booking: { select: { status: true } }`).
    const selectArg = findMany.mock.calls[0]?.[0]?.select;
    expect(selectArg.booking).toBeUndefined();
  });

  it("uses Taipei-day window for receivedAt filter", async () => {
    getAdminFromCookie.mockResolvedValue(ADMIN);
    findMany.mockResolvedValue([]);
    await GET(req("?date=2026-04-27"));
    const call = findMany.mock.calls[0]?.[0] as {
      where: { receivedAt: { gte: Date; lt: Date } };
    };
    // 00:00 Taipei 4/27 = 16:00 UTC 4/26
    expect(call.where.receivedAt.gte.toISOString()).toBe("2026-04-26T16:00:00.000Z");
    // 24:00 Taipei 4/27 = 16:00 UTC 4/27
    expect(call.where.receivedAt.lt.toISOString()).toBe("2026-04-27T16:00:00.000Z");
  });
});
