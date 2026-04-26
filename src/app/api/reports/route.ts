import { NextRequest } from "next/server";
import { getAdminFromCookie } from "@/lib/auth/jwt";
import { computeRange, previousPeriod, type RangeType } from "@/lib/reports/time-range";
import {
  computeTotals,
  computeTrend,
  computeServicePie,
  computeHeatmap,
  computeTopServices,
  computeTopCustomers,
  computeCustomerSegments,
  computePaymentMix,
  computeRetention,
} from "@/lib/reports/aggregate";

/**
 * GET /api/reports?range=week|month|quarter|year&offset=0
 *
 * Live aggregations against Booking + Payment + User. Replaces the static
 * Excel snapshot once historical data is in DB (PRD-v3 §10).
 *
 *   offset = 0  → 本週 / 本月 / 本季 / 今年
 *   offset = -1 → 上週 / 上月 / 上季 / 去年
 *
 * Returns a `previousTotals` block for ±% comparison KPI cards.
 */
export async function GET(request: NextRequest) {
  const admin = await getAdminFromCookie(request);
  if (!admin) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sp = request.nextUrl.searchParams;
  const rangeParam = (sp.get("range") || "year") as RangeType;
  const offset = parseInt(sp.get("offset") || "0", 10) || 0;

  if (!["week", "month", "quarter", "year"].includes(rangeParam)) {
    return Response.json({ error: "invalid range" }, { status: 400 });
  }

  const current = computeRange(rangeParam, offset);
  const prev = previousPeriod(current);
  const tenantId = admin.tenantId;

  try {
    const [
      totals,
      prevTotals,
      trend,
      servicePie,
      heatmap,
      topServices,
      topCustomers,
      customerSegments,
      paymentMix,
      retention,
    ] = await Promise.all([
      computeTotals(tenantId, current),
      computeTotals(tenantId, prev),
      computeTrend(tenantId, current),
      computeServicePie(tenantId, current),
      computeHeatmap(tenantId, current),
      computeTopServices(tenantId, current, 10),
      computeTopCustomers(tenantId, current, 20),
      computeCustomerSegments(tenantId), // segment is point-in-time, no range
      computePaymentMix(tenantId, current),
      computeRetention(tenantId),         // tenant-wide, no range
    ]);

    return Response.json(
      {
        range: {
          type: current.type,
          offset: current.offset,
          label: current.label,
          fromIso: current.fromIso,
          toIso: current.toIso,
        },
        previousLabel: prev.label,
        totals,
        previousTotals: prevTotals,
        trend,
        servicePie,
        heatmap,
        topServices,
        topCustomers,
        customerSegments,
        paymentMix,
        retention,
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
        },
      },
    );
  } catch (err) {
    console.error("/api/reports failed", err);
    return Response.json(
      { error: "Failed to aggregate", detail: String(err) },
      { status: 500 },
    );
  }
}
