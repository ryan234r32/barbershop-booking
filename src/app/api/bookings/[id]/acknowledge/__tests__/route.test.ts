import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

const findFirst = vi.fn();
const update = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    booking: {
      findFirst: (...a: unknown[]) => findFirst(...a),
      update: (...a: unknown[]) => update(...a),
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

  it("acks an unacked booking → writes timestamp + wasAlreadyAcked false", async () => {
    getAdminFromCookie.mockResolvedValue(ADMIN);
    findFirst.mockResolvedValue({ id: "b1", adminAcknowledgedAt: null });
    const ackedAt = new Date("2026-05-01T10:00:00Z");
    update.mockResolvedValue({ adminAcknowledgedAt: ackedAt });
    const res = await POST(req(), params());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.wasAlreadyAcked).toBe(false);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "b1" },
        data: { adminAcknowledgedAt: expect.any(Date) },
      })
    );
  });

  it("idempotent: re-acking already-acked booking → no update, wasAlreadyAcked true", async () => {
    getAdminFromCookie.mockResolvedValue(ADMIN);
    const existingAck = new Date("2026-04-30T10:00:00Z");
    findFirst.mockResolvedValue({ id: "b1", adminAcknowledgedAt: existingAck });
    const res = await POST(req(), params());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.wasAlreadyAcked).toBe(true);
    expect(update).not.toHaveBeenCalled();
  });
});
