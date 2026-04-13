import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminFromCookie } from "@/lib/auth/jwt";
import { errorResponse } from "@/lib/utils/errors";

/** GET /api/bookings/monthly-summary?month=2026-04 — aggregated month data */
export async function GET(request: NextRequest) {
  try {
    const admin = await getAdminFromCookie(request);
    if (!admin) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const month = request.nextUrl.searchParams.get("month");
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return Response.json({ error: "Invalid month format (YYYY-MM)" }, { status: 400 });
    }

    const [year, monthNum] = month.split("-").map(Number);
    const startDate = new Date(Date.UTC(year, monthNum - 1, 1));
    const endDate = new Date(Date.UTC(year, monthNum, 0, 23, 59, 59));

    const dailyData = (await prisma.$queryRaw`
      SELECT
        DATE(date) as day,
        COUNT(*)::int as count,
        COALESCE(SUM(s.price), 0)::int as revenue
      FROM bookings b
      JOIN services s ON b.service_id = s.id
      WHERE b.tenant_id = ${admin.tenantId}
        AND b.date >= ${startDate}
        AND b.date <= ${endDate}
        AND b.status NOT IN ('CANCELLED', 'CANCELLED_BY_ADMIN')
      GROUP BY DATE(date)
      ORDER BY day
    `) as Array<{ day: Date; count: number; revenue: number }>;

    const days: Record<string, { count: number; revenue: number }> = {};
    for (const row of dailyData) {
      const dateStr = row.day instanceof Date
        ? row.day.toISOString().split("T")[0]
        : String(row.day);
      days[dateStr] = { count: row.count, revenue: row.revenue };
    }

    return Response.json({ days });
  } catch (error) {
    return errorResponse(error);
  }
}
