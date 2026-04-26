import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

const findFirst = vi.fn();
const updateMany = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    booking: {
      findFirst: (...a: unknown[]) => findFirst(...a),
      updateMany: (...a: unknown[]) => updateMany(...a),
    },
  },
}));

const getAdminFromCookie = vi.fn();
vi.mock("@/lib/auth/jwt", () => ({
  getAdminFromCookie: (...a: unknown[]) => getAdminFromCookie(...a),
}));

import { POST } from "@/app/api/bookings/[id]/acknowledge/route";

const ADMIN = { adminId: "a1", tenantId: "t1", role: "OWNER" };
const req = (id = "b1") =>
  new NextRequest(new URL(`http://x/api/bookings/${id}/acknowledge`), { method: "POST" });
const params = (id = "b1") => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/bookings/[id]/acknowledge", () => {
  it("rejects unauthenticated → 401", async () => {
    getAdminFromCookie.mockResolvedValue(null);
    const res = await POST(req(), params());
    expect(res.status).toBe(401);
  });

  it("returns 404 when booking not found (cross-tenant safety)", async () => {
    getAdminFromCookie.mockResolvedValue(ADMIN);
    findFirst.mockResolvedValue(null);
    const res = await POST(req(), params());
    expect(res.status).toBe(404);
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "b1", tenantId: "t1" } })
    );
  });

  it("acks an unacked booking → conditional updateMany + 200", async () => {
    getAdminFromCookie.mockResolvedValue(ADMIN);
    const initialUpdatedAt = new Date("2026-05-01T09:00:00Z");
    const postUpdate = new Date("2026-05-01T10:00:00Z");
    findFirst
      .mockResolvedValueOnce({
        id: "b1",
        adminAcknowledgedAt: null,
        updatedAt: initialUpdatedAt,
      })
      .mockResolvedValueOnce({
        adminAcknowledgedAt: postUpdate,
        updatedAt: postUpdate,
      });
    updateMany.mockResolvedValue({ count: 1 });
    const res = await POST(req(), params());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.wasAlreadyAcked).toBe(false);
    // PRD-v3 E-1: updateMany must include updatedAt in WHERE for OCC.
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "b1",
          tenantId: "t1",
          adminAcknowledgedAt: null,
          updatedAt: initialUpdatedAt,
        }),
        data: { adminAcknowledgedAt: expect.any(Date) },
      })
    );
  });

  it("idempotent: re-acking already-acked booking → no update, wasAlreadyAcked true", async () => {
    getAdminFromCookie.mockResolvedValue(ADMIN);
    const existingAck = new Date("2026-04-30T10:00:00Z");
    const updatedAt = new Date("2026-04-30T10:00:00Z");
    findFirst.mockResolvedValue({
      id: "b1",
      adminAcknowledgedAt: existingAck,
      updatedAt,
    });
    const res = await POST(req(), params());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.wasAlreadyAcked).toBe(true);
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("stale ack (updateMany count=0) → 409", async () => {
    getAdminFromCookie.mockResolvedValue(ADMIN);
    const initialUpdatedAt = new Date("2026-05-01T09:00:00Z");
    const newerUpdatedAt = new Date("2026-05-01T11:00:00Z");
    findFirst
      .mockResolvedValueOnce({
        id: "b1",
        adminAcknowledgedAt: null,
        updatedAt: initialUpdatedAt,
      })
      .mockResolvedValueOnce({
        adminAcknowledgedAt: null,
        updatedAt: newerUpdatedAt,
      });
    updateMany.mockResolvedValue({ count: 0 });
    const res = await POST(req(), params());
    const body = await res.json();
    expect(res.status).toBe(409);
    expect(body.error).toBe("stale_ack");
  });
});
