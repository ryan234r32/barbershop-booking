import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import {
  formatTime,
  parseTimeToHour,
  compareTime,
  addHours,
  isSameDay,
  isWithinBusinessHours,
  formatDateToISO,
  getDayOfWeek,
  todayInTaipei,
} from "@/lib/utils/time";

describe("formatTime", () => {
  it("formats midnight as 00:00", () => {
    expect(formatTime(new Date(2026, 0, 1, 0, 0))).toBe("00:00");
  });

  it("formats afternoon time with padding", () => {
    expect(formatTime(new Date(2026, 0, 1, 9, 5))).toBe("09:05");
  });

  it("formats 24-hour time correctly", () => {
    expect(formatTime(new Date(2026, 0, 1, 14, 30))).toBe("14:30");
  });

  it("formats business hours start", () => {
    expect(formatTime(new Date(2026, 0, 1, 11, 0))).toBe("11:00");
  });

  it("formats business hours end", () => {
    expect(formatTime(new Date(2026, 0, 1, 20, 0))).toBe("20:00");
  });
});

describe("parseTimeToHour", () => {
  it("parses 11:00 to 11", () => {
    expect(parseTimeToHour("11:00")).toBe(11);
  });

  it("parses 09:00 to 9", () => {
    expect(parseTimeToHour("09:00")).toBe(9);
  });

  it("parses 20:00 to 20", () => {
    expect(parseTimeToHour("20:00")).toBe(20);
  });

  it("parses 00:00 to 0", () => {
    expect(parseTimeToHour("00:00")).toBe(0);
  });
});

describe("compareTime", () => {
  it("returns negative when first time is earlier", () => {
    expect(compareTime("11:00", "14:00")).toBeLessThan(0);
  });

  it("returns positive when first time is later", () => {
    expect(compareTime("18:00", "12:00")).toBeGreaterThan(0);
  });

  it("returns zero for same time", () => {
    expect(compareTime("14:00", "14:00")).toBe(0);
  });
});

describe("addHours", () => {
  it("adds 1 hour to 11:00", () => {
    expect(addHours("11:00", 1)).toBe("12:00");
  });

  it("adds 3 hours for a perm service", () => {
    expect(addHours("14:00", 3)).toBe("17:00");
  });

  it("adds 4 hours for a straightening service", () => {
    expect(addHours("11:00", 4)).toBe("15:00");
  });

  it("handles crossing into evening hours", () => {
    expect(addHours("18:00", 2)).toBe("20:00");
  });
});

describe("isSameDay", () => {
  it("returns true for same date different times", () => {
    const a = new Date(2026, 2, 15, 9, 0);
    const b = new Date(2026, 2, 15, 21, 0);
    expect(isSameDay(a, b)).toBe(true);
  });

  it("returns false for different dates", () => {
    const a = new Date(2026, 2, 14, 23, 59);
    const b = new Date(2026, 2, 15, 0, 1);
    expect(isSameDay(a, b)).toBe(false);
  });

  it("returns true for exact same timestamp", () => {
    const d = new Date(2026, 2, 15, 14, 0);
    expect(isSameDay(d, d)).toBe(true);
  });
});

describe("isWithinBusinessHours", () => {
  it("returns true for time within default hours (11:00-20:00)", () => {
    expect(isWithinBusinessHours("14:00", "11:00", "20:00")).toBe(true);
  });

  it("returns true at exactly start time", () => {
    expect(isWithinBusinessHours("11:00", "11:00", "20:00")).toBe(true);
  });

  it("returns false at exactly end time", () => {
    expect(isWithinBusinessHours("20:00", "11:00", "20:00")).toBe(false);
  });

  it("returns false before business hours", () => {
    expect(isWithinBusinessHours("09:00", "11:00", "20:00")).toBe(false);
  });

  it("returns false after business hours", () => {
    expect(isWithinBusinessHours("21:00", "11:00", "20:00")).toBe(false);
  });

  it("works with custom business hours", () => {
    expect(isWithinBusinessHours("10:00", "10:00", "18:00")).toBe(true);
    expect(isWithinBusinessHours("18:00", "10:00", "18:00")).toBe(false);
  });
});

describe("formatDateToISO", () => {
  it("formats date as YYYY-MM-DD", () => {
    const date = new Date(2026, 2, 15);
    expect(formatDateToISO(date)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("zero-pads single-digit months", () => {
    const date = new Date(2026, 0, 5); // January 5
    const result = formatDateToISO(date);
    expect(result).toContain("-01-");
  });
});

/**
 * Regression: TZ-AFTERNOON-DAYSHIFT (2026-04-27)
 * On Vercel (UTC server) during Taipei afternoon (16:00–24:00 Taipei,
 * 08:00–16:00 UTC), the legacy nowTaipei().toLocaleDateString({ timeZone })
 * returned tomorrow's date instead of today, falsely rejecting same-day
 * bookings with "預約日期不可為過去".
 *
 * Root cause: nowTaipei() builds a Date from a Taipei-zoned string, which
 * on a UTC server is parsed as UTC, double-shifting the moment by +8h.
 *
 * todayInTaipei() formats `new Date()` directly with the timeZone option —
 * no intermediate string-then-parse, so it's robust on any server TZ.
 */
describe("todayInTaipei() — TZ-safe today computation", () => {
  beforeAll(() => {
    vi.useFakeTimers();
  });
  afterAll(() => {
    vi.useRealTimers();
  });

  it("returns today during Taipei afternoon (UTC 08:00 = Taipei 16:00) — buggy nowTaipei() returned next day", () => {
    vi.setSystemTime(new Date("2026-04-27T08:00:00.000Z"));
    expect(todayInTaipei()).toBe("2026-04-27");
  });

  it("returns today during Taipei evening (UTC 14:00 = Taipei 22:00)", () => {
    vi.setSystemTime(new Date("2026-04-27T14:00:00.000Z"));
    expect(todayInTaipei()).toBe("2026-04-27");
  });

  it("returns next-day after crossing Taipei midnight (UTC 16:30 = Taipei 00:30 next day)", () => {
    vi.setSystemTime(new Date("2026-04-27T16:30:00.000Z"));
    expect(todayInTaipei()).toBe("2026-04-28");
  });

  it("returns today during Taipei morning (UTC 02:00 = Taipei 10:00)", () => {
    vi.setSystemTime(new Date("2026-04-27T02:00:00.000Z"));
    expect(todayInTaipei()).toBe("2026-04-27");
  });

  it("handles UTC pre-08:00 boundary (UTC 26 20:00 = Taipei 27 04:00)", () => {
    vi.setSystemTime(new Date("2026-04-26T20:00:00.000Z"));
    expect(todayInTaipei()).toBe("2026-04-27");
  });
});

describe("getDayOfWeek", () => {
  it("returns 0 for Sunday", () => {
    // 2026-03-22 is a Sunday
    const sunday = new Date(2026, 2, 22, 12, 0);
    expect(getDayOfWeek(sunday)).toBe(0);
  });

  it("returns 1 for Monday (closed day)", () => {
    // 2026-03-23 is a Monday
    const monday = new Date(2026, 2, 23, 12, 0);
    expect(getDayOfWeek(monday)).toBe(1);
  });

  it("returns 6 for Saturday", () => {
    // 2026-03-28 is a Saturday
    const saturday = new Date(2026, 2, 28, 12, 0);
    expect(getDayOfWeek(saturday)).toBe(6);
  });
});
