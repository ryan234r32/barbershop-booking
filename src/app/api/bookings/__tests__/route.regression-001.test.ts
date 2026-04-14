// Regression: ISSUE-001 — GET /api/bookings returned entire customer DB (names,
// lineUserId, phones, payments) with no auth; /qa on prod 2026-04-14 dumped 50
// bookings by curl against barbershop-booking-swart.vercel.app/api/bookings.
// Found by /qa on 2026-04-14
// Report: .gstack/qa-reports/qa-report-barbershop-booking-swart-vercel-app-2026-04-14.md

import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

const findMany = vi.fn();
const bookingCount = vi.fn();
const userFindUnique = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    booking: {
      findMany: (...a: unknown[]) => findMany(...a),
      count: (...a: unknown[]) => bookingCount(...a),
    },
    user: { findUnique: (...a: unknown[]) => userFindUnique(...a) },
  },
}));

const getAdminFromCookie = vi.fn();
vi.mock("@/lib/auth/jwt", () => ({
  getAdminFromCookie: (...a: unknown[]) => getAdminFromCookie(...a),
}));

const verifyLiffIdToken = vi.fn();
vi.mock("@/lib/auth/line-liff", async (orig) => {
  const actual = await orig<typeof import("@/lib/auth/line-liff")>();
  return {
    ...actual,
    verifyLiffIdToken: (...a: unknown[]) => verifyLiffIdToken(...a),
  };
});

import { GET } from "@/app/api/bookings/route";

const ADMIN = { adminId: "a1", tenantId: "t1", role: "OWNER" };

function req(opts: { liffToken?: string } = {}): NextRequest {
  const headers = new Headers();
  if (opts.liffToken) headers.set("x-liff-id-token", opts.liffToken);
  return new NextRequest(new URL("http://x/api/bookings"), { headers });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.LINE_CHANNEL_ID = "test-channel";
  process.env.DEFAULT_TENANT_ID = "t1";
  findMany.mockResolvedValue([]);
  bookingCount.mockResolvedValue(0);
});

describe("GET /api/bookings — auth regression (ISSUE-001)", () => {
  it("rejects unauthenticated callers with 401 (was: dumped entire DB)", async () => {
    getAdminFromCookie.mockResolvedValue(null);
    const res = await GET(req());
    expect(res.status).toBe(401);
    expect(findMany).not.toHaveBeenCalled();
  });

  it("rejects caller with invalid LIFF token with 401", async () => {
    getAdminFromCookie.mockResolvedValue(null);
    const { LiffTokenVerificationError } = await import("@/lib/auth/line-liff");
    verifyLiffIdToken.mockRejectedValue(new LiffTokenVerificationError("bad token", "invalid"));
    const res = await GET(req({ liffToken: "bogus" }));
    expect(res.status).toBe(401);
    expect(findMany).not.toHaveBeenCalled();
  });

  it("admin sees full tenant — all bookings, no user filter", async () => {
    getAdminFromCookie.mockResolvedValue(ADMIN);
    await GET(req());
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: "t1" } })
    );
  });

  it("LIFF caller is scoped to their own bookings — query param lineUserId is IGNORED", async () => {
    getAdminFromCookie.mockResolvedValue(null);
    verifyLiffIdToken.mockResolvedValue({ sub: "Uowner", name: "Me" });
    userFindUnique.mockResolvedValue({ id: "user-owner" });

    // Attacker passes someone else's lineUserId as a query param
    const url = new URL("http://x/api/bookings?lineUserId=Uvictim");
    const headers = new Headers({ "x-liff-id-token": "token" });
    const attackReq = new NextRequest(url, { headers });

    await GET(attackReq);

    // Must scope to the TOKEN'S user, not the query param's
    expect(userFindUnique).toHaveBeenCalledWith({
      where: { tenantId_lineUserId: { tenantId: "t1", lineUserId: "Uowner" } },
      select: { id: true },
    });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: "t1", userId: "user-owner" }),
      })
    );
  });

  it("LIFF caller with no user record returns empty list (not 500, not leak)", async () => {
    getAdminFromCookie.mockResolvedValue(null);
    verifyLiffIdToken.mockResolvedValue({ sub: "Unewbie", name: "New" });
    userFindUnique.mockResolvedValue(null);

    const res = await GET(req({ liffToken: "token" }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.bookings).toEqual([]);
    expect(body.total).toBe(0);
    expect(findMany).not.toHaveBeenCalled();
  });
});
