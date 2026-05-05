/**
 * V3.6 reports endpoint — replaces the V3.5 single-shape /api/reports response
 * with three view-specific shapes (daily/monthly/annual).
 *
 * GET /api/reports/v3.6?view=daily&date=YYYY-MM-DD
 * GET /api/reports/v3.6?view=monthly&period=YYYY-MM
 * GET /api/reports/v3.6?view=annual&period=YYYY
 *
 * Auth: admin JWT cookie (or Authorization: Bearer fallback).
 *
 * Caching strategy (V3.6 perf-pass-2):
 *   - Each view's response is wrapped in `unstable_cache` keyed by
 *     (tenantId, period). TTL 60s — handles cold-start lambda warmup
 *     and shields the DB from rapid tab-switching by the same admin.
 *   - HTTP cache header s-maxage=60 stays as a CDN-layer hint, but
 *     authenticated requests usually bypass edge cache anyway —
 *     the data-cache layer is what makes tab-switching feel instant.
 *   - When response shape changes, bump the version suffix in the
 *     `unstable_cache` keyParts (e.g. "reports-monthly-v1" → "v2") to
 *     invalidate stale cached payloads.
 */

import { NextRequest } from "next/server";
import { unstable_cache } from "next/cache";
import { getAdminFromCookie } from "@/lib/auth/jwt";
import { todayInTaipei } from "@/lib/utils/time";
import { errorResponse } from "@/lib/utils/errors";
import { previousPeriod } from "@/lib/reports/time-range";
import {
  computeTotals,
  computeRetention,
  computeServicePie,
  computeServiceMixByCustomer,
  computeHeatmap,
  computeTopServices,
  computeTopCustomers,
  computeTrend,
} from "@/lib/reports/aggregate";
import {
  computeDailyView,
  computePrebookRate,
  computeRfmSegments,
  computeMonthlyTarget,
  computeYoYTrend,
  computeAlerts,
  computeTrailingMetrics,
  computeMonthlySparkline,
  computeAnnualHighlights,
  rangeForMonth,
  rangeForYear,
  renderSummary,
  generateScenarios,
  type Alert,
  type AlertContext,
  type NarrativeContext,
} from "@/lib/reports/v3.6/aggregates";

const CACHE_TTL_SECONDS = 60;

const buildDailyPayload = unstable_cache(
  async (tenantId: string, dateIso: string) => {
    const data = await computeDailyView(tenantId, dateIso);
    return { view: "daily" as const, date: dateIso, data };
  },
  ["reports-daily-v1"],
  { revalidate: CACHE_TTL_SECONDS, tags: ["reports"] },
);

const buildMonthlyPayload = unstable_cache(
  async (tenantId: string, period: string, todayIso: string) => {
    const range = rangeForMonth(period);
    const prev = previousPeriod(range);

    const yearForYoy = parseInt(period.slice(0, 4), 10);
    const [
      totals,
      prevTotals,
      trend,
      servicePie,
      serviceMixByCustomer,
      heatmap,
      topServices,
      topCustomers,
      retention,
      prebook,
      prebookPrev,
      rfm,
      target,
      sparkline,
      trailing,
      prevServicePie,
      yoy12,
    ] = await Promise.all([
      computeTotals(tenantId, range),
      computeTotals(tenantId, prev),
      computeTrend(tenantId, range),
      computeServicePie(tenantId, range),
      computeServiceMixByCustomer(tenantId, range),
      computeHeatmap(tenantId, range),
      computeTopServices(tenantId, range, 10),
      computeTopCustomers(tenantId, range, 10),
      computeRetention(tenantId),
      computePrebookRate(tenantId, range),
      computePrebookRate(tenantId, prev),
      computeRfmSegments(tenantId, range),
      computeMonthlyTarget(tenantId, range, todayIso),
      computeMonthlySparkline(tenantId, period),
      computeTrailingMetrics(tenantId, period + "-15"),
      // V3.8 perf: was sequential awaits below; pulling into Promise.all saves
      // ~600ms because both queries hit the same Booking table independently.
      computeServicePie(tenantId, prev),
      computeYoYTrend(tenantId, yearForYoy),
    ]);

    const ctx: AlertContext = {
      yoyTrailing3M: trailing.yoyTrailing3M,
      retention90: retention.retention90Days,
      prebookRate: prebook.rate,
      ticket: totals.arpu,
      ticket12mAvg: trailing.ticket12mAvg,
      monthlyActiveCustomers: totals.uniqueCustomers,
      monthlyActivePrev: prevTotals.uniqueCustomers,
    };
    const alerts: Alert[] = computeAlerts(ctx);

    const totalChemicalRev = servicePie
      .filter((s) => ["染", "燙", "漂"].includes(s.category))
      .reduce((s, x) => s + x.revenue, 0);
    const chemicalShare = totals.revenue > 0
      ? Math.round((totalChemicalRev / totals.revenue) * 1000) / 10
      : 0;

    const prevChemicalRev = prevServicePie
      .filter((s) => ["染", "燙", "漂"].includes(s.category))
      .reduce((s, x) => s + x.revenue, 0);
    const chemicalShareLast = prevTotals.revenue > 0
      ? Math.round((prevChemicalRev / prevTotals.revenue) * 1000) / 10
      : 0;

    const monthIdx = parseInt(period.slice(5, 7), 10) - 1;
    const lastYearSameMonth = yoy12.points[monthIdx]?.lastYear ?? 0;
    const yoyChangePct = lastYearSameMonth > 0
      ? Math.round(((totals.revenue - lastYearSameMonth) / lastYearSameMonth) * 1000) / 10
      : null;
    const momChangePct = prevTotals.revenue > 0
      ? Math.round(((totals.revenue - prevTotals.revenue) / prevTotals.revenue) * 1000) / 10
      : null;

    const narrCtx: NarrativeContext = {
      monthLabel: period,
      revenue: totals.revenue,
      momChangePct,
      yoyChangePct,
      ticket: totals.arpu,
      ticket12mAvg: trailing.ticket12mAvg,
      retention90: retention.retention90Days,
      prebookRate: prebook.rate,
      chemicalShare,
      chemicalShareLastMonth: chemicalShareLast,
      occupancy: totals.occupancyRate,
      monthlyActive: totals.uniqueCustomers,
    };
    const summaryText = renderSummary(narrCtx);

    return {
      view: "monthly" as const,
      period,
      range: {
        label: range.label,
        fromIso: range.fromIso,
        toIso: range.toIso,
      },
      previousLabel: prev.label,
      totals,
      previousTotals: prevTotals,
      trend,
      servicePie,
      serviceMixByCustomer,
      heatmap,
      topServices,
      topCustomers,
      retention,
      prebook,
      prebookPrev,
      rfm,
      target,
      sparkline,
      alerts,
      summaryText,
      chemicalShare,
      chemicalShareLastMonth: chemicalShareLast,
      yoy: yoy12,
      momChangePct,
      yoyChangePct,
    };
  },
  ["reports-monthly-v1"],
  { revalidate: CACHE_TTL_SECONDS, tags: ["reports"] },
);

const buildAnnualPayload = unstable_cache(
  async (tenantId: string, periodYear: string) => {
    const range = rangeForYear(periodYear);
    const year = parseInt(periodYear, 10);

    const [
      totals,
      retention,
      servicePie,
      rfm,
      yoy,
      topCustomers,
      highlights,
      sparkline,
    ] = await Promise.all([
      computeTotals(tenantId, range),
      computeRetention(tenantId),
      computeServicePie(tenantId, range),
      computeRfmSegments(tenantId, range),
      computeYoYTrend(tenantId, year),
      computeTopCustomers(tenantId, range, 5),
      computeAnnualHighlights(tenantId, year),
      computeMonthlySparkline(tenantId, `${year}-12`),
    ]);

    const monthHistory = sparkline.slice(0, 12).map((s) => ({
      month: s.month,
      revenue: s.revenue,
    }));
    const scenarios = generateScenarios(totals.revenue, monthHistory, year + 1);

    const totalRev = servicePie.reduce((s, x) => s + x.revenue, 0) || 1;
    const serviceShares = servicePie.map((s) => ({
      category: s.category,
      revenue: s.revenue,
      share: Math.round((s.revenue / totalRev) * 1000) / 10,
      count: s.count,
    }));

    return {
      view: "annual" as const,
      period: periodYear,
      year,
      range: {
        label: range.label,
        fromIso: range.fromIso,
        toIso: range.toIso,
      },
      totals,
      retention,
      servicePie,
      serviceShares,
      rfm,
      yoy,
      topCustomers,
      highlights,
      sparkline,
      scenarios,
    };
  },
  ["reports-annual-v1"],
  { revalidate: CACHE_TTL_SECONDS, tags: ["reports"] },
);

export async function GET(request: NextRequest) {
  const admin = await getAdminFromCookie(request);
  if (!admin) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sp = request.nextUrl.searchParams;
  const view = sp.get("view") ?? "monthly";

  try {
    if (view === "daily") {
      const dateIso = sp.get("date") ?? todayInTaipei();
      const payload = await buildDailyPayload(admin.tenantId, dateIso);
      return jsonResponse(payload);
    }

    if (view === "monthly") {
      const period = sp.get("period") ?? todayInTaipei().slice(0, 7);
      const todayIso = todayInTaipei();
      const payload = await buildMonthlyPayload(admin.tenantId, period, todayIso);
      return jsonResponse(payload);
    }

    if (view === "annual") {
      const periodYear = sp.get("period") ?? String(parseInt(todayInTaipei().slice(0, 4), 10));
      const payload = await buildAnnualPayload(admin.tenantId, periodYear);
      return jsonResponse(payload);
    }

    return Response.json({ error: "invalid view" }, { status: 400 });
  } catch (err) {
    return errorResponse(err);
  }
}

function jsonResponse(payload: unknown): Response {
  return Response.json(payload, {
    headers: {
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
    },
  });
}
