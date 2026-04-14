import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { requireBookingAuth } from "@/lib/auth/booking-auth";
import { signAdminToken } from "@/lib/auth/jwt";
import { UnauthorizedError, AppError } from "@/lib/utils/errors";

const ADMIN = { adminId: "admin-123", tenantId: "tenant-456", role: "OWNER" };

function makeRequest(
  opts: { cookie?: string; bearer?: string; liffToken?: string } = {}
): NextRequest {
  const headers = new Headers();
  if (opts.bearer) headers.set("authorization", `Bearer ${opts.bearer}`);
  if (opts.liffToken) headers.set("x-liff-id-token", opts.liffToken);
  if (opts.cookie) headers.set("cookie", `admin_token=${opts.cookie}`);
  return new NextRequest(new URL("http://localhost/api/bookings"), { headers });
}

describe("requireBookingAuth", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    process.env.LINE_CHANNEL_ID = "test-channel";
    process.env.DEFAULT_TENANT_ID = "default-tenant";
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns admin identity from cookie", async () => {
    const token = signAdminToken(ADMIN);
    const auth = await requireBookingAuth(makeRequest({ cookie: token }));
    expect(auth).toEqual({
      type: "admin",
      adminId: "admin-123",
      tenantId: "tenant-456",
    });
  });

  it("returns admin identity from Bearer header (iOS PWA)", async () => {
    const token = signAdminToken(ADMIN);
    const auth = await requireBookingAuth(makeRequest({ bearer: token }));
    expect(auth.type).toBe("admin");
  });

  it("admin wins when both admin and LIFF are present (explicit precedence)", async () => {
    const token = signAdminToken(ADMIN);
    const auth = await requireBookingAuth(
      makeRequest({ cookie: token, liffToken: "irrelevant" })
    );
    expect(auth.type).toBe("admin");
    // fetch should NOT be called because admin path short-circuits
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("returns LIFF identity when LINE verifies the token", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        sub: "Uliffuser",
        aud: "test-channel",
        iss: "https://access.line.me",
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
        name: "From LINE",
      }),
      text: async () => "",
    } as Response);

    const auth = await requireBookingAuth(makeRequest({ liffToken: "good" }));
    expect(auth).toEqual({
      type: "liff",
      lineUserId: "Uliffuser",
      displayName: "From LINE",
      tenantId: "default-tenant",
    });
  });

  it("throws UnauthorizedError when neither admin nor LIFF is present", async () => {
    await expect(requireBookingAuth(makeRequest())).rejects.toBeInstanceOf(
      UnauthorizedError
    );
  });

  it("throws UnauthorizedError when LIFF token is invalid", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: "invalid_token" }),
      text: async () => "invalid",
    } as Response);

    await expect(
      requireBookingAuth(makeRequest({ liffToken: "bad" }))
    ).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("throws 503 AppError when LINE verify API is down", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("ENOTFOUND"));

    const err = await requireBookingAuth(
      makeRequest({ liffToken: "unreachable" })
    ).catch((e) => e);

    expect(err).toBeInstanceOf(AppError);
    expect(err.statusCode).toBe(503);
  });

  it("throws UnauthorizedError when admin token is forged/invalid", async () => {
    await expect(
      requireBookingAuth(makeRequest({ cookie: "not.a.jwt" }))
    ).rejects.toBeInstanceOf(UnauthorizedError);
  });
});
