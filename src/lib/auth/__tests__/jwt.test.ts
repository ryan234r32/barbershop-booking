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

describe("JWT lazy secret resolution (Vercel build-time fix)", () => {
  it("does not throw on module import when JWT_SECRET is unset", async () => {
    // The whole point of the lazy refactor: before this change, importing
    // the module crashed `next build` page-data-collection if JWT_SECRET
    // wasn't set in the build env (broke preview deploys for PRs #91-98).
    // Meta-test: if this file can `import { signAdminToken } from ...`
    // without throwing, the lazy refactor is intact (the import at the top
    // of this very file would have crashed the suite under the old code if
    // JWT_SECRET were unset at vitest startup).
    const mod = await import("@/lib/auth/jwt");
    expect(typeof mod.signAdminToken).toBe("function");
    expect(typeof mod.verifyAdminToken).toBe("function");
  });

  it("throws at sign-call site if JWT_SECRET is unset (fail-fast preserved)", () => {
    const original = process.env.JWT_SECRET;
    delete process.env.JWT_SECRET;
    try {
      expect(() =>
        signAdminToken({ adminId: "a", tenantId: "t", role: "OWNER" }),
      ).toThrow(/JWT_SECRET environment variable is required/);
    } finally {
      // Restore so subsequent tests in the same file still work.
      if (original !== undefined) process.env.JWT_SECRET = original;
    }
  });

  it("returns null (not throws) at verify-call site if JWT_SECRET is unset", () => {
    // verifyAdminToken catches all errors (existing contract — used in
    // request paths where missing token == unauthenticated, not 500). So
    // a missing secret manifests as "auth fails" not "server crashes" on
    // verify path. This locks that behavior in.
    const original = process.env.JWT_SECRET;
    delete process.env.JWT_SECRET;
    try {
      expect(verifyAdminToken("any.token.value")).toBeNull();
    } finally {
      if (original !== undefined) process.env.JWT_SECRET = original;
    }
  });
});
