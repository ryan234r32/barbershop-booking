import { prisma } from "@/lib/prisma";
import { formatDateToISO, nowTaipei } from "@/lib/utils/time";

export async function generateWeeklyReport(tenantId: string) {
  const now = nowTaipei();
  const toDate = new Date(now);
  toDate.setHours(23, 59, 59, 999);

  const fromDate = new Date(now);
  fromDate.setDate(fromDate.getDate() - 7);
  fromDate.setHours(0, 0, 0, 0);

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
    prisma.booking.count({
      where: { tenantId, createdAt: { gte: fromDate, lte: toDate } },
    }),
    prisma.booking.count({
      where: { tenantId, status: "COMPLETED", date: { gte: fromDate, lte: toDate } },
    }),
    prisma.booking.count({
      where: {
        tenantId,
        status: { in: ["CANCELLED", "CANCELLED_BY_ADMIN"] },
        createdAt: { gte: fromDate, lte: toDate },
      },
    }),
    prisma.booking.count({
      where: { tenantId, status: "NO_SHOW", date: { gte: fromDate, lte: toDate } },
    }),
    prisma.payment.aggregate({
      _sum: { amount: true },
      where: {
        status: "RECEIVED",
        booking: { tenantId, date: { gte: fromDate, lte: toDate } },
      },
    }),
    prisma.user.count({
      where: { tenantId, createdAt: { gte: fromDate, lte: toDate } },
    }),
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
    Promise.all([
      prisma.user.count({
        where: {
          tenantId,
          segment: "REGULAR",
          updatedAt: { gte: fromDate, lte: toDate },
          totalVisits: { gte: 1, lt: 6 },
        },
      }),
      prisma.user.count({
        where: {
          tenantId,
          segment: "VIP",
          updatedAt: { gte: fromDate, lte: toDate },
        },
      }),
      prisma.user.count({
        where: {
          tenantId,
          segment: "AT_RISK",
          updatedAt: { gte: fromDate, lte: toDate },
        },
      }),
      prisma.user.count({
        where: {
          tenantId,
          segment: "LAPSED",
          updatedAt: { gte: fromDate, lte: toDate },
        },
      }),
    ]),
  ]);

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
