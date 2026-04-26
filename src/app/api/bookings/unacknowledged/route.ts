import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminFromCookie } from "@/lib/auth/jwt";
import { errorResponse, UnauthorizedError } from "@/lib/utils/errors";
import { nowTaipei, formatDateToISO } from "@/lib/utils/time";

/**
 * GET /api/bookings/unacknowledged — bookings the admin still needs to confirm.
 *
 * Filter logic (matches plan A — "all unacked future bookings"):
 *   adminAcknowledgedAt IS NULL
 *   AND status = CONFIRMED
 *   AND date >= today (Taipei)
 *
 * Past bookings are excluded — they fall into the past-due flow instead.
 * Order: chronological (closest first) so the queue presents urgency.
 *
 * Same-day bookings whose startTime has already passed: still included if
 * date == today (we don't compare hours; close enough for shop-owner UX, and
 * past-due cron will catch genuinely missed ones).
 */
export async function GET(request: NextRequest) {
  try {
    const admin = await getAdminFromCookie(request);
    if (!admin) throw new UnauthorizedError();

    const todayStr = formatDateToISO(nowTaipei());
    const todayStart = new Date(todayStr + "T00:00:00.000Z");

    const bookings = await prisma.booking.findMany({
      where: {
        tenantId: admin.tenantId,
        status: "CONFIRMED",
        adminAcknowledgedAt: null,
        date: { gte: todayStart },
      },
      include: {
        service: { select: { name: true, price: true, slotsNeeded: true } },
        user: {
          select: {
            id: true,
            displayName: true,
            phone: true,
            segment: true,
            totalVisits: true,
            notes: true,
            lastVisitAt: true,
          },
        },
      },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
    });

    return Response.json({ bookings, total: bookings.length });
  } catch (err) {
    return errorResponse(err);
  }
}
