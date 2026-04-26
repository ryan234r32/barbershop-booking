/**
 * Time-range computation for the reports page (PRD-v3 §10.2).
 *
 * Given a range type (week/month/quarter/year) and an offset (0=current,
 * -1=previous, ...), returns the [from, to] window in Asia/Taipei timezone
 * + a label for display.
 *
 * All math done relative to Taipei midnight to avoid UTC drift surprises.
 */

import { nowTaipei } from "@/lib/utils/time";
import { TIMEZONE } from "@/lib/utils/constants";

export type RangeType = "week" | "month" | "quarter" | "year";

export interface TimeRange {
  type: RangeType;
  offset: number;
  from: Date;
  to: Date;
  label: string;
  /** ISO yyyy-mm-dd for from/to — convenient for UI display */
  fromIso: string;
  toIso: string;
}

function ymd(d: Date): { y: number; m: number; d: number } {
  const iso = d.toLocaleDateString("en-CA", { timeZone: TIMEZONE });
  const [y, m, day] = iso.split("-").map(Number);
  return { y, m, d: day };
}

function taipeiDate(y: number, m: number, d: number): Date {
  // Construct a UTC instant equal to Taipei midnight (UTC+8) of (y, m, d).
  return new Date(Date.UTC(y, m - 1, d, -8, 0, 0));
}

function endOfTaipeiDay(y: number, m: number, d: number): Date {
  // Taipei 23:59:59.999 → UTC 15:59:59.999 of same date
  return new Date(Date.UTC(y, m - 1, d, 15, 59, 59, 999));
}

function isoOf(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: TIMEZONE });
}

/** Mon-anchored day-of-week (Mon=0..Sun=6). */
function dayOfWeekMonAnchored(d: Date): number {
  const taipeiInstant = new Date(d.toLocaleString("en-US", { timeZone: TIMEZONE }));
  const sunBased = taipeiInstant.getDay();
  return (sunBased + 6) % 7;
}

export function computeRange(type: RangeType, offset = 0): TimeRange {
  const now = nowTaipei();
  const { y, m, d } = ymd(now);

  if (type === "week") {
    // Find Monday of current week
    const dow = dayOfWeekMonAnchored(now);
    const monday = new Date(y, m - 1, d - dow + offset * 7);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const mp = ymd(monday);
    const sp = ymd(sunday);
    const from = taipeiDate(mp.y, mp.m, mp.d);
    const to = endOfTaipeiDay(sp.y, sp.m, sp.d);
    const label =
      offset === 0
        ? "本週"
        : offset === -1
          ? "上週"
          : `${mp.m}/${mp.d}–${sp.m}/${sp.d}`;
    return { type, offset, from, to, label, fromIso: isoOf(from), toIso: isoOf(to) };
  }

  if (type === "month") {
    const target = new Date(y, m - 1 + offset, 1);
    const next = new Date(target.getFullYear(), target.getMonth() + 1, 0);
    const from = taipeiDate(target.getFullYear(), target.getMonth() + 1, 1);
    const to = endOfTaipeiDay(next.getFullYear(), next.getMonth() + 1, next.getDate());
    const label =
      offset === 0 ? "本月" : offset === -1 ? "上月" : `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, "0")}`;
    return { type, offset, from, to, label, fromIso: isoOf(from), toIso: isoOf(to) };
  }

  if (type === "quarter") {
    // Current quarter = Math.floor((m-1)/3); Q1=0, Q2=1, Q3=2, Q4=3
    const currentQuarter = Math.floor((m - 1) / 3);
    const targetQuarterIndex = currentQuarter + offset;
    const targetYear = y + Math.floor(targetQuarterIndex / 4);
    const normalisedQuarter = ((targetQuarterIndex % 4) + 4) % 4;
    const startMonth = normalisedQuarter * 3 + 1;
    const endMonth = startMonth + 2;
    const lastDayOfQuarter = new Date(targetYear, endMonth, 0).getDate();
    const from = taipeiDate(targetYear, startMonth, 1);
    const to = endOfTaipeiDay(targetYear, endMonth, lastDayOfQuarter);
    const label =
      offset === 0
        ? "本季"
        : offset === -1
          ? "上季"
          : `${targetYear} Q${normalisedQuarter + 1}`;
    return { type, offset, from, to, label, fromIso: isoOf(from), toIso: isoOf(to) };
  }

  // year
  const targetYear = y + offset;
  const from = taipeiDate(targetYear, 1, 1);
  const to = endOfTaipeiDay(targetYear, 12, 31);
  const label = offset === 0 ? "今年" : offset === -1 ? "去年" : String(targetYear);
  return { type, offset, from, to, label, fromIso: isoOf(from), toIso: isoOf(to) };
}

/** Returns the "previous period" of the same length — for 同期 ±% comparison. */
export function previousPeriod(r: TimeRange): TimeRange {
  return computeRange(r.type, r.offset - 1);
}

/** Number of days the range covers (for 佔用率 denominator). */
export function rangeDays(r: TimeRange): number {
  return Math.round((r.to.getTime() - r.from.getTime()) / (24 * 60 * 60 * 1000));
}
