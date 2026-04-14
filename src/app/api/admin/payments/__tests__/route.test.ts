import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

const bookingFindMany = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    booking: { findMany: (...a: unknown[]) => bookingFindMany(...a) },
  },
}));

const getAdminFromCookie = vi.fn();
vi.mock("@/lib/auth/jwt", () => ({
  getAdminFromCookie: (...a: unknown[]) => getAdminFromCookie(...a),
}));

import { GET } from "@/app/api/admin/payments/route";

const ADMIN_A = { adminId: "a1", tenantId: "tenantA", role: "OWNER" };

const mkBooking = (overrides: Record<string, unknown> = {}) => ({
  id: "b1",
  tenantId: "tenantA",
  date: new Date("2026-05-10T00:00:00Z"),
  startTime: "14:00",
  service: { name: "剪髮", price: 500 },
  user: { displayName: "客", realName: null, phone: "0912", lineUserId: "Uabc" },
  payment: {
    amount: 500,
    method: "BANK_TRANSFER",
    status: "VERIFYING",
    transferLastFive: "12345",
    verifiedAt: new Date(),
    receivedAt: null,
  },
  ...overrides,
});

const req = (qs = "") =>
  new NextRequest(new URL(`http://x/api/admin/payments${qs}`));

beforeEach(() => {
  vi.clearAllMocks();
  getAdminFromCookie.mockResolvedValue(ADMIN_A);
  bookingFindMany.mockResolvedValue([]);
});

describe("GET /api/admin/payments", () => {
  it("unauthenticated → 401", async () => {
    getAdminFromCookie.mockResolvedValue(null);
    const res = await GET(req());
    expect(res.status).toBe(401);
  });

  it("tenant isolation: query scopes to admin's tenantId", async () => {
    bookingFindMany.mockResolvedValue([mkBooking()]);
    await GET(req());
    expect(bookingFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: "tenantA" }),
      })
    );
  });

  it("default filter returns PENDING + VERIFYING in date window", async () => {
    bookingFindMany.mockResolvedValue([mkBooking()]);
    await GET(req());
    const call = bookingFindMany.mock.calls[0][0];
    expect(call.where.payment).toEqual({
      is: { status: { in: ["PENDING", "VERIFYING"] } },
    });
    expect(call.where.date.gte).toBeInstanceOf(Date);
    expect(call.where.date.lte).toBeInstanceOf(Date);
  });

  it("status=RECEIVED filter", async () => {
    await GET(req("?status=RECEIVED"));
    const call = bookingFindMany.mock.calls[0][0];
    expect(call.where.payment).toEqual({ is: { status: "RECEIVED" } });
  });

  it("status=all returns everything (no status clause)", async () => {
    await GET(req("?status=all"));
    const call = bookingFindMany.mock.calls[0][0];
    expect(call.where.payment).toEqual({ isNot: null });
  });

  it("q=12345 exact-match filter on transferLastFive", async () => {
    await GET(req("?q=12345"));
    const call = bookingFindMany.mock.calls[0][0];
    expect(call.where.payment).toEqual(
      expect.objectContaining({
        is: expect.objectContaining({ transferLastFive: "12345" }),
      })
    );
  });

  it("q with <5 digits still filters (prefix-ish, still applied)", async () => {
    await GET(req("?q=123"));
    const call = bookingFindMany.mock.calls[0][0];
    expect(call.where.payment).toEqual(
      expect.objectContaining({
        is: expect.objectContaining({ transferLastFive: "123" }),
      })
    );
  });

  it("q with non-digit → ignored (fallback to status filter)", async () => {
    await GET(req("?q=abc"));
    const call = bookingFindMany.mock.calls[0][0];
    expect(call.where.payment).toEqual({
      is: { status: { in: ["PENDING", "VERIFYING"] } },
    });
  });

  it("summary counts correct", async () => {
    const today = new Date().toISOString().slice(0, 10);
    bookingFindMany.mockResolvedValue([
      mkBooking({ id: "v1", payment: { ...mkBooking().payment, status: "VERIFYING" } }),
      mkBooking({ id: "v2", payment: { ...mkBooking().payment, status: "VERIFYING" } }),
      mkBooking({ id: "p1", payment: { ...mkBooking().payment, status: "PENDING" } }),
      mkBooking({
        id: "r1",
        payment: {
          amount: 700,
          method: "CASH",
          status: "RECEIVED",
          transferLastFive: null,
          verifiedAt: null,
          receivedAt: new Date(`${today}T10:00:00Z`),
        },
      }),
    ]);
    const res = await GET(req("?status=all"));
    const body = await res.json();
    expect(body.summary.verifyingCount).toBe(2);
    expect(body.summary.pendingCount).toBe(1);
    expect(body.summary.receivedTodayAmount).toBe(700);
    expect(body.items).toHaveLength(4);
  });

  it("booking with no payment → status defaults to PENDING in item", async () => {
    bookingFindMany.mockResolvedValue([mkBooking({ payment: null })]);
    const res = await GET(req("?status=all"));
    const body = await res.json();
    expect(body.items[0].status).toBe("PENDING");
    expect(body.items[0].transferLastFive).toBeNull();
  });
});
