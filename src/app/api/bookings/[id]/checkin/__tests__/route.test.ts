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

import { PATCH } from "@/app/api/bookings/[id]/checkin/route";

const ADMIN = { adminId: "a1", tenantId: "t1", role: "OWNER" };
const req = (body?: object, id = "b1") =>
  new NextRequest(new URL(`http://x/api/bookings/${id}/checkin`), {
    method: "PATCH",
    body: body ? JSON.stringify(body) : undefined,
    headers: body ? { "content-type": "application/json" } : undefined,
  });
const params = (id = "b1") => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  vi.clearAllMocks();
});

describe("PATCH /api/bookings/[id]/checkin", () => {
  it("rejects unauthenticated → 401", async () => {
    getAdminFromCookie.mockResolvedValue(null);
    const res = await PATCH(req(), params());
    expect(res.status).toBe(401);
  });

  it("returns 404 when booking not found (cross-tenant safety)", async () => {
    getAdminFromCookie.mockResolvedValue(ADMIN);
    findFirst.mockResolvedValue(null);
    const res = await PATCH(req(), params());
    expect(res.status).toBe(404);
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "b1", tenantId: "t1" } }),
    );
  });

  it("rejects non-CONFIRMED bookings → 400", async () => {
    getAdminFromCookie.mockResolvedValue(ADMIN);
    findFirst.mockResolvedValue({
      id: "b1",
      status: "COMPLETED",
      checkedInAt: null,
      updatedAt: new Date(),
    });
    const res = await PATCH(req(), params());
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error).toBe("invalid_status");
  });

  it("toggles NULL → now() when not checked in (default toggle behavior)", async () => {
    getAdminFromCookie.mockResolvedValue(ADMIN);
    const initialUpdatedAt = new Date("2026-05-01T09:00:00Z");
    findFirst
      .mockResolvedValueOnce({
        id: "b1",
        status: "CONFIRMED",
        checkedInAt: null,
        updatedAt: initialUpdatedAt,
      })
      .mockResolvedValueOnce({
        checkedInAt: new Date("2026-05-01T10:00:00Z"),
        updatedAt: new Date("2026-05-01T10:00:00Z"),
      });
    updateMany.mockResolvedValue({ count: 1 });
    const res = await PATCH(req(), params());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.wasNoOp).toBe(false);
    // Must use OCC fence (updatedAt in WHERE).
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "b1",
          tenantId: "t1",
          updatedAt: initialUpdatedAt,
        }),
        data: { checkedInAt: expect.any(Date) },
      }),
    );
  });

  it("toggles NOT NULL → NULL when already checked in", async () => {
    getAdminFromCookie.mockResolvedValue(ADMIN);
    const checkedInAt = new Date("2026-05-01T09:30:00Z");
    findFirst
      .mockResolvedValueOnce({
        id: "b1",
        status: "CONFIRMED",
        checkedInAt,
        updatedAt: new Date("2026-05-01T09:30:00Z"),
      })
      .mockResolvedValueOnce({
        checkedInAt: null,
        updatedAt: new Date("2026-05-01T10:00:00Z"),
      });
    updateMany.mockResolvedValue({ count: 1 });
    const res = await PATCH(req(), params());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { checkedInAt: null },
      }),
    );
    expect(body.checkedInAt).toBeNull();
  });

  it("idempotent: desired matches current state → no update", async () => {
    getAdminFromCookie.mockResolvedValue(ADMIN);
    const checkedInAt = new Date("2026-05-01T09:30:00Z");
    findFirst.mockResolvedValue({
      id: "b1",
      status: "CONFIRMED",
      checkedInAt,
      updatedAt: new Date(),
    });
    const res = await PATCH(req({ desired: "checked_in" }), params());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.wasNoOp).toBe(true);
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("respects explicit desired=not_yet (un-checkin)", async () => {
    getAdminFromCookie.mockResolvedValue(ADMIN);
    findFirst
      .mockResolvedValueOnce({
        id: "b1",
        status: "CONFIRMED",
        checkedInAt: new Date("2026-05-01T09:30:00Z"),
        updatedAt: new Date("2026-05-01T09:30:00Z"),
      })
      .mockResolvedValueOnce({
        checkedInAt: null,
        updatedAt: new Date("2026-05-01T10:00:00Z"),
      });
    updateMany.mockResolvedValue({ count: 1 });
    const res = await PATCH(req({ desired: "not_yet" }), params());
    expect(res.status).toBe(200);
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { checkedInAt: null } }),
    );
  });

  it("stale write (updateMany count=0) → 409", async () => {
    getAdminFromCookie.mockResolvedValue(ADMIN);
    findFirst
      .mockResolvedValueOnce({
        id: "b1",
        status: "CONFIRMED",
        checkedInAt: null,
        updatedAt: new Date("2026-05-01T09:00:00Z"),
      })
      .mockResolvedValueOnce({
        checkedInAt: null,
        updatedAt: new Date("2026-05-01T11:00:00Z"),
      });
    updateMany.mockResolvedValue({ count: 0 });
    const res = await PATCH(req(), params());
    const body = await res.json();
    expect(res.status).toBe(409);
    expect(body.error).toBe("stale_write");
  });
});
