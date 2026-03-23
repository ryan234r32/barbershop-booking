import { describe, it, expect } from "vitest";
import crypto from "crypto";
import { verifyLineSignature } from "@/lib/line/webhook";

describe("verifyLineSignature", () => {
  const channelSecret = "test-channel-secret";

  function createValidSignature(body: string): string {
    return crypto
      .createHmac("sha256", channelSecret)
      .update(body)
      .digest("base64");
  }

  it("accepts a valid signature", () => {
    const body = JSON.stringify({ events: [] });
    const signature = createValidSignature(body);
    expect(verifyLineSignature(body, signature, channelSecret)).toBe(true);
  });

  it("rejects an invalid signature", () => {
    const body = JSON.stringify({ events: [] });
    expect(verifyLineSignature(body, "invalid-signature", channelSecret)).toBe(false);
  });

  it("rejects signature from different body", () => {
    const body1 = JSON.stringify({ events: [{ type: "follow" }] });
    const body2 = JSON.stringify({ events: [{ type: "message" }] });
    const signature = createValidSignature(body1);
    expect(verifyLineSignature(body2, signature, channelSecret)).toBe(false);
  });

  it("rejects signature with different channel secret", () => {
    const body = JSON.stringify({ events: [] });
    const signature = createValidSignature(body);
    expect(verifyLineSignature(body, signature, "wrong-secret")).toBe(false);
  });

  it("handles empty body", () => {
    const body = "";
    const signature = createValidSignature(body);
    expect(verifyLineSignature(body, signature, channelSecret)).toBe(true);
  });

  it("handles UTF-8 content (Chinese characters)", () => {
    const body = JSON.stringify({ text: "你好世界" });
    const signature = createValidSignature(body);
    expect(verifyLineSignature(body, signature, channelSecret)).toBe(true);
  });
});
