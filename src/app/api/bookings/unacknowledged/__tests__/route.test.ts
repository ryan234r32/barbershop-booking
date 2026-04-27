import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

const findMany = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: { booking: { findMany: (...a: unknown[]) => findMany(...a) } },
}));

const getAdminFromCookie = vi.fn();
vi.mock("@/lib/auth/jwt", () => ({
  getAdminFromCookie: (...a: unknown[]) => getAdminFromCookie(...a),
}));

// Pin "today" so we can assert the gte filter.
vi.mock("@/lib/utils/time", async (orig) => {
  const actual = await orig<typeof import("@/lib/utils/time")>();
  return {
    ...actual,
    todayInTaipei: () => "2026-05-15",
  };
});

import { GET } from "@/app/api/bookings/unacknowledged/route";

const ADMIN = { adminId: "a1", tenantId: "t1", role: "OWNER" };
const req = () => new NextRequest(new URL("http://x/api/bookings/unacknowledged"));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/bookings/unacknowledged", () => {
  it("rejects unauthenticated → 401", async () => {
    getAdminFromCookie.mockResolvedValue(null);
    const res = await GET(req());
    expect(res.status).toBe(401);
  });

  it("filters by tenantId, status=CONFIRMED, ack IS NULL, date >= today", async () => {
    getAdminFromCookie.mockResolvedValue(ADMIN);
    findMany.mockResolvedValue([]);
    await GET(req());
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: "t1",
          status: "CONFIRMED",
          adminAcknowledgedAt: null,
          date: { gte: new Date("2026-05-15T00:00:00.000Z") },
        }),
        orderBy: [{ date: "asc" }, { startTime: "asc" }],
      })
    );
  });

  it("returns array + total", async () => {
    getAdminFromCookie.mockResolvedValue(ADMIN);
    findMany.mockResolvedValue([
      { id: "b1", date: "2026-05-15", startTime: "14:00" },
      { id: "b2", date: "2026-05-16", startTime: "10:00" },
    ]);
    const res = await GET(req());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.total).toBe(2);
    expect(body.bookings).toHaveLength(2);
  });
});
