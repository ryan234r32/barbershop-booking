import { describe, it, expect } from "vitest";
import {
  generateMerchantTradeNo,
  formatMerchantTradeDate,
} from "@/lib/ecpay/merchant-trade-no";

describe("generateMerchantTradeNo", () => {
  it("produces a 19-char alphanumeric string", () => {
    const tradeNo = generateMerchantTradeNo({
      bookingId: "550e8400-e29b-41d4-a716-446655440000",
      now: 1_713_100_000_000,
    });
    expect(tradeNo).toMatch(/^[A-Z0-9]+$/);
    expect(tradeNo.length).toBe(19);
    expect(tradeNo.startsWith("TS")).toBe(true);
  });

  it("never exceeds 20 chars (ECPay hard limit)", () => {
    for (let i = 0; i < 50; i++) {
      const tradeNo = generateMerchantTradeNo({
        bookingId: `booking-${i}-${"x".repeat(40)}`,
        now: Date.now() + i,
      });
      expect(tradeNo.length).toBeLessThanOrEqual(20);
    }
  });

  it("varies with timestamp to avoid collisions on retry", () => {
    const bookingId = "same-booking-id-for-retry";
    const first = generateMerchantTradeNo({ bookingId, now: 1000 });
    const second = generateMerchantTradeNo({ bookingId, now: 2000 });
    expect(first).not.toBe(second);
  });

  it("strips non-alphanumeric characters from bookingId", () => {
    const tradeNo = generateMerchantTradeNo({
      bookingId: "abc-def-ghi-jkl",
      now: 1000,
    });
    // Hyphens must not appear — ECPay rejects non-alphanumeric MerchantTradeNo
    expect(tradeNo).not.toContain("-");
  });

  it("pads short bookingIds to keep length stable", () => {
    const tradeNo = generateMerchantTradeNo({ bookingId: "abc", now: 1000 });
    expect(tradeNo.length).toBe(19);
  });
});

describe("formatMerchantTradeDate", () => {
  it("formats UTC instant as Taipei yyyy/MM/dd HH:mm:ss", () => {
    // 2026-04-15 08:00:00 UTC = 2026-04-15 16:00:00 Taipei (+8)
    const utc = new Date(Date.UTC(2026, 3, 15, 8, 0, 0));
    expect(formatMerchantTradeDate(utc)).toBe("2026/04/15 16:00:00");
  });

  it("handles midnight rollover without '24:00:00' artifact", () => {
    // 2026-04-14 16:00:00 UTC = 2026-04-15 00:00:00 Taipei
    const utc = new Date(Date.UTC(2026, 3, 14, 16, 0, 0));
    const formatted = formatMerchantTradeDate(utc);
    expect(formatted).toBe("2026/04/15 00:00:00");
    expect(formatted).not.toContain("24:");
  });

  it("zero-pads single-digit month/day/hour/minute/second", () => {
    // 2026-01-02 00:05:09 UTC = 2026-01-02 08:05:09 Taipei
    const utc = new Date(Date.UTC(2026, 0, 2, 0, 5, 9));
    expect(formatMerchantTradeDate(utc)).toBe("2026/01/02 08:05:09");
  });
});
