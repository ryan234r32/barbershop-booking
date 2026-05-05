/**
 * V3.6 reports aggregations — the new metrics layered on top of the V3.5
 * computeTotals/computeRetention base.
 *
 * V3.6 plan §4.3: prebookRate, alerts, RFM grid, YoY 12-month, monthly target,
 * natural-language summary. All read-only (Prisma findMany), no writes.
 *
 * Range conventions match {@link TimeRange} in `../time-range.ts`.
 */

import { prisma } from "@/lib/prisma";
import type { TimeRange, RangeType } from "../time-range";
import { computeRange } from "../time-range";

const TIMEZONE = "Asia/Taipei";
const ACTIVE_STATUSES = ["CONFIRMED", "COMPLETED"] as const;
const PAID_STATUSES = ["COMPLETED"] as const;

function isoDate(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: TIMEZONE });
}

/**
 * Build N past weekly date ranges (UTC, Taipei-aligned) for the same weekday
 * as (y, m, d). Each range is `[pStart, pEnd]` where pStart is the previous
 * day at 16:00 UTC (= Taipei 00:00) and pEnd is the same day at 15:59:59.999
 * UTC (= Taipei 23:59:59.999). Index 0 = 7 days ago, index N-1 = 7N days ago.
 *
 * Extracted from `computeDailyView` so the parallel-await refactor (V3.8 perf)
 * has a regression-testable boundary — the date math used to live inline in
 * a serial for-loop and any drift here would silently corrupt the 4-week
 * comparison median on the daily view.
 */
export function pastWeeklyRanges(
  y: number,
  m: number,
  d: number,
  weeks: number,
): Array<{ pStart: Date; pEnd: Date }> {
  return Array.from({ length: weeks }, (_, idx) => {
    const i = idx + 1;
    const past = new Date(Date.UTC(y, m - 1, d - 7 * i));
    const pY = past.getUTCFullYear();
    const pM = past.getUTCMonth() + 1;
    const pD = past.getUTCDate();
    return {
      pStart: new Date(Date.UTC(pY, pM - 1, pD, -8, 0, 0)),
      pEnd: new Date(Date.UTC(pY, pM - 1, pD, 15, 59, 59, 999)),
    };
  });
}

// ─── Pre-book Rate ───────────────────────────────────────────────────────
//
// Definition (V3.6 §4.1): % of COMPLETED bookings whose customer also has a
// FUTURE booking that was created within 0-2 hours of checkout. Captures the
// "離店再預約" behavior — industry's #1 retention KPI.

export interface PrebookRateResult {
  rate: number;            // 0-100
  prebookCount: number;    // numerator (bookings flagged prebookSource=true within range)
  completedCount: number;  // denominator (COMPLETED in range)
}

export async function computePrebookRate(
  tenantId: string,
  range: TimeRange,
): Promise<PrebookRateResult> {
  const completed = await prisma.booking.findMany({
    where: {
      tenantId,
      date: { gte: range.from, lte: range.to },
      status: { in: [...PAID_STATUSES] },
    },
    select: { id: true, userId: true, checkedInAt: true, updatedAt: true },
  });

  if (completed.length === 0) {
    return { rate: 0, prebookCount: 0, completedCount: 0 };
  }

  // For each completed booking, find any FUTURE booking (date > completed.date)
  // whose createdAt falls within [checkedInAt, checkedInAt + 2h]. If yes, the
  // customer pre-booked at checkout.
  const userIds = [...new Set(completed.map((b) => b.userId))];
  const followups = await prisma.booking.findMany({
    where: {
      tenantId,
      userId: { in: userIds },
      status: { in: [...ACTIVE_STATUSES] },
    },
    select: { userId: true, date: true, createdAt: true },
  });

  // V3.8 perf (Wave 3 / B3): O(N×M) → O(N+M).
  // Old code did followups.some() inside the for-loop, scanning the full
  // followups array once per completed booking. At 1169 prod bookings that's
  // ~300×1000 = 300K comparisons (still <30ms in V8 but quadratic in data
  // growth — at 10x scale it's 30M ops and noticeable). Pre-grouping by
  // userId makes the inner loop scan only that user's followups.
  const followupsByUser = new Map<string, Array<{ date: Date; createdAt: Date }>>();
  for (const f of followups) {
    let bucket = followupsByUser.get(f.userId);
    if (!bucket) {
      bucket = [];
      followupsByUser.set(f.userId, bucket);
    }
    bucket.push({ date: f.date, createdAt: f.createdAt });
  }

  let prebookCount = 0;
  for (const c of completed) {
    const anchor = c.checkedInAt ?? c.updatedAt;
    const userFollowups = followupsByUser.get(c.userId);
    if (!userFollowups) continue;
    if (hasPrebookHit(anchor.getTime(), userFollowups)) prebookCount++;
  }

  return {
    rate: Math.round((prebookCount / completed.length) * 1000) / 10,
    prebookCount,
    completedCount: completed.length,
  };
}

/**
 * Pure-function version of the prebook hit-detection inner loop. Exported so
 * the V3.8 B3 refactor (Map preprocessing) has a regression-testable boundary.
 *
 * Returns true if `userFollowups` contains a future booking whose createdAt
 * falls within the post-checkout 2-hour window anchored at `anchorMs`.
 */
export function hasPrebookHit(
  anchorMs: number,
  userFollowups: ReadonlyArray<{ date: Date; createdAt: Date }>,
): boolean {
  return userFollowups.some(
    (f) =>
      f.date.getTime() > anchorMs &&
      f.createdAt.getTime() >= anchorMs &&
      f.createdAt.getTime() <= anchorMs + 2 * 3600 * 1000,
  );
}

// ─── RFM Segments (V3.6 §4.4) ────────────────────────────────────────────
//
// Threshold (post Q1 confirmation):
//   Champion:   Recency<30d  AND Frequency≥5/yr  AND Monetary≥6000/yr
//   Loyal:      Recency<60d  AND Frequency≥4/yr  AND Monetary≥3000/yr
//   New:        Recency<90d  AND Frequency 1-3/yr
//   At Risk:    Recency 60-180d AND Frequency≥2/yr
//   Lost:       Recency>180d
// Tie-breaker order: Champion > Loyal > At Risk > New > Lost.

export type RfmSegment = "champion" | "loyal" | "newCustomer" | "atRisk" | "lost";

export interface RfmGrid {
  champion: number;
  loyal: number;
  newCustomer: number;
  atRisk: number;
  lost: number;
  total: number;
  /** convenience: each segment as percentage of total, 1 decimal */
  pct: Record<RfmSegment, number>;
}

export async function computeRfmSegments(
  tenantId: string,
  /** anchor date — RFM is point-in-time, range supplies the "now" for recency */
  range: TimeRange,
): Promise<RfmGrid> {
  const anchorMs = range.to.getTime();
  const yearAgo = new Date(anchorMs - 365 * 24 * 3600 * 1000);

  // Pull every active booking in the last 365 days with revenue contribution.
  const bookings = await prisma.booking.findMany({
    where: {
      tenantId,
      date: { gte: yearAgo, lte: range.to },
      status: { in: [...ACTIVE_STATUSES] },
    },
    select: {
      userId: true,
      date: true,
      service: { select: { price: true } },
      payment: { select: { amount: true, status: true } },
    },
  });

  type Acc = { lastVisit: Date; visits: number; spend: number };
  const byUser = new Map<string, Acc>();
  for (const b of bookings) {
    const acc = byUser.get(b.userId) ?? { lastVisit: b.date, visits: 0, spend: 0 };
    if (b.date.getTime() > acc.lastVisit.getTime()) acc.lastVisit = b.date;
    acc.visits++;
    if (b.payment?.amount && b.payment.status === "RECEIVED") acc.spend += b.payment.amount;
    else acc.spend += b.service.price;
    byUser.set(b.userId, acc);
  }

  const grid: RfmGrid = {
    champion: 0, loyal: 0, newCustomer: 0, atRisk: 0, lost: 0,
    total: 0,
    pct: { champion: 0, loyal: 0, newCustomer: 0, atRisk: 0, lost: 0 },
  };

  for (const acc of byUser.values()) {
    const recencyDays = Math.round((anchorMs - acc.lastVisit.getTime()) / (24 * 3600 * 1000));
    const seg = classifyRfm(recencyDays, acc.visits, acc.spend);
    grid[seg]++;
    grid.total++;
  }

  // Pct (1 decimal)
  if (grid.total > 0) {
    for (const k of ["champion", "loyal", "newCustomer", "atRisk", "lost"] as const) {
      grid.pct[k] = Math.round((grid[k] / grid.total) * 1000) / 10;
    }
  }

  return grid;
}

export function classifyRfm(
  recencyDays: number,
  freqPerYear: number,
  spendPerYear: number,
): RfmSegment {
  if (recencyDays < 30 && freqPerYear >= 5 && spendPerYear >= 6000) return "champion";
  if (recencyDays < 60 && freqPerYear >= 4 && spendPerYear >= 3000) return "loyal";
  if (recencyDays >= 60 && recencyDays <= 180 && freqPerYear >= 2) return "atRisk";
  if (recencyDays < 90 && freqPerYear >= 1 && freqPerYear <= 3) return "newCustomer";
  return "lost";
}

// ─── Monthly Target tracking (V3.6 §4.2) ─────────────────────────────────

export interface MonthlyTargetResult {
  targetRevenue: number | null;  // null = no target set for this month
  actualRevenue: number;
  achievementRate: number;        // 0-100 (capped at 200 for display)
  /** Days elapsed in month vs total days — for pace check */
  paceExpectedRate: number;       // expected achievement rate by today
}

export async function computeMonthlyTarget(
  tenantId: string,
  range: TimeRange,
  todayIso: string,  // for pace calculation
): Promise<MonthlyTargetResult> {
  if (range.type !== "month") {
    return { targetRevenue: null, actualRevenue: 0, achievementRate: 0, paceExpectedRate: 0 };
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { monthlyTargets: true },
  });

  const targets = (tenant?.monthlyTargets as Record<string, number> | null) ?? {};
  const fromIso = range.fromIso; // YYYY-MM-DD
  const monthKey = fromIso.slice(0, 7); // YYYY-MM
  const targetRevenue = typeof targets[monthKey] === "number" ? targets[monthKey] : null;

  // Compute actual revenue
  const bookings = await prisma.booking.findMany({
    where: {
      tenantId,
      date: { gte: range.from, lte: range.to },
      status: { in: [...PAID_STATUSES] },
    },
    select: {
      service: { select: { price: true } },
      payment: { select: { amount: true, status: true } },
    },
  });
  let actualRevenue = 0;
  for (const b of bookings) {
    if (b.payment?.amount && b.payment.status === "RECEIVED") actualRevenue += b.payment.amount;
    else actualRevenue += b.service.price;
  }

  if (!targetRevenue || targetRevenue <= 0) {
    return { targetRevenue: null, actualRevenue, achievementRate: 0, paceExpectedRate: 0 };
  }

  const achievementRate = Math.round((actualRevenue / targetRevenue) * 1000) / 10;

  // Pace: which day of month is "today" relative to month length
  const dayStr = todayIso.split("-")[2];
  const today = parseInt(dayStr, 10);
  const lastDay = parseInt(range.toIso.split("-")[2], 10);
  const isPastMonth = todayIso > range.toIso;
  const paceExpectedRate = isPastMonth
    ? 100
    : Math.round((today / lastDay) * 1000) / 10;

  return { targetRevenue, actualRevenue, achievementRate, paceExpectedRate };
}

// ─── YoY 12-month trend (V3.6 §4.1) ──────────────────────────────────────

export interface YoYPoint {
  month: string;        // "01"-"12"
  monthLabel: string;   // "1月" 等
  thisYear: number;
  lastYear: number;
  yoyPct: number | null; // null if lastYear === 0
}

export interface YoYResult {
  points: YoYPoint[];
  thisYearTotal: number;
  lastYearTotal: number;
  cumulativeYoyPct: number | null;
  hasLastYearData: boolean;
}

export async function computeYoYTrend(
  tenantId: string,
  /** the anchor year — points cover this entire calendar year */
  year: number,
): Promise<YoYResult> {
  // Pull both years in a single round-trip; window covers Jan-1 of last year
  // through Dec-31 of this year (Taipei wall-clock).
  const windowStart = new Date(Date.UTC(year - 1, 0, 1, -8, 0, 0));
  const windowEnd = new Date(Date.UTC(year, 11, 31, 15, 59, 59, 999));

  const all = await prisma.booking.findMany({
    where: {
      tenantId,
      date: { gte: windowStart, lte: windowEnd },
      status: { in: [...PAID_STATUSES] },
    },
    select: {
      date: true,
      service: { select: { price: true } },
      payment: { select: { amount: true, status: true } },
    },
  });

  // Aggregate by yyyy-mm
  const monthRev = new Map<string, number>();
  for (const b of all) {
    const iso = isoDate(b.date);
    const key = iso.slice(0, 7); // YYYY-MM
    const amount = b.payment?.amount && b.payment.status === "RECEIVED"
      ? b.payment.amount
      : b.service.price;
    monthRev.set(key, (monthRev.get(key) ?? 0) + amount);
  }

  let thisYearTotal = 0;
  let lastYearTotal = 0;
  const points: YoYPoint[] = [];
  for (let m = 1; m <= 12; m++) {
    const mm = String(m).padStart(2, "0");
    const t = monthRev.get(`${year}-${mm}`) ?? 0;
    const l = monthRev.get(`${year - 1}-${mm}`) ?? 0;
    thisYearTotal += t;
    lastYearTotal += l;
    const yoy = l > 0 ? Math.round(((t - l) / l) * 1000) / 10 : null;
    points.push({
      month: mm,
      monthLabel: `${m}月`,
      thisYear: t,
      lastYear: l,
      yoyPct: yoy,
    });
  }

  return {
    points,
    thisYearTotal,
    lastYearTotal,
    cumulativeYoyPct: lastYearTotal > 0
      ? Math.round(((thisYearTotal - lastYearTotal) / lastYearTotal) * 1000) / 10
      : null,
    hasLastYearData: lastYearTotal > 0,
  };
}

// ─── Alert engine (V3.6 §4.5) ────────────────────────────────────────────
//
// 5 rules, each emits at most 1 Alert object. Sorted red>yellow, take top 3.
// Plain shape so route can JSON-serialize.

export type AlertLevel = "red" | "yellow";
export interface Alert {
  id: string;             // stable rule id
  level: AlertLevel;
  title: string;          // 一句話標題
  detail: string;         // 數字 + 比較
  drillTo?: string;       // optional URL fragment for drill-down
}

export interface AlertContext {
  yoyTrailing3M: number | null;
  retention90: number;
  prebookRate: number;
  ticket: number;
  ticket12mAvg: number;
  monthlyActiveCustomers: number;
  monthlyActivePrev: number;
}

export function computeAlerts(ctx: AlertContext): Alert[] {
  const alerts: Alert[] = [];

  if (ctx.yoyTrailing3M !== null) {
    if (ctx.yoyTrailing3M < -15) {
      alerts.push({
        id: "yoy_3m_red",
        level: "red",
        title: "近 3 月營收嚴重下滑",
        detail: `YoY ${ctx.yoyTrailing3M.toFixed(1)}% — 跌幅超過 15% 警戒線，需立即介入`,
      });
    } else if (ctx.yoyTrailing3M < -10) {
      alerts.push({
        id: "yoy_3m_yellow",
        level: "yellow",
        title: "近 3 月營收下滑",
        detail: `YoY ${ctx.yoyTrailing3M.toFixed(1)}%，建議檢視染燙佔比 + 客單價`,
      });
    }
  }

  if (ctx.retention90 < 35) {
    alerts.push({
      id: "retention_red",
      level: "red",
      title: "新客 90 天回訪率過低",
      detail: `${ctx.retention90.toFixed(1)}% — 業界 50%+，表示首次體驗未抓住客戶`,
    });
  } else if (ctx.retention90 < 40) {
    alerts.push({
      id: "retention_yellow",
      level: "yellow",
      title: "新客 90 天回訪率偏低",
      detail: `${ctx.retention90.toFixed(1)}% — 與業界 50%+ 仍有差距`,
    });
  }

  if (ctx.prebookRate < 30) {
    alerts.push({
      id: "prebook_red",
      level: "red",
      title: "離店再預約率太低",
      detail: `僅 ${ctx.prebookRate.toFixed(1)}% — 業界 50%+，客戶離店即流失`,
    });
  } else if (ctx.prebookRate < 50) {
    alerts.push({
      id: "prebook_yellow",
      level: "yellow",
      title: "離店再預約率偏低",
      detail: `${ctx.prebookRate.toFixed(1)}% — 推到 50%+ 可大幅降低流失`,
    });
  }

  if (ctx.ticket12mAvg > 0) {
    const ticketDelta = ((ctx.ticket - ctx.ticket12mAvg) / ctx.ticket12mAvg) * 100;
    if (ticketDelta < -15) {
      alerts.push({
        id: "ticket_red",
        level: "red",
        title: "客單價大幅下滑",
        detail: `本月 NT$${ctx.ticket} vs 12 月均 NT$${Math.round(ctx.ticket12mAvg)} (${ticketDelta.toFixed(1)}%)`,
      });
    } else if (ticketDelta < -10) {
      alerts.push({
        id: "ticket_yellow",
        level: "yellow",
        title: "客單價下滑",
        detail: `本月 NT$${ctx.ticket} vs 12 月均 NT$${Math.round(ctx.ticket12mAvg)} (${ticketDelta.toFixed(1)}%)`,
      });
    }
  }

  if (ctx.monthlyActiveCustomers < 60 && ctx.monthlyActivePrev < 60) {
    alerts.push({
      id: "active_red",
      level: "red",
      title: "月活客戶數連 2 月低於 60",
      detail: `本月 ${ctx.monthlyActiveCustomers} / 上月 ${ctx.monthlyActivePrev} — 客戶池萎縮`,
    });
  } else if (ctx.monthlyActiveCustomers < 70) {
    alerts.push({
      id: "active_yellow",
      level: "yellow",
      title: "月活客戶數偏少",
      detail: `本月 ${ctx.monthlyActiveCustomers} 位 — 業界健康基準 70+`,
    });
  }

  // Sort red first, take top 3
  alerts.sort((a, b) => (a.level === b.level ? 0 : a.level === "red" ? -1 : 1));
  return alerts.slice(0, 3);
}

// ─── 12-month trailing helpers ───────────────────────────────────────────
//
// Used by alert engine. Trailing 3M YoY = sum(this 3M revenue) vs sum(same 3M
// last year). Ticket 12M avg = average of last 12 months ARPU.

export interface TrailingMetrics {
  yoyTrailing3M: number | null;
  ticket12mAvg: number;
}

export async function computeTrailingMetrics(
  tenantId: string,
  anchorIso: string,
): Promise<TrailingMetrics> {
  const [aY, aM] = anchorIso.split("-").map(Number);
  // 3M from current month back inclusive
  const fromTrailing = new Date(Date.UTC(aY, aM - 3, 1, -8, 0, 0));
  const toTrailing = new Date(Date.UTC(aY, aM, 0, 15, 59, 59, 999)); // last day of month aM
  const fromTrailingLast = new Date(Date.UTC(aY - 1, aM - 3, 1, -8, 0, 0));
  const toTrailingLast = new Date(Date.UTC(aY - 1, aM, 0, 15, 59, 59, 999));

  const [thisR, lastR] = await Promise.all([
    sumRevenue(tenantId, fromTrailing, toTrailing),
    sumRevenue(tenantId, fromTrailingLast, toTrailingLast),
  ]);

  const yoyTrailing3M = lastR > 0
    ? Math.round(((thisR - lastR) / lastR) * 1000) / 10
    : null;

  // Ticket 12M avg
  const from12 = new Date(Date.UTC(aY, aM - 12, 1, -8, 0, 0));
  const to12 = new Date(Date.UTC(aY, aM, 0, 15, 59, 59, 999));
  const bookings12 = await prisma.booking.findMany({
    where: {
      tenantId,
      date: { gte: from12, lte: to12 },
      status: { in: [...ACTIVE_STATUSES] },
    },
    select: {
      userId: true,
      service: { select: { price: true } },
      payment: { select: { amount: true, status: true } },
    },
  });
  if (bookings12.length === 0) {
    return { yoyTrailing3M, ticket12mAvg: 0 };
  }
  const userSet = new Set<string>();
  let rev12 = 0;
  for (const b of bookings12) {
    userSet.add(b.userId);
    if (b.payment?.amount && b.payment.status === "RECEIVED") rev12 += b.payment.amount;
    else rev12 += b.service.price;
  }
  const ticket12mAvg = userSet.size > 0 ? rev12 / userSet.size : 0;

  return { yoyTrailing3M, ticket12mAvg };
}

async function sumRevenue(
  tenantId: string,
  from: Date,
  to: Date,
): Promise<number> {
  const list = await prisma.booking.findMany({
    where: {
      tenantId,
      date: { gte: from, lte: to },
      status: { in: [...PAID_STATUSES] },
    },
    select: {
      service: { select: { price: true } },
      payment: { select: { amount: true, status: true } },
    },
  });
  let r = 0;
  for (const b of list) {
    if (b.payment?.amount && b.payment.status === "RECEIVED") r += b.payment.amount;
    else r += b.service.price;
  }
  return r;
}

// ─── 12-month sparkline (V3.6 §6.1 ③) ────────────────────────────────────

export interface MonthSpark {
  month: string;     // "YYYY-MM"
  label: string;     // "1月" / "12月"
  revenue: number;
  isCurrent: boolean;
  isPeak: boolean;
  isTrough: boolean;
}

export async function computeMonthlySparkline(
  tenantId: string,
  /** anchor month, e.g. "2026-04" */
  anchorMonthKey: string,
): Promise<MonthSpark[]> {
  const [yStr, mStr] = anchorMonthKey.split("-");
  const aY = parseInt(yStr, 10);
  const aM = parseInt(mStr, 10);

  const from = new Date(Date.UTC(aY, aM - 12, 1, -8, 0, 0));
  const to = new Date(Date.UTC(aY, aM, 0, 15, 59, 59, 999));

  const bookings = await prisma.booking.findMany({
    where: {
      tenantId,
      date: { gte: from, lte: to },
      status: { in: [...PAID_STATUSES] },
    },
    select: {
      date: true,
      service: { select: { price: true } },
      payment: { select: { amount: true, status: true } },
    },
  });

  const monthRev = new Map<string, number>();
  for (const b of bookings) {
    const key = isoDate(b.date).slice(0, 7);
    const amt = b.payment?.amount && b.payment.status === "RECEIVED"
      ? b.payment.amount
      : b.service.price;
    monthRev.set(key, (monthRev.get(key) ?? 0) + amt);
  }

  const points: MonthSpark[] = [];
  for (let i = 11; i >= 0; i--) {
    const idx = aY * 12 + (aM - 1) - i;
    const yy = Math.floor(idx / 12);
    const mm = (idx % 12) + 1;
    const key = `${yy}-${String(mm).padStart(2, "0")}`;
    points.push({
      month: key,
      label: `${mm}月`,
      revenue: monthRev.get(key) ?? 0,
      isCurrent: i === 0,
      isPeak: false,
      isTrough: false,
    });
  }

  // Mark peak / trough
  if (points.length > 0) {
    let max = -1, min = Number.POSITIVE_INFINITY;
    let maxIdx = 0, minIdx = 0;
    points.forEach((p, i) => {
      if (p.revenue > max) { max = p.revenue; maxIdx = i; }
      if (p.revenue < min) { min = p.revenue; minIdx = i; }
    });
    if (max > 0) points[maxIdx].isPeak = true;
    if (min !== max) points[minIdx].isTrough = true;
  }

  return points;
}

// ─── Natural-language summary engine (V3.6 §10 Q7) ───────────────────────
//
// 5 narrative × 5 rootCause × 3 action templates → ~75 combos.
// Returns a plain string with **bold** markdown-ish markers the UI can render.

export interface NarrativeContext {
  monthLabel: string;                  // "2026-04"
  revenue: number;
  momChangePct: number | null;          // vs 上月
  yoyChangePct: number | null;          // vs 去年同月
  ticket: number;
  ticket12mAvg: number;
  retention90: number;
  prebookRate: number;
  chemicalShare: number;                // % 染燙營收佔比
  chemicalShareLastMonth: number;
  occupancy: number;
  monthlyActive: number;
}

export type NarrativeKind =
  | "healthy_growth"
  | "declining"
  | "rebounding"
  | "flat"
  | "new_high";

export type RootCause =
  | "chemical_share_drop"
  | "new_retention_low"
  | "ticket_drop"
  | "occupancy_low"
  | "seasonal";

export function pickNarrative(ctx: NarrativeContext): NarrativeKind {
  const yoy = ctx.yoyChangePct ?? 0;
  const mom = ctx.momChangePct ?? 0;
  if (yoy >= 20) return "new_high";
  if (yoy >= 5 && mom >= 0) return "healthy_growth";
  if (yoy < -10) return "declining";
  if (yoy < 0 && mom > 5) return "rebounding";
  return "flat";
}

export function pickRootCause(ctx: NarrativeContext): RootCause {
  const chemicalDrop = ctx.chemicalShare - ctx.chemicalShareLastMonth;
  const ticketDelta = ctx.ticket12mAvg > 0
    ? ((ctx.ticket - ctx.ticket12mAvg) / ctx.ticket12mAvg) * 100
    : 0;

  if (chemicalDrop < -3) return "chemical_share_drop";
  if (ctx.retention90 < 40) return "new_retention_low";
  if (ticketDelta < -10) return "ticket_drop";
  if (ctx.occupancy < 60) return "occupancy_low";
  return "seasonal";
}

export function pickAction(narrative: NarrativeKind, cause: RootCause): string {
  const map: Record<RootCause, string> = {
    chemical_share_drop: "本月主動詢問每位客戶染燙意願 + 推進染燙促銷組合",
    new_retention_low: "啟用「離店再預約」流程：結帳當下直接幫客戶排下次",
    ticket_drop: "檢視價目表 + 推升級服務組合（剪+護髮、剪+染）",
    occupancy_low: "把週四下午 / 週六晚上的空檔靠社群推播填滿",
    seasonal: "順著季節節奏：旺季多排、淡季靠老客電話通知",
  };
  if (narrative === "new_high") return "守住節奏，把流量導入推升染燙佔比 → 將高峰拉長";
  if (narrative === "declining") return "立刻介入：" + map[cause];
  return map[cause];
}

export function renderSummary(ctx: NarrativeContext): string {
  const narr = pickNarrative(ctx);
  const cause = pickRootCause(ctx);
  const action = pickAction(narr, cause);

  const yoyStr = ctx.yoyChangePct !== null
    ? `${ctx.yoyChangePct >= 0 ? "+" : ""}${ctx.yoyChangePct.toFixed(1)}%`
    : "—";
  const momStr = ctx.momChangePct !== null
    ? `${ctx.momChangePct >= 0 ? "+" : ""}${ctx.momChangePct.toFixed(1)}%`
    : "—";

  const headline: Record<NarrativeKind, string> = {
    healthy_growth: `${ctx.monthLabel} **健康成長**：營收 NT$${ctx.revenue.toLocaleString()}（YoY ${yoyStr}、MoM ${momStr}）`,
    new_high: `${ctx.monthLabel} **創新高**！營收 NT$${ctx.revenue.toLocaleString()}（YoY ${yoyStr}）`,
    rebounding: `${ctx.monthLabel} **回升中**：營收 NT$${ctx.revenue.toLocaleString()}（MoM ${momStr}）`,
    declining: `${ctx.monthLabel} **下滑警訊**：營收 NT$${ctx.revenue.toLocaleString()}（YoY ${yoyStr}）`,
    flat: `${ctx.monthLabel} **持平**：營收 NT$${ctx.revenue.toLocaleString()}（YoY ${yoyStr}、MoM ${momStr}）`,
  };

  const causeText: Record<RootCause, string> = {
    chemical_share_drop: `主因：**染燙佔比下滑**（${ctx.chemicalShareLastMonth.toFixed(1)}% → ${ctx.chemicalShare.toFixed(1)}%），客單拉不起來`,
    new_retention_low: `主因：**新客 90 天回訪率僅 ${ctx.retention90.toFixed(1)}%**，第一次體驗沒留住人`,
    ticket_drop: `主因：**客單價 NT$${ctx.ticket}** vs 12 月均 NT$${Math.round(ctx.ticket12mAvg)}，服務組合需調整`,
    occupancy_low: `主因：**佔用率 ${ctx.occupancy.toFixed(1)}%** 偏低，產能沒填滿`,
    seasonal: `主因：**季節節奏正常**，依歷史慣性發展`,
  };

  return `💡 ${headline[narr]}。${causeText[cause]}。**行動建議**：${action}。`;
}

// ─── Annual scenarios (V3.6 §7.4 修正：保守/持平/進取/自訂) ──────────────

export type ScenarioKey = "conservative" | "flat" | "aggressive" | "custom";

export interface Scenario {
  key: ScenarioKey;
  label: string;
  multiplier: number;
  recommended: boolean;
  targetAnnual: number;
  monthlyTargets: Record<string, number>;
  pathDescription: string;
}

export function generateScenarios(
  prevYearRevenue: number,
  /** 12 month revenue points last year */
  history: { month: string; revenue: number }[],
  /** the year we're targeting, e.g. 2026 */
  targetYear: number,
): Scenario[] {
  const definitions: Array<Omit<Scenario, "targetAnnual" | "monthlyTargets" | "pathDescription">> = [
    { key: "conservative", label: "保守 · 持平守成", multiplier: 0.95, recommended: false },
    { key: "flat",         label: "持平 · 維持節奏",  multiplier: 1.0,  recommended: false },
    { key: "aggressive",   label: "進取 · 健康成長",  multiplier: 1.10, recommended: true  },
    { key: "custom",       label: "自訂目標",          multiplier: 1.0,  recommended: false },
  ];

  return definitions.map((def) => {
    const targetAnnual = Math.round(prevYearRevenue * def.multiplier);
    const monthlyTargets: Record<string, number> = {};
    if (history.length === 12 && prevYearRevenue > 0) {
      // Distribute target proportionally to last year's month-share
      for (const h of history) {
        const share = h.revenue / prevYearRevenue;
        const mm = h.month.slice(5);
        monthlyTargets[`${targetYear}-${mm}`] = Math.round(targetAnnual * share);
      }
    }

    let pathDescription = "";
    if (def.key === "conservative") {
      pathDescription = "守住老客、不擴張：月均達標基準 NT$" + Math.round(targetAnnual / 12).toLocaleString();
    } else if (def.key === "flat") {
      pathDescription = "維持去年節奏，月均 NT$" + Math.round(targetAnnual / 12).toLocaleString();
    } else if (def.key === "aggressive") {
      pathDescription = `① 新客留存 → 50%+（多回 ${Math.round(prevYearRevenue * 0.05 / 800)} 位 × 客單）② 染燙佔比 → 35%+ ③ 月均 NT$${Math.round(targetAnnual / 12).toLocaleString()}`;
    } else {
      pathDescription = "請輸入您的目標年營收";
    }

    return {
      ...def,
      targetAnnual,
      monthlyTargets,
      pathDescription,
    };
  });
}

// ─── Daily view aggregations ─────────────────────────────────────────────

export interface DailyBookingRow {
  id: string;
  startTime: string;
  endTime: string;
  customerName: string;
  serviceName: string;
  amount: number;
  paymentMethod: string | null;
  paymentStatus: string | null;
  bookingStatus: string;
  settledAt: string | null;
  isWarning: boolean;
  notes: string | null;
  /** V3.7 §A/B — booking origin badge (LIFF / ADMIN / IMPORT / etc) */
  bookingSource: string;
  /** V3.7 §D — last 5 digits of bank transfer (only when method=BANK_TRANSFER) */
  transferLastFive: string | null;
}

export interface DailyView {
  dateIso: string;
  weekdayLabel: string;
  totalRevenue: number;
  servedCount: number;
  avgTicket: number;
  /** count of non-cancelled bookings whose settledAt is null — what the owner
   * still needs to reconcile. Includes both CONFIRMED-but-not-completed and
   * COMPLETED-not-settled. */
  pendingCount: number;
  /** total non-cancelled bookings on this day (= 對帳進度 denominator) */
  reconcileTotalCount: number;
  warningCount: number;
  isClosed: boolean;
  closedAt: string | null;
  /** Cash totals: COMPLETED-only so cash + bank == revenue */
  cashTotal: number;
  cashConfirmed: number;
  cashPending: number;
  bankTotal: number;
  bankConfirmed: number;
  bankPending: number;
  rows: DailyBookingRow[];
  /** comparison: 4-week median revenue for the same weekday */
  comparisonMedian4w: number;
  comparisonDeltaPct: number | null;
  /** End-of-day status counts for the bottom summary row */
  noShowCount: number;
  rescheduledCount: number;
  cancelledCount: number;
}

export async function computeDailyView(
  tenantId: string,
  dateIso: string,
): Promise<DailyView> {
  // Booking.date is `@db.Date` (PG DATE — date-only). Two ways to query:
  //
  //   ❌ WRONG: gte/lte with Date.UTC(y, m-1, d, -8, 0, 0) range — PG casts
  //      both bounds to DATE in session TZ (UTC) and quietly includes ±1 day.
  //      Original V3.6 demo bug: 4/30 query returned 4/29 + 4/30 rows.
  //
  //   ❌ WRONG: equality with plain "YYYY-MM-DD" string — Prisma 7 rejects
  //      with "Invalid value for argument `date`: premature end of input.
  //      Expected ISO-8601 DateTime." (broke production 2026-04-30 hotfix
  //      window). Prisma's DateTime input parser wants full ISO timestamp.
  //
  //   ✅ RIGHT: equality with a UTC-midnight Date. `T00:00:00Z` parses fine
  //      and casts cleanly to the target DATE in any session TZ.
  const [yStr, mStr, dStr] = dateIso.split("-");
  const y = parseInt(yStr, 10);
  const m = parseInt(mStr, 10);
  const d = parseInt(dStr, 10);
  const dayDate = new Date(`${dateIso}T00:00:00.000Z`);

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { dayClosedAt: true },
  });
  const closedMap = (tenant?.dayClosedAt as Record<string, string> | null) ?? {};
  const closedAt = closedMap[dateIso] ?? null;

  const bookings = await prisma.booking.findMany({
    where: {
      tenantId,
      date: dayDate,
      status: { notIn: ["CANCELLED", "CANCELLED_BY_ADMIN"] },
    },
    select: {
      id: true,
      startTime: true,
      endTime: true,
      status: true,
      source: true,
      settledAt: true,
      notes: true,
      lateRescheduleCount: true,
      service: { select: { name: true, price: true } },
      payment: { select: { amount: true, status: true, method: true, transferLastFive: true } },
      user: { select: { displayName: true, realName: true } },
    },
    orderBy: { startTime: "asc" },
  });

  const rows: DailyBookingRow[] = bookings.map((b) => {
    const baseAmount = b.payment?.amount ?? b.service.price;
    const isComplimentary = (b.notes ?? "").includes("招待") || baseAmount === 0;
    const isWarning = isComplimentary || b.status === "NO_SHOW";
    return {
      id: b.id,
      startTime: b.startTime,
      endTime: b.endTime,
      customerName: b.user?.realName ?? b.user?.displayName ?? "—",
      serviceName: b.service.name,
      amount: baseAmount,
      paymentMethod: b.payment?.method ?? null,
      paymentStatus: b.payment?.status ?? null,
      bookingStatus: b.status,
      settledAt: b.settledAt ? b.settledAt.toISOString() : null,
      isWarning,
      notes: b.notes,
      bookingSource: b.source,
      transferLastFive:
        b.payment?.method === "BANK_TRANSFER" ? b.payment.transferLastFive ?? null : null,
    };
  });

  // Revenue / served / avg ticket — COMPLETED only (real earned money).
  const completedRows = rows.filter((r) => r.bookingStatus === "COMPLETED");
  const totalRevenue = completedRows.reduce((s, r) => s + r.amount, 0);
  const servedCount = completedRows.length;
  const avgTicket = servedCount > 0 ? Math.round(totalRevenue / servedCount) : 0;

  // 對帳進度 — total expected reconciliations (all non-cancelled rows on this day)
  // vs how many have settledAt set. pendingCount mirrors what the owner sees in
  // the list as "rows without ✓ 已對".
  const reconcileTotalCount = rows.length;
  const settledTotalCount = rows.filter((r) => r.settledAt != null).length;
  const pendingCount = reconcileTotalCount - settledTotalCount;
  const warningCount = rows.filter((r) => r.isWarning).length;

  // Cash / bank totals — COMPLETED only so cash + bank == today's revenue.
  // (Future CONFIRMED bookings are not counted; they're still in the list but
  // contribute zero to the cash/bank cards until they settle.)
  // NULL paymentMethod (no Payment record yet) defaults to CASH — admin reflex
  // for walk-in cash sales is no payment record, and previously they fell into
  // a third bucket making cashTotal + bankTotal != totalRevenue (V3.6 demo bug).
  const completedBankRows = completedRows.filter((r) => r.paymentMethod === "BANK_TRANSFER");
  const completedCashRows = completedRows.filter((r) => r.paymentMethod !== "BANK_TRANSFER");
  const cashTotal = completedCashRows.reduce((s, r) => s + r.amount, 0);
  const cashConfirmed = completedCashRows.filter((r) => r.settledAt != null).length;
  const cashPending = completedCashRows.length - cashConfirmed;
  const bankTotal = completedBankRows.reduce((s, r) => s + r.amount, 0);
  const bankConfirmed = completedBankRows.filter((r) => r.settledAt != null).length;
  const bankPending = completedBankRows.length - bankConfirmed;

  // End-of-day status counts (footer summary)
  const noShowCount = rows.filter((r) => r.bookingStatus === "NO_SHOW").length;
  const rescheduledCount = bookings.filter((b) => b.lateRescheduleCount > 0).length;
  const cancelledCount = await prisma.booking.count({
    where: {
      tenantId,
      date: dayDate,
      status: { in: ["CANCELLED", "CANCELLED_BY_ADMIN"] },
    },
  });

  // Comparison: 4-week median revenue same weekday.
  // V3.8 perf: was a 4-iteration serial await loop (~800ms RTT-bound).
  // Promise.all drops it to ~1 RTT (~200ms) — 4 independent queries on the
  // same Booking table, no inter-dependency. Order preserved by index → push.
  const dayObj = new Date(Date.UTC(y, m - 1, d));
  const dow = dayObj.getUTCDay();
  const weeklyRanges = pastWeeklyRanges(y, m, d, 4);
  const sameWeekdayRev = await Promise.all(
    weeklyRanges.map(({ pStart, pEnd }) => sumRevenue(tenantId, pStart, pEnd)),
  );
  const median4w = (() => {
    const sorted = [...sameWeekdayRev].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)] ?? 0;
  })();
  const comparisonDeltaPct = median4w > 0
    ? Math.round(((totalRevenue - median4w) / median4w) * 1000) / 10
    : null;

  const weekdayLabel = ["週日", "週一", "週二", "週三", "週四", "週五", "週六"][dow];

  return {
    dateIso,
    weekdayLabel,
    totalRevenue,
    servedCount,
    avgTicket,
    pendingCount,
    reconcileTotalCount,
    warningCount,
    isClosed: closedAt != null,
    closedAt,
    cashTotal,
    cashConfirmed,
    cashPending,
    bankTotal,
    bankConfirmed,
    bankPending,
    noShowCount,
    rescheduledCount,
    cancelledCount,
    rows,
    comparisonMedian4w: median4w,
    comparisonDeltaPct,
  };
}

// ─── Helper: ensure a TimeRange for a "YYYY-MM" period key ───────────────

export function rangeForMonth(periodMonth: string): TimeRange {
  // e.g. "2026-04" → 4 月份的本月
  const [yStr, mStr] = periodMonth.split("-");
  const yy = parseInt(yStr, 10);
  const mm = parseInt(mStr, 10);
  // Compute offset from current Taipei month
  const todayIso = new Date().toLocaleDateString("en-CA", { timeZone: TIMEZONE });
  const [tyStr, tmStr] = todayIso.split("-");
  const ty = parseInt(tyStr, 10);
  const tm = parseInt(tmStr, 10);
  const offset = (yy - ty) * 12 + (mm - tm);
  return computeRange("month" as RangeType, offset);
}

export function rangeForYear(periodYear: string): TimeRange {
  const yy = parseInt(periodYear, 10);
  const todayIso = new Date().toLocaleDateString("en-CA", { timeZone: TIMEZONE });
  const ty = parseInt(todayIso.split("-")[0], 10);
  const offset = yy - ty;
  return computeRange("year" as RangeType, offset);
}

// ─── Annual cohort & top customers (V3.6 §7.1 ⑤ + ②) ────────────────────

export interface AnnualHighlights {
  highestMonthRevenue: number;
  highestMonthLabel: string;
  totalServiceCount: number;
  uniqueCustomers: number;
  highestSingleTicket: number;
  topCustomers: Array<{
    id: string;
    displayName: string | null;
    visitCount: number;
    totalSpend: number;
  }>;
  championCount: number;  // count where annual visits ≥5
}

export async function computeAnnualHighlights(
  tenantId: string,
  year: number,
): Promise<AnnualHighlights> {
  const from = new Date(Date.UTC(year, 0, 1, -8, 0, 0));
  const to = new Date(Date.UTC(year, 11, 31, 15, 59, 59, 999));

  const bookings = await prisma.booking.findMany({
    where: {
      tenantId,
      date: { gte: from, lte: to },
      status: { in: [...ACTIVE_STATUSES] },
    },
    select: {
      userId: true,
      date: true,
      service: { select: { price: true } },
      payment: { select: { amount: true, status: true } },
      user: { select: { id: true, displayName: true, realName: true } },
    },
  });

  const monthRev = new Map<string, number>();
  const userAcc = new Map<string, { id: string; name: string | null; visits: number; spend: number }>();
  let highestSingleTicket = 0;

  for (const b of bookings) {
    const amt = b.payment?.amount && b.payment.status === "RECEIVED"
      ? b.payment.amount
      : b.service.price;
    const monthKey = isoDate(b.date).slice(5, 7); // MM
    monthRev.set(monthKey, (monthRev.get(monthKey) ?? 0) + amt);
    if (amt > highestSingleTicket) highestSingleTicket = amt;

    const acc = userAcc.get(b.userId) ?? {
      id: b.user?.id ?? b.userId,
      name: b.user?.realName ?? b.user?.displayName ?? null,
      visits: 0,
      spend: 0,
    };
    acc.visits++;
    acc.spend += amt;
    userAcc.set(b.userId, acc);
  }

  let highestMonthRev = 0;
  let highestMonthLabel = "";
  for (const [mm, rev] of monthRev) {
    if (rev > highestMonthRev) {
      highestMonthRev = rev;
      highestMonthLabel = `${parseInt(mm, 10)}月`;
    }
  }

  const accs = [...userAcc.values()].sort((a, b) => b.spend - a.spend);
  const topCustomers = accs.slice(0, 5).map((a) => ({
    id: a.id,
    displayName: a.name,
    visitCount: a.visits,
    totalSpend: a.spend,
  }));
  const championCount = accs.filter((a) => a.visits >= 5).length;

  return {
    highestMonthRevenue: highestMonthRev,
    highestMonthLabel,
    totalServiceCount: bookings.length,
    uniqueCustomers: userAcc.size,
    highestSingleTicket,
    topCustomers,
    championCount,
  };
}
