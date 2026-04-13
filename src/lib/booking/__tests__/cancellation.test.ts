import { describe, it, expect } from "vitest";
import { getCancellationPolicy } from "@/lib/booking/cancellation";

// Helper: create a Date at a specific Taipei-like local time.
function makeDate(year: number, month: number, day: number, hour = 0, minute = 0): Date {
  return new Date(year, month - 1, day, hour, minute, 0);
}

describe("getCancellationPolicy", () => {
  // --- New 24h rule tests ---

  it("allows free cancellation when ≥ 24h before appointment", () => {
    const bookingDate = makeDate(2026, 3, 15); // March 15
    const currentTime = makeDate(2026, 3, 14, 10, 0); // March 14, 10AM (28h before 14:00 booking)

    const result = getCancellationPolicy({
      bookingDate,
      bookingTime: "14:00",
      currentTime,
    });

    expect(result.canCancelOnline).toBe(true);
    expect(result.isViolation).toBe(false);
  });

  it("disallows online cancel when < 24h and during business hours", () => {
    const bookingDate = makeDate(2026, 3, 15);
    const currentTime = makeDate(2026, 3, 14, 15, 0); // March 14, 3PM (23h before 14:00 booking)

    const result = getCancellationPolicy({
      bookingDate,
      bookingTime: "14:00",
      currentTime,
    });

    expect(result.canCancelOnline).toBe(false);
    expect(result.isViolation).toBe(false); // Only no-show counts as violation
    expect(result.reason).toContain("致電");
  });

  it("provides shop phone number when must-call policy applies", () => {
    const bookingDate = makeDate(2026, 3, 15);
    const currentTime = makeDate(2026, 3, 14, 15, 0); // < 24h

    const result = getCancellationPolicy({
      bookingDate,
      bookingTime: "14:00",
      currentTime,
      shopPhone: "02-1234-5678",
    });

    expect(result.canCancelOnline).toBe(false);
    expect(result.phoneNumber).toBe("02-1234-5678");
  });

  it("disallows online cancel when < 24h and outside business hours", () => {
    const bookingDate = makeDate(2026, 3, 15);
    const currentTime = makeDate(2026, 3, 14, 21, 0); // 9PM, < 24h before 14:00 booking, after hours

    const result = getCancellationPolicy({
      bookingDate,
      bookingTime: "14:00",
      currentTime,
    });

    expect(result.canCancelOnline).toBe(false);
    expect(result.isViolation).toBe(false);
    expect(result.reason).toContain("營業時間");
  });

  it("treats cancellation days in advance as free", () => {
    const bookingDate = makeDate(2026, 3, 20);
    const currentTime = makeDate(2026, 3, 14, 10, 0); // 6 days before

    const result = getCancellationPolicy({
      bookingDate,
      bookingTime: "11:00",
      currentTime,
    });

    expect(result.canCancelOnline).toBe(true);
    expect(result.isViolation).toBe(false);
  });

  it("allows cancel at exactly 24h before appointment", () => {
    const bookingDate = makeDate(2026, 3, 15);
    const currentTime = makeDate(2026, 3, 14, 14, 0); // Exactly 24h before 14:00 booking

    const result = getCancellationPolicy({
      bookingDate,
      bookingTime: "14:00",
      currentTime,
    });

    expect(result.canCancelOnline).toBe(true);
    expect(result.isViolation).toBe(false);
  });

  it("disallows cancel at 23h59m before appointment", () => {
    const bookingDate = makeDate(2026, 3, 15);
    const currentTime = makeDate(2026, 3, 14, 14, 1); // 23h59m before 14:00 booking, during business hours

    const result = getCancellationPolicy({
      bookingDate,
      bookingTime: "14:00",
      currentTime,
    });

    expect(result.canCancelOnline).toBe(false);
    expect(result.isViolation).toBe(false);
  });

  it("never marks cancellation as violation (only no-show is violation)", () => {
    // Same-day cancel during business hours
    const bookingDate = makeDate(2026, 3, 15);
    const currentTime = makeDate(2026, 3, 15, 12, 0);

    const result = getCancellationPolicy({
      bookingDate,
      bookingTime: "14:00",
      currentTime,
    });

    expect(result.isViolation).toBe(false); // Key change: no cancellation is a violation
  });
});
