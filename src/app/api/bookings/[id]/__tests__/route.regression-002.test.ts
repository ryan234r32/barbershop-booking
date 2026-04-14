// Regression: ISSUE-002 — GET /api/bookings/[id] returned full booking including
// user PII (displayName, lineUserId, phone, realName) AND tenant bank account
// number (bankAccountNumber, bankAccountName, bankInfo) with no auth. Any
// harvested booking UUID could dump bank account details + customer contact info.
// Found by /qa on 2026-04-14
// Report: .gstack/qa-reports/qa-report-barbershop-booking-swart-vercel-app-2026-04-14.md

import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

const bookingFindUnique = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    booking: { findUnique: (...a: unknown[]) => bookingFindUnique(...a) },
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

import { GET } from "@/app/api/bookings/[id]/route";

const ADMIN = { adminId: "a1", tenantId: "t1", role: "OWNER" };
const BOOKING_ID = "00000000-0000-0000-0000-000000000001";

function req(opts: { liffToken?: string } = {}): NextRequest {
  const headers = new Headers();
  if (opts.liffToken) headers.set("x-liff-id-token", opts.liffToken);
  return new NextRequest(new URL(`http://x/api/bookings/${BOOKING_ID}`), { headers });
}
const params = { params: Promise.resolve({ id: BOOKING_ID }) };

beforeEach(() => {
  vi.clearAllMocks();
  process.env.LINE_CHANNEL_ID = "test-channel";
  process.env.DEFAULT_TENANT_ID = "t1";
});

describe("GET /api/bookings/[id] — auth regression (ISSUE-002)", () => {
  it("rejects unauthenticated callers with 401 (was: dumped bank account + PII)", async () => {
    getAdminFromCookie.mockResolvedValue(null);
    const res = await GET(req(), params);
    expect(res.status).toBe(401);
    expect(bookingFindUnique).not.toHaveBeenCalled();
  });

  it("LIFF caller who is NOT the booking owner gets 401 — cannot see stranger's booking", async () => {
    getAdminFromCookie.mockResolvedValue(null);
    verifyLiffIdToken.mockResolvedValue({ sub: "Uattacker", name: "Attacker" });
    bookingFindUnique.mockResolvedValue({
      id: BOOKING_ID,
      tenantId: "t1",
      user: { lineUserId: "Uvictim" },
    });
    const res = await GET(req({ liffToken: "token" }), params);
    expect(res.status).toBe(401);
  });

  it("LIFF caller who IS the booking owner gets the booking (200)", async () => {
    getAdminFromCookie.mockResolvedValue(null);
    verifyLiffIdToken.mockResolvedValue({ sub: "Uowner", name: "Owner" });
    bookingFindUnique.mockResolvedValue({
      id: BOOKING_ID,
      tenantId: "t1",
      user: { lineUserId: "Uowner" },
    });
    const res = await GET(req({ liffToken: "token" }), params);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.booking.id).toBe(BOOKING_ID);
  });

  it("admin gets any booking in their tenant (200)", async () => {
    getAdminFromCookie.mockResolvedValue(ADMIN);
    bookingFindUnique.mockResolvedValue({
      id: BOOKING_ID,
      tenantId: "t1",
      user: { lineUserId: "Uanyone" },
    });
    const res = await GET(req(), params);
    expect(res.status).toBe(200);
  });

  it("admin from different tenant gets 401 — cross-tenant access blocked", async () => {
    getAdminFromCookie.mockResolvedValue({ adminId: "a2", tenantId: "other-tenant", role: "OWNER" });
    bookingFindUnique.mockResolvedValue({
      id: BOOKING_ID,
      tenantId: "t1",
      user: { lineUserId: "Ux" },
    });
    const res = await GET(req(), params);
    expect(res.status).toBe(401);
  });

  it("returns 404 for unknown ID even when authenticated (but auth is checked first)", async () => {
    getAdminFromCookie.mockResolvedValue(ADMIN);
    bookingFindUnique.mockResolvedValue(null);
    const res = await GET(req(), params);
    expect(res.status).toBe(404);
  });
});
