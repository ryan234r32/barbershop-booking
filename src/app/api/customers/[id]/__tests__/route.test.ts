// Phase 1 of v3.8 customer hygiene plan:
// /api/customers/[id] previously did `where: { id }` with no tenant filter, so
// in a multi-tenant setup admin A could read OR overwrite admin B's customers.
// These tests pin the GET + PATCH paths to enforce tenant isolation.

import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

const userFindFirst = vi.fn();
const userUpdateMany = vi.fn();
const bookingGroupBy = vi.fn();
const bookingFindMany = vi.fn();
const paymentFindMany = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findFirst: (...a: unknown[]) => userFindFirst(...a),
      updateMany: (...a: unknown[]) => userUpdateMany(...a),
    },
    booking: {
      groupBy: (...a: unknown[]) => bookingGroupBy(...a),
      findMany: (...a: unknown[]) => bookingFindMany(...a),
    },
    payment: {
      findMany: (...a: unknown[]) => paymentFindMany(...a),
    },
  },
}));

const getAdminFromCookie = vi.fn();
vi.mock("@/lib/auth/jwt", () => ({
  getAdminFromCookie: (...a: unknown[]) => getAdminFromCookie(...a),
}));

import { GET, PATCH } from "@/app/api/customers/[id]/route";

const ADMIN_A = { adminId: "adminA", tenantId: "tenantA", role: "OWNER" };

const getReq = (id = "userInTenantB") =>
  new NextRequest(new URL(`http://x/api/customers/${id}`));

const patchReq = (id = "userInTenantB", body: Record<string, unknown> = {}) =>
  new NextRequest(new URL(`http://x/api/customers/${id}`), {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });

const params = (id = "userInTenantB") => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  vi.clearAllMocks();
  bookingGroupBy.mockResolvedValue([]);
  bookingFindMany.mockResolvedValue([]);
  paymentFindMany.mockResolvedValue([]);
});

describe("GET /api/customers/[id] — tenant isolation", () => {
  it("returns 404 when admin from tenant A queries a user that exists only in tenant B", async () => {
    getAdminFromCookie.mockResolvedValue(ADMIN_A);
    // findFirst with the (id, tenantId: tenantA) filter naturally returns null
    // for a user whose tenantId is tenantB — this is the cross-tenant guard.
    userFindFirst.mockResolvedValue(null);

    const res = await GET(getReq("userInTenantB"), params("userInTenantB"));

    expect(res.status).toBe(404);
    expect(userFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "userInTenantB", tenantId: "tenantA" },
      })
    );
    // Stats queries must not run if the user wasn't visible.
    expect(bookingGroupBy).not.toHaveBeenCalled();
    expect(bookingFindMany).not.toHaveBeenCalled();
  });

  it("happy path: admin sees their own tenant's customer with stats", async () => {
    getAdminFromCookie.mockResolvedValue(ADMIN_A);
    userFindFirst.mockResolvedValue({
      id: "userInTenantA",
      tenantId: "tenantA",
      displayName: "Ryan",
      firstVisitAt: new Date("2026-01-01"),
      lastVisitAt: new Date("2026-04-01"),
      totalVisits: 4,
      bookings: [],
      cancellationRecords: [],
    });
    bookingGroupBy.mockResolvedValue([
      { status: "COMPLETED", _count: { _all: 4 } },
    ]);
    bookingFindMany.mockResolvedValue([
      { service: { price: 500 } },
      { service: { price: 600 } },
      { service: { price: 500 } },
      { service: { price: 700 } },
    ]);

    const res = await GET(getReq("userInTenantA"), params("userInTenantA"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.customer.id).toBe("userInTenantA");
    expect(body.stats.totalBookings).toBe(4);
    expect(body.stats.totalRevenue).toBe(2300);
    expect(body.stats.avgPrice).toBe(575);

    // Stats queries must scope by tenantId too — naked userId without tenantId
    // would let a misconfigured admin read cross-tenant booking aggregates.
    expect(bookingGroupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "userInTenantA", tenantId: "tenantA" },
      })
    );
    expect(bookingFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: "userInTenantA",
          tenantId: "tenantA",
          status: "COMPLETED",
        },
      })
    );
  });

  it("rejects unauthenticated callers with 401", async () => {
    getAdminFromCookie.mockResolvedValue(null);
    const res = await GET(getReq(), params());
    expect(res.status).toBe(401);
    expect(userFindFirst).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/customers/[id] — tenant isolation", () => {
  it("returns 404 and does NOT update when admin from tenant A patches a user from tenant B", async () => {
    getAdminFromCookie.mockResolvedValue(ADMIN_A);
    // updateMany with (id, tenantId: tenantA) on a tenantB row matches 0 rows.
    userUpdateMany.mockResolvedValue({ count: 0 });

    const res = await PATCH(
      patchReq("userInTenantB", { realName: "hacked" }),
      params("userInTenantB")
    );

    expect(res.status).toBe(404);
    expect(userUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "userInTenantB", tenantId: "tenantA" },
        data: expect.objectContaining({ realName: "hacked" }),
      })
    );
    // Critically: the post-update findFirst must NOT run when no row was touched.
    // Otherwise we'd leak a user record we had no right to read.
    expect(userFindFirst).not.toHaveBeenCalled();
  });

  it("happy path: admin patches a user in their own tenant", async () => {
    getAdminFromCookie.mockResolvedValue(ADMIN_A);
    userUpdateMany.mockResolvedValue({ count: 1 });
    userFindFirst.mockResolvedValue({
      id: "userInTenantA",
      tenantId: "tenantA",
      realName: "Ryan Chen",
    });

    const res = await PATCH(
      patchReq("userInTenantA", { realName: "Ryan Chen" }),
      params("userInTenantA")
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.customer.realName).toBe("Ryan Chen");
    expect(userUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "userInTenantA", tenantId: "tenantA" },
      })
    );
    expect(userFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "userInTenantA", tenantId: "tenantA" },
      })
    );
  });

  it("rejects unauthenticated callers with 401", async () => {
    getAdminFromCookie.mockResolvedValue(null);
    const res = await PATCH(patchReq(), params());
    expect(res.status).toBe(401);
    expect(userUpdateMany).not.toHaveBeenCalled();
  });
});
