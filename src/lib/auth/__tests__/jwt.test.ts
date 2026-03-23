import { describe, it, expect } from "vitest";
import { signAdminToken, verifyAdminToken } from "@/lib/auth/jwt";
import type { AdminJwtPayload } from "@/lib/auth/jwt";

describe("JWT token signing and verification", () => {
  const payload: AdminJwtPayload = {
    adminId: "admin-123",
    tenantId: "tenant-456",
    role: "OWNER",
  };

  it("signs and verifies a token successfully", () => {
    const token = signAdminToken(payload);
    const decoded = verifyAdminToken(token);

    expect(decoded).not.toBeNull();
    expect(decoded!.adminId).toBe("admin-123");
    expect(decoded!.tenantId).toBe("tenant-456");
    expect(decoded!.role).toBe("OWNER");
  });

  it("returns null for invalid token", () => {
    const result = verifyAdminToken("invalid.token.here");
    expect(result).toBeNull();
  });

  it("returns null for empty string", () => {
    const result = verifyAdminToken("");
    expect(result).toBeNull();
  });

  it("returns null for tampered token", () => {
    const token = signAdminToken(payload);
    const tampered = token.slice(0, -5) + "XXXXX";
    const result = verifyAdminToken(tampered);
    expect(result).toBeNull();
  });

  it("produces different tokens for different payloads", () => {
    const token1 = signAdminToken(payload);
    const token2 = signAdminToken({ ...payload, adminId: "admin-789" });
    expect(token1).not.toBe(token2);
  });

  it("preserves STAFF role in token", () => {
    const staffPayload: AdminJwtPayload = {
      adminId: "staff-1",
      tenantId: "tenant-456",
      role: "STAFF",
    };
    const token = signAdminToken(staffPayload);
    const decoded = verifyAdminToken(token);
    expect(decoded!.role).toBe("STAFF");
  });
});
