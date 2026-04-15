import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

const findMany = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    eCPayOrder: { findMany: (...a: unknown[]) => findMany(...a) },
  },
}));

const getAdminFromCookie = vi.fn();
vi.mock("@/lib/auth/jwt", () => ({
  getAdminFromCookie: (...a: unknown[]) => getAdminFromCookie(...a),
}));

import { GET } from "@/app/api/admin/ecpay/orders/route";

const ADMIN_A = { adminId: "a1", tenantId: "tenantA", role: "OWNER" };

const mkOrder = (overrides: Record<string, unknown> = {}) => ({
  id: "o1",
  tenantId: "tenantA",
  merchantTradeNo: "TS123",
  tradeNo: null,
  amount: 500,
  bankCode: "008",
  vAccount: "1234567890",
  expireDate: new Date("2026-04-16T00:00:00Z"),
  status: "PENDING",
  failureReason: null,
  createdAt: new Date("2026-04-15T10:00:00Z"),
  updatedAt: new Date("2026-04-15T10:00:00Z"),
  booking: {
    id: "b1",
    date: new Date("2026-04-16T00:00:00Z"),
    startTime: "14:00",
    endTime: "15:00",
    status: "CONFIRMED",
    service: { name: "剪髮", price: 500, slotsNeeded: 1 },
    user: {
      id: "u1",
      displayName: "客戶",
      realName: null,
      phone: "0912",
      lineUserId: "Uabc",
    },
  },
  payment: {
    id: "p1",
    status: "AWAITING_BANK",
    method: "ECPAY_ATM",
    receivedAt: null,
  },
  ...overrides,
});

const req = (qs = "") =>
  new NextRequest(new URL(`http://x/api/admin/ecpay/orders${qs}`));

beforeEach(() => {
  vi.clearAllMocks();
  getAdminFromCookie.mockResolvedValue(ADMIN_A);
  findMany.mockResolvedValue([]);
});

describe("GET /api/admin/ecpay/orders", () => {
  it("unauthenticated → 401", async () => {
    getAdminFromCookie.mockResolvedValue(null);
    const res = await GET(req());
    expect(res.status).toBe(401);
  });

  it("tenant isolation: query scopes to admin's tenantId", async () => {
    await GET(req());
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: "tenantA" }),
      })
    );
  });

  it("default status=all → no status clause in where", async () => {
    await GET(req());
    const call = findMany.mock.calls[0][0];
    expect(call.where.status).toBeUndefined();
  });

  it("status=pending → PENDING filter", async () => {
    await GET(req("?status=pending"));
    const call = findMany.mock.calls[0][0];
    expect(call.where.status).toBe("PENDING");
  });

  it("status=paid/expired/failed map to enum", async () => {
    await GET(req("?status=paid"));
    expect(findMany.mock.calls.at(-1)![0].where.status).toBe("PAID");
    await GET(req("?status=expired"));
    expect(findMany.mock.calls.at(-1)![0].where.status).toBe("EXPIRED");
    await GET(req("?status=failed"));
    expect(findMany.mock.calls.at(-1)![0].where.status).toBe("FAILED");
  });

  it("invalid status → 400", async () => {
    const res = await GET(req("?status=bogus"));
    expect(res.status).toBe(400);
  });

  it("include nests booking.user + booking.service + payment (N+1 guard)", async () => {
    await GET(req());
    const call = findMany.mock.calls[0][0];
    expect(call.include.booking.include.user).toBeDefined();
    expect(call.include.booking.include.service).toBeDefined();
    expect(call.include.payment).toBeDefined();
  });

  it("orders sorted by createdAt desc", async () => {
    await GET(req());
    expect(findMany.mock.calls[0][0].orderBy).toEqual({ createdAt: "desc" });
  });

  it("pagination: default limit 50, take=51 (peek)", async () => {
    await GET(req());
    expect(findMany.mock.calls[0][0].take).toBe(51);
  });

  it("pagination: cursor adds cursor + skip:1", async () => {
    await GET(req("?cursor=abc"));
    const call = findMany.mock.calls[0][0];
    expect(call.cursor).toEqual({ id: "abc" });
    expect(call.skip).toBe(1);
  });

  it("pagination: returns nextCursor when more pages exist", async () => {
    // 51 results with limit 50 → hasMore
    const many = Array.from({ length: 51 }, (_, i) =>
      mkOrder({ id: `o${i}` })
    );
    findMany.mockResolvedValue(many);
    const res = await GET(req());
    const body = await res.json();
    expect(body.items).toHaveLength(50);
    expect(body.nextCursor).toBe("o49");
  });

  it("nextCursor null when page not full", async () => {
    findMany.mockResolvedValue([mkOrder()]);
    const res = await GET(req());
    const body = await res.json();
    expect(body.nextCursor).toBeNull();
    expect(body.items).toHaveLength(1);
  });

  it("DTO shape: customer name falls back through realName → displayName → 無名", async () => {
    findMany.mockResolvedValue([
      mkOrder({
        booking: {
          ...mkOrder().booking,
          user: {
            id: "u1",
            displayName: "Line名",
            realName: "真名",
            phone: null,
            lineUserId: null,
          },
        },
      }),
    ]);
    const res = await GET(req());
    const body = await res.json();
    expect(body.items[0].booking.user.displayName).toBe("真名");
  });

  it("limit query: clamps to [1, 100]", async () => {
    await GET(req("?limit=9999"));
    expect(findMany.mock.calls.at(-1)![0].take).toBe(101);
    await GET(req("?limit=0"));
    expect(findMany.mock.calls.at(-1)![0].take).toBe(2);
  });
});
