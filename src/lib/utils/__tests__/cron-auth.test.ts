import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { verifyCronSecret } from "@/lib/utils/cron-auth";

describe("verifyCronSecret", () => {
  beforeEach(() => {
    process.env.CRON_SECRET = "test-cron-secret-abc123";
  });

  afterEach(() => {
    delete process.env.CRON_SECRET;
  });

  it("returns true with correct Bearer token", () => {
    const request = new NextRequest("https://example.com/api/cron/test", {
      headers: { authorization: "Bearer test-cron-secret-abc123" },
    });
    expect(verifyCronSecret(request)).toBe(true);
  });

  it("returns false with wrong secret", () => {
    const request = new NextRequest("https://example.com/api/cron/test", {
      headers: { authorization: "Bearer wrong-secret" },
    });
    expect(verifyCronSecret(request)).toBe(false);
  });

  it("returns false with no authorization header", () => {
    const request = new NextRequest("https://example.com/api/cron/test");
    expect(verifyCronSecret(request)).toBe(false);
  });

  it("returns false when authorization header has no Bearer prefix", () => {
    const request = new NextRequest("https://example.com/api/cron/test", {
      headers: { authorization: "test-cron-secret-abc123" },
    });
    expect(verifyCronSecret(request)).toBe(false);
  });

  it("returns false when CRON_SECRET env var is not set", () => {
    delete process.env.CRON_SECRET;
    const request = new NextRequest("https://example.com/api/cron/test", {
      headers: { authorization: "Bearer test-cron-secret-abc123" },
    });
    expect(verifyCronSecret(request)).toBe(false);
  });
});
