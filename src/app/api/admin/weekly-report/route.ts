import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminFromCookie } from "@/lib/auth/jwt";
import { errorResponse } from "@/lib/utils/errors";
import { formatDateToISO, nowTaipei } from "@/lib/utils/time";

/** GET /api/admin/weekly-report — generate a weekly business summary */
export async function GET(request: NextRequest) {
  try {
    const admin = await getAdminFromCookie(request);
    if (!admin) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenantId = admin.tenantId;
    const report = await generateWeeklyReport(tenantId);

    return Response.json(report);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function generateWeeklyReport(tenantId: string) {
  const now = nowTaipei();
  const toDate = new Date(now);
  toDate.setHours(23, 59, 59, 999);

  const fromDate = new Date(now);
  fromDate.setDate(fromDate.getDate() - 7);
  fromDate.setHours(0, 0, 0, 0);

  // Run all queries in parallel
  const [
    totalBookings,
    completedBookings,
    cancelledBookings,
    noShowBookings,
    revenueAgg,
    newCustomers,
    returningCustomersResult,
    popularServicesRaw,
    segmentChangesData,
  ] = await Promise.all([
    // Total bookings created in period
    prisma.booking.count({
      where: { tenantId, createdAt: { gte: fromDate, lte: toDate } },
    }),

    // Completed bookings with date in period
    prisma.booking.count({
      where: { tenantId, status: "COMPLETED", date: { gte: fromDate, lte: toDate } },
    }),

    // Cancelled bookings
    prisma.booking.count({
      where: {
        tenantId,
        status: { in: ["CANCELLED", "CANCELLED_BY_ADMIN"] },
        createdAt: { gte: fromDate, lte: toDate },
      },
    }),

    // No-shows
    prisma.booking.count({
      where: { tenantId, status: "NO_SHOW", date: { gte: fromDate, lte: toDate } },
    }),

    // Revenue from completed bookings in period
    prisma.payment.aggregate({
      _sum: { amount: true },
      where: {
        status: "RECEIVED",
        booking: { tenantId, date: { gte: fromDate, lte: toDate } },
      },
    }),

    // New customers (registered in period)
    prisma.user.count({
      where: { tenantId, createdAt: { gte: fromDate, lte: toDate } },
    }),

    // Returning customers (had a booking in period but registered before period)
    prisma.user.count({
      where: {
        tenantId,
        createdAt: { lt: fromDate },
        bookings: {
          some: {
            date: { gte: fromDate, lte: toDate },
            status: { not: "CANCELLED" },
          },
        },
      },
    }),

    // Top service
    prisma.booking.groupBy({
      by: ["serviceId"],
      where: {
        tenantId,
        createdAt: { gte: fromDate, lte: toDate },
        status: { not: "CANCELLED" },
      },
      _count: true,
      orderBy: { _count: { serviceId: "desc" } },
      take: 1,
    }),

    // Segment changes: users whose segment changed in the period
    // We approximate by looking at current segment + updatedAt in the period
    Promise.all([
      // New to Regular (segment = REGULAR, updatedAt in period, createdAt before period)
      prisma.user.count({
        where: {
          tenantId,
          segment: "REGULAR",
          updatedAt: { gte: fromDate, lte: toDate },
          totalVisits: { gte: 1, lt: 6 },
        },
      }),
      // Regular to VIP
      prisma.user.count({
        where: {
          tenantId,
          segment: "VIP",
          updatedAt: { gte: fromDate, lte: toDate },
        },
      }),
      // To AT_RISK
      prisma.user.count({
        where: {
          tenantId,
          segment: "AT_RISK",
          updatedAt: { gte: fromDate, lte: toDate },
        },
      }),
      // To LAPSED
      prisma.user.count({
        where: {
          tenantId,
          segment: "LAPSED",
          updatedAt: { gte: fromDate, lte: toDate },
        },
      }),
    ]),
  ]);

  // Resolve top service name
  let topService: { name: string; count: number } = { name: "N/A", count: 0 };
  if (popularServicesRaw.length > 0) {
    const svc = await prisma.service.findUnique({
      where: { id: popularServicesRaw[0].serviceId },
      select: { name: true },
    });
    topService = {
      name: svc?.name || "Unknown",
      count: popularServicesRaw[0]._count,
    };
  }

  const revenue = revenueAgg._sum.amount || 0;
  const avgBookingsPerDay = Math.round((totalBookings / 7) * 10) / 10;

  // Occupancy rate: 9 slots per day * 7 days = 63 total capacity
  const totalCapacity = 9 * 7;
  const occupancyRate =
    totalCapacity > 0
      ? Math.round((completedBookings / totalCapacity) * 100)
      : 0;

  const [newToRegular, regularToVip, toAtRisk, toLapsed] = segmentChangesData;

  return {
    period: {
      from: formatDateToISO(fromDate),
      to: formatDateToISO(toDate),
    },
    summary: {
      totalBookings,
      completedBookings,
      cancelledBookings,
      noShowBookings,
      revenue,
      newCustomers,
      returningCustomers: returningCustomersResult,
      avgBookingsPerDay,
      topService,
      occupancyRate,
    },
    segmentChanges: {
      newToRegular,
      regularToVip,
      toAtRisk,
      toLapsed,
    },
  };
}
