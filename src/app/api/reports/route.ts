import { NextRequest } from "next/server";

/**
 * GET /api/reports — aggregate metrics for the 8 widgets in /reports.
 *
 * Stub for Wave 5 — needs: monthly revenue (YoY), heatmap (hour×weekday),
 * service distribution, customer segments, lapse trend, ARPU trend, cohort
 * retention (30/60/90d), cancellation/no-show ratio.
 *
 * Data sources:
 *   - System bookings (V3 onwards)
 *   - Wave 3.B Excel import (2025 historical, once parser calibrated)
 */
export async function GET(_request: NextRequest) {
  return Response.json(
    {
      error: "Not Implemented",
      message: "Wave 5 not yet built — see docs/PRD-v3.md §10.2",
      widgets: [
        "monthlyRevenue",
        "hourHeatmap",
        "servicePie",
        "customerSegments",
        "lapseTrend",
        "arpuTrend",
        "cohortRetention",
        "cancellationRate",
      ],
      dataSource: {
        systemBookings: "ready",
        historicalExcel: "pending Wave 3.B parser calibration",
      },
    },
    { status: 501 },
  );
}
