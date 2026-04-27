/**
 * Live report aggregations from the Booking + Payment + User tables (PRD-v3 §10.2).
 *
 * Replaces the static snapshot JSON for the production tenant. Used by
 * GET /api/reports?range=...&offset=...
 *
 * Each function takes (tenantId, TimeRange) and returns the shape that
 * /(admin)/reports already expects, so the page can swap data sources without
 * UI changes.
 */

import { prisma } from "@/lib/prisma";
import type { TimeRange } from "./time-range";
import { rangeDays } from "./time-range";

const TIMEZONE = "Asia/Taipei";

function isoDate(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: TIMEZONE });
}

/** Status values that count as "real" bookings for revenue purposes. */
const PAID_STATUSES = ["COMPLETED"] as const;
const ACTIVE_STATUSES = ["CONFIRMED", "COMPLETED"] as const;

interface Totals {
  bookings: number;
  revenue: number;
  uniqueCustomers: number;
  newCustomers: number;
  arpu: number;
  occupancyRate: number;
  cancellationRate: number;
  noShowRate: number;

  // V3.5 — customer-quality metrics (range-bound)
  visitFrequency: number;       // avg visits/customer in this range
  oneTimerRate: number;         // % unique customers with exactly 1 visit in range
  avgGapDays: number;           // mean gap between consecutive visits (days)
  medianGapDays: number;        // median gap (days)

  // V3.5 — store-source split (range-bound, only counts NEW-IN-PERIOD users)
  shopNewCustomers: number;     // first-ever visit was in this range AND tagged 新 (or non-Excel)
  shopOldCustomers: number;     // first-ever visit was in this range AND moved over from old shop
}

interface GlobalRetention {
  retention90Days: number;
  retention60Days: number;
  retention30Days: number;
}

export async function computeTotals(tenantId: string, r: TimeRange): Promise<Totals> {
  const where = {
    tenantId,
    date: { gte: r.from, lte: r.to },
  };
  const bookings = await prisma.booking.findMany({
    where,
    select: {
      id: true,
      userId: true,
      date: true,
      status: true,
      service: { select: { price: true } },
      payment: { select: { amount: true, status: true } },
    },
  });

  const active = bookings.filter((b) => (ACTIVE_STATUSES as readonly string[]).includes(b.status));
  const completed = bookings.filter((b) => (PAID_STATUSES as readonly string[]).includes(b.status));
  const cancelled = bookings.filter((b) => b.status === "CANCELLED" || b.status === "CANCELLED_BY_ADMIN");
  const noShow = bookings.filter((b) => b.status === "NO_SHOW");

  // Revenue: prefer Payment.amount when present (preserves historical
  // pricing for legacy import), fall back to service.price for current-system
  // bookings without a Payment row yet.
  let revenue = 0;
  for (const b of completed) {
    if (b.payment?.amount && b.payment.status === "RECEIVED") {
      revenue += b.payment.amount;
    } else {
      revenue += b.service.price;
    }
  }

  const userIds = new Set(active.map((b) => b.userId));
  const uniqueCustomers = userIds.size;

  // New customers in window — User.firstVisitAt within range
  const newCount = await prisma.user.count({
    where: {
      tenantId,
      firstVisitAt: { gte: r.from, lte: r.to },
    },
  });

  const arpu = uniqueCustomers > 0 ? Math.round(revenue / uniqueCustomers) : 0;

  // Occupancy: 9 slots/day × open days (assume 6/7 days open, drop 週一公休 = ~85.7%)
  const days = rangeDays(r);
  const openDays = Math.round(days * (6 / 7));
  const totalSlots = openDays * 9;
  const occupancyRate = totalSlots > 0
    ? Math.round((active.length / totalSlots) * 1000) / 10
    : 0;

  const total = bookings.length;
  const cancellationRate = total > 0 ? Math.round((cancelled.length / total) * 1000) / 10 : 0;
  const noShowRate = total > 0 ? Math.round((noShow.length / total) * 1000) / 10 : 0;

  // ── V3.5 customer-quality metrics ──────────────────────────────────
  // Per-customer visit count for ACTIVE bookings within the range (CONFIRMED + COMPLETED).
  // visitFrequency = total visits / unique visitors → reveals retention strength.
  // oneTimerRate   = % of those visitors who appeared exactly once in the period —
  //                  the V3.5 hero diagnostic ("47% one-and-done").
  const visitsByUser = new Map<string, Date[]>();
  for (const b of active) {
    const arr = visitsByUser.get(b.userId) ?? [];
    arr.push(b.date);
    visitsByUser.set(b.userId, arr);
  }
  const visitFrequency =
    uniqueCustomers > 0 ? Math.round((active.length / uniqueCustomers) * 100) / 100 : 0;
  const oneTimerCount = Array.from(visitsByUser.values()).filter((v) => v.length === 1).length;
  const oneTimerRate =
    uniqueCustomers > 0 ? Math.round((oneTimerCount / uniqueCustomers) * 1000) / 10 : 0;

  // Return-gap distribution: for every customer with ≥2 visits in the range,
  // sort their dates ASC and accumulate consecutive deltas in days. Mean +
  // median across the whole pool.
  const gaps: number[] = [];
  for (const dates of visitsByUser.values()) {
    if (dates.length < 2) continue;
    const sorted = [...dates].sort((a, b) => a.getTime() - b.getTime());
    for (let i = 1; i < sorted.length; i++) {
      const days = Math.round(
        (sorted[i].getTime() - sorted[i - 1].getTime()) / (24 * 60 * 60 * 1000),
      );
      if (days > 0) gaps.push(days);
    }
  }
  const avgGapDays =
    gaps.length > 0 ? Math.round(gaps.reduce((s, n) => s + n, 0) / gaps.length) : 0;
  const medianGapDays = (() => {
    if (gaps.length === 0) return 0;
    const sorted = [...gaps].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
      ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
      : sorted[mid];
  })();

  // Shop-source split: among customers whose firstVisitAt landed in this range,
  // distinguish "新店面客" (Excel notes contained 新, or post-launch real LINE
  // users — both are first-time-at-this-shop) from "舊店面客" (Excel rows
  // without 新 prefix — moved over from the previous shop location).
  const newInRangeUsers = await prisma.user.findMany({
    where: { tenantId, firstVisitAt: { gte: r.from, lte: r.to } },
    select: { id: true },
  });
  const newUserIds = newInRangeUsers.map((u) => u.id);
  let shopNewCustomers = 0;
  let shopOldCustomers = 0;
  if (newUserIds.length > 0) {
    // For each new-in-range user, fetch their earliest booking and inspect notes.
    // One round-trip per user is acceptable at 348 users; caller caches behind
    // SWR + s-maxage=60 so this is bounded.
    const firstBookings = await prisma.booking.findMany({
      where: { tenantId, userId: { in: newUserIds } },
      select: { userId: true, date: true, notes: true },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
    });
    const seenUser = new Set<string>();
    for (const b of firstBookings) {
      if (seenUser.has(b.userId)) continue;
      seenUser.add(b.userId);
      const notes = b.notes ?? "";
      // Excel imports tag fresh walk-ins with `原始 Excel: 新…`; rows without
      // 新 mean "follow-from-old-shop"; non-Excel rows are post-launch LINE
      // signups — by definition fresh walk-ins to this location.
      const isExcel = notes.startsWith("原始 Excel:");
      const isFreshAtThisShop = !isExcel || notes.startsWith("原始 Excel: 新");
      if (isFreshAtThisShop) shopNewCustomers++;
      else shopOldCustomers++;
    }
  }

  return {
    bookings: active.length,
    revenue,
    uniqueCustomers,
    newCustomers: newCount,
    arpu,
    occupancyRate,
    cancellationRate,
    noShowRate,
    visitFrequency,
    oneTimerRate,
    avgGapDays,
    medianGapDays,
    shopNewCustomers,
    shopOldCustomers,
  };
}

/**
 * Tenant-wide retention rates — % of customers with at least 1 follow-up visit
 * within N days of their firstVisitAt. Calculated globally (NOT range-bound)
 * because partial-period retention is misleading; matches the headline 42%
 * 90-day number from the V3.5 plan §0.2.
 *
 * Excludes customers whose firstVisitAt is more recent than N days ago — they
 * literally haven't had time to come back yet, so counting them as "didn't
 * retain" would underreport.
 */
export async function computeRetention(tenantId: string): Promise<GlobalRetention> {
  const now = new Date();
  const ms = (d: number) => d * 24 * 60 * 60 * 1000;

  // Pull every active booking and group by user, sorted ASC by date. A user
  // is N-day-retained if their SECOND booking is ≤N days after their FIRST.
  // We can't use User.lastVisitAt here — that's the most-recent visit, which
  // gives wrong answers for customers with first→200d→second→day-of-second
  // patterns. Need actual second-visit timestamp.
  const bookings = await prisma.booking.findMany({
    where: {
      tenantId,
      status: { in: [...ACTIVE_STATUSES] },
    },
    select: { userId: true, date: true },
    orderBy: { date: "asc" },
  });

  const firstAndSecond = new Map<string, { first: Date; second: Date | null }>();
  for (const b of bookings) {
    const acc = firstAndSecond.get(b.userId);
    if (!acc) firstAndSecond.set(b.userId, { first: b.date, second: null });
    else if (acc.second == null && b.date.getTime() > acc.first.getTime())
      firstAndSecond.set(b.userId, { first: acc.first, second: b.date });
  }

  const calc = (windowDays: number): number => {
    let eligible = 0;
    let retained = 0;
    for (const { first, second } of firstAndSecond.values()) {
      // Only count customers whose first visit was at least `windowDays` ago —
      // otherwise we'd count "didn't come back yet" as "didn't retain".
      if (now.getTime() - first.getTime() < ms(windowDays)) continue;
      eligible++;
      if (second && second.getTime() - first.getTime() <= ms(windowDays)) retained++;
    }
    return eligible > 0 ? Math.round((retained / eligible) * 1000) / 10 : 0;
  };

  return {
    retention30Days: calc(30),
    retention60Days: calc(60),
    retention90Days: calc(90),
  };
}

interface TrendPoint {
  bucket: string;     // e.g. "2025-01" or "W14" or "2025-Q1"
  bookings: number;
  revenue: number;
  newCustomers: number;
}

/**
 * Bucket bookings into time slices appropriate to the range type:
 *   week    → daily (7 buckets)
 *   month   → weekly (4-5 buckets)
 *   quarter → monthly (3 buckets)
 *   year    → monthly (12 buckets)
 */
export async function computeTrend(tenantId: string, r: TimeRange): Promise<TrendPoint[]> {
  const bookings = await prisma.booking.findMany({
    where: {
      tenantId,
      date: { gte: r.from, lte: r.to },
      status: { in: [...ACTIVE_STATUSES] },
    },
    select: {
      date: true,
      userId: true,
      service: { select: { price: true } },
      payment: { select: { amount: true, status: true } },
      user: { select: { firstVisitAt: true } },
    },
    orderBy: { date: "asc" },
  });

  const buckets = new Map<string, { bookings: number; revenue: number; newSet: Set<string> }>();
  const bucketKey = (d: Date): string => {
    const iso = isoDate(d);
    const [y, m, day] = iso.split("-").map(Number);
    if (r.type === "week") return `${m}/${day}`;
    if (r.type === "month") {
      // Week-of-month
      const w = Math.ceil(day / 7);
      return `W${w}`;
    }
    if (r.type === "quarter") return `${y}-${String(m).padStart(2, "0")}`;
    return `${y}-${String(m).padStart(2, "0")}`;
  };

  for (const b of bookings) {
    const key = bucketKey(b.date);
    const acc = buckets.get(key) ?? { bookings: 0, revenue: 0, newSet: new Set<string>() };
    acc.bookings++;
    if (b.payment?.amount && b.payment.status === "RECEIVED") acc.revenue += b.payment.amount;
    else acc.revenue += b.service.price;

    if (b.user?.firstVisitAt) {
      const fvIso = isoDate(b.user.firstVisitAt);
      const bIso = isoDate(b.date);
      // Treat customer as "new in this bucket" if their first visit equals this booking's date
      if (fvIso === bIso) acc.newSet.add(b.userId);
    }
    buckets.set(key, acc);
  }

  return Array.from(buckets.entries())
    .sort()
    .map(([bucket, v]) => ({
      bucket,
      bookings: v.bookings,
      revenue: v.revenue,
      newCustomers: v.newSet.size,
    }));
}

interface ServicePieEntry {
  category: string;
  count: number;
  revenue: number;
}

const CATEGORY_RULES: { test: (n: string) => boolean; cat: string }[] = [
  { test: (n) => n.includes("剪") || n.includes("瀏海"), cat: "剪" },
  { test: (n) => n.includes("漂"), cat: "漂" },
  { test: (n) => n.includes("補染") || n.includes("染"), cat: "染" },
  { test: (n) => n.includes("矯正") || n.includes("燙"), cat: "燙" },
  { test: (n) => n.includes("護"), cat: "護" },
  { test: (n) => n.includes("頭皮"), cat: "護" },
  { test: (n) => n.includes("洗"), cat: "洗" },
];

function categorize(name: string): string {
  for (const { test, cat } of CATEGORY_RULES) if (test(name)) return cat;
  return "其他";
}

export async function computeServicePie(tenantId: string, r: TimeRange): Promise<ServicePieEntry[]> {
  const bookings = await prisma.booking.findMany({
    where: {
      tenantId,
      date: { gte: r.from, lte: r.to },
      status: { in: [...ACTIVE_STATUSES] },
    },
    select: {
      service: { select: { name: true, price: true } },
      payment: { select: { amount: true, status: true } },
    },
  });

  const map = new Map<string, { count: number; revenue: number }>();
  for (const b of bookings) {
    const cat = categorize(b.service.name);
    const acc = map.get(cat) ?? { count: 0, revenue: 0 };
    acc.count++;
    if (b.payment?.amount && b.payment.status === "RECEIVED") acc.revenue += b.payment.amount;
    else acc.revenue += b.service.price;
    map.set(cat, acc);
  }

  return Array.from(map.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .map(([category, v]) => ({ category, count: v.count, revenue: v.revenue }));
}

interface HeatmapResult {
  weekdays: string[];
  hours: string[];
  data: number[][];
}

export async function computeHeatmap(tenantId: string, r: TimeRange): Promise<HeatmapResult> {
  // 6 weekdays (Mon-Tue + Thu-Sun, skip Wed if 公休) × 9 hours (11-19)
  // We include all 7 weekdays but expect Mon to be near zero (公休 actually 週一).
  const data: number[][] = Array.from({ length: 7 }, () => Array(9).fill(0));
  const bookings = await prisma.booking.findMany({
    where: {
      tenantId,
      date: { gte: r.from, lte: r.to },
      status: { in: [...ACTIVE_STATUSES] },
    },
    select: { date: true, startTime: true },
  });
  for (const b of bookings) {
    const taipeiIso = isoDate(b.date);
    const dow = (() => {
      const d = new Date(taipeiIso + "T00:00:00+08:00");
      return (d.getUTCDay() + 6) % 7; // Mon=0..Sun=6
    })();
    const h = parseInt(b.startTime.split(":")[0]);
    if (h >= 11 && h <= 19) data[dow][h - 11]++;
  }
  return {
    weekdays: ["週一", "週二", "週三", "週四", "週五", "週六", "週日"],
    hours: ["11", "12", "13", "14", "15", "16", "17", "18", "19"],
    data,
  };
}

interface TopServiceEntry {
  name: string;
  count: number;
  revenue: number;
  avg: number;
}

export async function computeTopServices(tenantId: string, r: TimeRange, limit = 10): Promise<TopServiceEntry[]> {
  const bookings = await prisma.booking.findMany({
    where: {
      tenantId,
      date: { gte: r.from, lte: r.to },
      status: { in: [...ACTIVE_STATUSES] },
    },
    select: {
      service: { select: { name: true, price: true } },
      payment: { select: { amount: true, status: true } },
    },
  });
  const map = new Map<string, { count: number; revenue: number }>();
  for (const b of bookings) {
    const acc = map.get(b.service.name) ?? { count: 0, revenue: 0 };
    acc.count++;
    if (b.payment?.amount && b.payment.status === "RECEIVED") acc.revenue += b.payment.amount;
    else acc.revenue += b.service.price;
    map.set(b.service.name, acc);
  }
  return Array.from(map.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, limit)
    .map(([name, v]) => ({
      name,
      count: v.count,
      revenue: v.revenue,
      avg: v.count > 0 ? Math.round(v.revenue / v.count) : 0,
    }));
}

interface TopCustomerEntry {
  id: string;
  displayName: string | null;
  visitCount: number;
  totalSpend: number;
  lastVisit: string | null;
  segment: string;
}

export async function computeTopCustomers(tenantId: string, r: TimeRange, limit = 20): Promise<TopCustomerEntry[]> {
  const bookings = await prisma.booking.findMany({
    where: {
      tenantId,
      date: { gte: r.from, lte: r.to },
      status: { in: [...ACTIVE_STATUSES] },
    },
    select: {
      userId: true,
      date: true,
      service: { select: { price: true } },
      payment: { select: { amount: true, status: true } },
      user: { select: { id: true, displayName: true, segment: true, lastVisitAt: true } },
    },
  });
  const map = new Map<string, TopCustomerEntry>();
  for (const b of bookings) {
    if (!b.user) continue;
    const acc = map.get(b.userId) ?? {
      id: b.user.id,
      displayName: b.user.displayName,
      visitCount: 0,
      totalSpend: 0,
      lastVisit: b.user.lastVisitAt ? isoDate(b.user.lastVisitAt) : null,
      segment: b.user.segment,
    };
    acc.visitCount++;
    if (b.payment?.amount && b.payment.status === "RECEIVED") acc.totalSpend += b.payment.amount;
    else acc.totalSpend += b.service.price;
    map.set(b.userId, acc);
  }
  return Array.from(map.values())
    .sort((a, b) => b.totalSpend - a.totalSpend)
    .slice(0, limit);
}

interface SegmentEntry {
  segment: string;
  count: number;
  pct: number;
}

export async function computeCustomerSegments(tenantId: string): Promise<SegmentEntry[]> {
  const groups = await prisma.user.groupBy({
    by: ["segment"],
    where: { tenantId },
    _count: { _all: true },
  });
  const total = groups.reduce((s, g) => s + g._count._all, 0);
  return groups
    .map((g) => ({
      segment: g.segment,
      count: g._count._all,
      pct: total > 0 ? Math.round((g._count._all / total) * 1000) / 10 : 0,
    }))
    .sort((a, b) => {
      const order = ["NEW", "REGULAR", "VIP", "AT_RISK", "LAPSED", "BLACKLISTED"];
      return order.indexOf(a.segment) - order.indexOf(b.segment);
    });
}

interface PaymentMixEntry {
  method: string;
  count: number;
  amount: number;
}

export async function computePaymentMix(tenantId: string, r: TimeRange): Promise<PaymentMixEntry[]> {
  const payments = await prisma.payment.findMany({
    where: {
      status: "RECEIVED",
      booking: {
        tenantId,
        date: { gte: r.from, lte: r.to },
      },
    },
    select: { method: true, amount: true },
  });
  const map = new Map<string, { count: number; amount: number }>();
  for (const p of payments) {
    const acc = map.get(p.method) ?? { count: 0, amount: 0 };
    acc.count++;
    acc.amount += p.amount;
    map.set(p.method, acc);
  }
  return Array.from(map.entries())
    .sort((a, b) => b[1].amount - a[1].amount)
    .map(([method, v]) => ({ method, count: v.count, amount: v.amount }));
}
