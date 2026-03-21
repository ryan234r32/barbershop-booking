import { describe, it, expect, vi, afterEach } from "vitest";
import { getCancellationPolicy } from "@/lib/booking/cancellation";

// Helper: create a Date at a specific Taipei-like local time.
// We pass currentTime explicitly so we don't need to mock nowTaipei().
function makeDate(year: number, month: number, day: number, hour = 0, minute = 0): Date {
  return new Date(year, month - 1, day, hour, minute, 0);
}

describe("getCancellationPolicy", () => {
  it("allows free cancellation when cancelling the previous day", () => {
    const bookingDate = makeDate(2026, 3, 15); // March 15
    const currentTime = makeDate(2026, 3, 14, 18, 0); // March 14, 6PM

    const result = getCancellationPolicy({
      bookingDate,
      bookingTime: "14:00",
      currentTime,
    });

    expect(result.canCancelOnline).toBe(true);
    expect(result.isViolation).toBe(false);
  });

  it("disallows online cancel during same-day business hours", () => {
    const bookingDate = makeDate(2026, 3, 15);
    const currentTime = makeDate(2026, 3, 15, 14, 0); // Same day, 2PM (within 11-20)

    const result = getCancellationPolicy({
      bookingDate,
      bookingTime: "16:00",
      currentTime,
    });

    expect(result.canCancelOnline).toBe(false);
    expect(result.isViolation).toBe(true);
    expect(result.reason).toContain("致電");
  });

  it("provides shop phone number when must-call policy applies", () => {
    const bookingDate = makeDate(2026, 3, 15);
    const currentTime = makeDate(2026, 3, 15, 12, 0);

    const result = getCancellationPolicy({
      bookingDate,
      bookingTime: "15:00",
      currentTime,
      shopPhone: "02-1234-5678",
    });

    expect(result.canCancelOnline).toBe(false);
    expect(result.phoneNumber).toBe("02-1234-5678");
  });

  it("allows online cancel same-day after business hours but marks violation", () => {
    const bookingDate = makeDate(2026, 3, 15);
    const currentTime = makeDate(2026, 3, 15, 21, 0); // 9PM, after 20:00 close

    const result = getCancellationPolicy({
      bookingDate,
      bookingTime: "14:00",
      currentTime,
    });

    expect(result.canCancelOnline).toBe(true);
    expect(result.isViolation).toBe(true);
    expect(result.reason).toContain("違規");
  });

  it("allows online cancel same-day before business hours and marks violation", () => {
    const bookingDate = makeDate(2026, 3, 15);
    const currentTime = makeDate(2026, 3, 15, 9, 0); // 9AM, before 11:00 open

    const result = getCancellationPolicy({
      bookingDate,
      bookingTime: "14:00",
      currentTime,
    });

    expect(result.canCancelOnline).toBe(true);
    expect(result.isViolation).toBe(true);
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

  it("respects custom business hours", () => {
    const bookingDate = makeDate(2026, 3, 15);
    // 14:00 is within default hours but outside custom 15:00-19:00
    const currentTime = makeDate(2026, 3, 15, 14, 0);

    const result = getCancellationPolicy({
      bookingDate,
      bookingTime: "16:00",
      currentTime,
      businessHoursStart: "15:00",
      businessHoursEnd: "19:00",
    });

    // 14:00 is outside custom business hours → online OK but violation
    expect(result.canCancelOnline).toBe(true);
    expect(result.isViolation).toBe(true);
  });

  it("marks same-day at exactly business hours start as during business hours", () => {
    const bookingDate = makeDate(2026, 3, 15);
    const currentTime = makeDate(2026, 3, 15, 11, 0); // exactly 11:00

    const result = getCancellationPolicy({
      bookingDate,
      bookingTime: "15:00",
      currentTime,
    });

    // 11:00 is >= 11 and < 20, so within business hours → must call
    expect(result.canCancelOnline).toBe(false);
    expect(result.isViolation).toBe(true);
  });
});
