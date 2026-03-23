import { describe, it, expect } from "vitest";
import {
  TIMEZONE,
  SLOT_DURATION_MINUTES,
  DEFAULT_BUSINESS_HOURS,
  generateAllSlots,
  MAX_VIOLATIONS,
  VIOLATION_RESTRICTION_MONTHS,
  AT_RISK_DAYS,
  LAPSED_DAYS,
  BOOKING_LOCK_TTL_MS,
} from "@/lib/utils/constants";

describe("business constants", () => {
  it("uses Asia/Taipei timezone", () => {
    expect(TIMEZONE).toBe("Asia/Taipei");
  });

  it("has 60-minute slot duration", () => {
    expect(SLOT_DURATION_MINUTES).toBe(60);
  });

  it("has default business hours 11:00-20:00", () => {
    expect(DEFAULT_BUSINESS_HOURS.startTime).toBe("11:00");
    expect(DEFAULT_BUSINESS_HOURS.endTime).toBe("20:00");
  });

  it("restricts after 3 violations", () => {
    expect(MAX_VIOLATIONS).toBe(3);
  });

  it("restricts for 1 month", () => {
    expect(VIOLATION_RESTRICTION_MONTHS).toBe(1);
  });

  it("marks at-risk after 60 days inactive", () => {
    expect(AT_RISK_DAYS).toBe(60);
  });

  it("marks lapsed after 120 days inactive", () => {
    expect(LAPSED_DAYS).toBe(120);
  });

  it("has 10-second booking lock TTL", () => {
    expect(BOOKING_LOCK_TTL_MS).toBe(10_000);
  });
});

describe("generateAllSlots", () => {
  it("generates 9 slots for default business hours (11:00-20:00)", () => {
    const slots = generateAllSlots("11:00", "20:00");
    expect(slots).toHaveLength(9);
    expect(slots[0]).toBe("11:00");
    expect(slots[8]).toBe("19:00");
  });

  it("does not include the end hour (20:00)", () => {
    const slots = generateAllSlots("11:00", "20:00");
    expect(slots).not.toContain("20:00");
  });

  it("generates correct sequence", () => {
    const slots = generateAllSlots("11:00", "20:00");
    expect(slots).toEqual([
      "11:00", "12:00", "13:00", "14:00", "15:00",
      "16:00", "17:00", "18:00", "19:00",
    ]);
  });

  it("handles custom hours", () => {
    const slots = generateAllSlots("09:00", "13:00");
    expect(slots).toEqual(["09:00", "10:00", "11:00", "12:00"]);
  });

  it("returns empty array when start equals end", () => {
    const slots = generateAllSlots("11:00", "11:00");
    expect(slots).toEqual([]);
  });

  it("handles single-slot window", () => {
    const slots = generateAllSlots("14:00", "15:00");
    expect(slots).toEqual(["14:00"]);
  });

  it("zero-pads single-digit hours", () => {
    const slots = generateAllSlots("08:00", "10:00");
    expect(slots).toEqual(["08:00", "09:00"]);
  });
});
