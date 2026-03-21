import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { errorResponse } from "@/lib/utils/errors";
import { getAdminFromCookie } from "@/lib/auth/jwt";

/** GET /api/admin/analytics — dashboard analytics */
export async function GET(request: NextRequest) {
  try {
    const admin = await getAdminFromCookie(request);
    if (!admin) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const period = searchParams.get("period") || "week"; // week | month | year
    const tenantId = admin.tenantId;

    const now = new Date();
    let startDate: Date;

    switch (period) {
      case "month":
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case "year":
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      default: // week
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 7);
    }

    // Parallel queries for all analytics data
    const [
      totalBookings,
      completedBookings,
      cancelledBookings,
      noShowBookings,
      totalRevenue,
      newCustomers,
      segmentCounts,
      popularServices,
      dailyBookings,
    ] = await Promise.all([
      // Total bookings in period
      prisma.booking.count({
        where: { tenantId, createdAt: { gte: startDate } },
      }),

      // Completed bookings
      prisma.booking.count({
        where: { tenantId, status: "COMPLETED", date: { gte: startDate } },
      }),

      // Cancelled bookings
      prisma.booking.count({
        where: { tenantId, status: "CANCELLED", createdAt: { gte: startDate } },
      }),

      // No-shows
      prisma.booking.count({
        where: { tenantId, status: "NO_SHOW", date: { gte: startDate } },
      }),

      // Revenue from completed bookings
      prisma.payment.aggregate({
        _sum: { amount: true },
        where: {
          status: "RECEIVED",
          booking: { tenantId, date: { gte: startDate } },
        },
      }),

      // New customers
      prisma.user.count({
        where: { tenantId, createdAt: { gte: startDate } },
      }),

      // Customer segments
      prisma.user.groupBy({
        by: ["segment"],
        where: { tenantId },
        _count: true,
      }),

      // Popular services
      prisma.booking.groupBy({
        by: ["serviceId"],
        where: { tenantId, createdAt: { gte: startDate }, status: { not: "CANCELLED" } },
        _count: true,
        orderBy: { _count: { serviceId: "desc" } },
        take: 5,
      }),

      // Daily booking counts (last 7 days)
      prisma.$queryRaw`
        SELECT DATE(date) as day, COUNT(*)::int as count
        FROM bookings
        WHERE tenant_id = ${tenantId}
          AND date >= ${new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)}
          AND status != 'CANCELLED'
        GROUP BY DATE(date)
        ORDER BY day
      `,
    ]);

    // Fetch service names for popular services
    const serviceIds = popularServices.map((s) => s.serviceId);
    const services = serviceIds.length > 0
      ? await prisma.service.findMany({
          where: { id: { in: serviceIds } },
          select: { id: true, name: true },
        })
      : [];

    const serviceMap = new Map(services.map((s) => [s.id, s.name]));
    const popularServicesWithNames = popularServices.map((s) => ({
      serviceId: s.serviceId,
      serviceName: serviceMap.get(s.serviceId) || "Unknown",
      count: s._count,
    }));

    // Occupancy rate (completed / total capacity)
    const totalCapacity = 9 * 7; // 9 slots/day * 7 days
    const occupancyRate = totalCapacity > 0
      ? Math.round((completedBookings / totalCapacity) * 100)
      : 0;

    return Response.json({
      period,
      overview: {
        totalBookings,
        completedBookings,
        cancelledBookings,
        noShowBookings,
        revenue: totalRevenue._sum.amount || 0,
        newCustomers,
        occupancyRate,
      },
      segments: segmentCounts,
      popularServices: popularServicesWithNames,
      dailyBookings,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
