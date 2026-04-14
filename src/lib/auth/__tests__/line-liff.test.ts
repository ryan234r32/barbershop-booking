import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { verifyLiffIdToken, LiffTokenVerificationError } from "@/lib/auth/line-liff";

const CHANNEL = "1234567890";
const GOOD_PAYLOAD = {
  sub: "Uabc123",
  aud: CHANNEL,
  iss: "https://access.line.me",
  exp: Math.floor(Date.now() / 1000) + 3600,
  iat: Math.floor(Date.now() / 1000),
  name: "Ryan",
};

describe("verifyLiffIdToken", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const mockResponse = (ok: boolean, body: unknown, status = 200) =>
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok,
      status,
      json: async () => body,
      text: async () => JSON.stringify(body),
    } as Response);

  it("returns payload for a valid token", async () => {
    mockResponse(true, GOOD_PAYLOAD);
    const result = await verifyLiffIdToken("fake.id.token", CHANNEL);
    expect(result.sub).toBe("Uabc123");
    expect(result.name).toBe("Ryan");
  });

  it("throws invalid on empty token", async () => {
    await expect(verifyLiffIdToken("", CHANNEL)).rejects.toMatchObject({
      reason: "invalid",
    });
  });

  it("throws expired when exp is in the past", async () => {
    mockResponse(true, { ...GOOD_PAYLOAD, exp: Math.floor(Date.now() / 1000) - 10 });
    await expect(verifyLiffIdToken("t", CHANNEL)).rejects.toMatchObject({
      reason: "expired",
    });
  });

  it("throws wrong_audience when aud doesn't match channel", async () => {
    mockResponse(true, { ...GOOD_PAYLOAD, aud: "other-channel" });
    await expect(verifyLiffIdToken("t", CHANNEL)).rejects.toMatchObject({
      reason: "wrong_audience",
    });
  });

  it("throws invalid when iss is not LINE", async () => {
    mockResponse(true, { ...GOOD_PAYLOAD, iss: "https://evil.example.com" });
    await expect(verifyLiffIdToken("t", CHANNEL)).rejects.toMatchObject({
      reason: "invalid",
    });
  });

  it("throws invalid on LINE 400 (bad token)", async () => {
    mockResponse(false, { error: "invalid_token" }, 400);
    await expect(verifyLiffIdToken("t", CHANNEL)).rejects.toMatchObject({
      reason: "invalid",
    });
  });

  it("throws network on LINE 500", async () => {
    mockResponse(false, { error: "server_error" }, 500);
    await expect(verifyLiffIdToken("t", CHANNEL)).rejects.toMatchObject({
      reason: "network",
    });
  });

  it("throws network when fetch rejects", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("ENOTFOUND"));
    await expect(verifyLiffIdToken("t", CHANNEL)).rejects.toMatchObject({
      reason: "network",
    });
  });

  it("throws invalid when response has no sub", async () => {
    mockResponse(true, { ...GOOD_PAYLOAD, sub: undefined });
    await expect(verifyLiffIdToken("t", CHANNEL)).rejects.toBeInstanceOf(
      LiffTokenVerificationError
    );
  });
});
