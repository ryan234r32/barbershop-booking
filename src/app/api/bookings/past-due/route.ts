import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminFromCookie } from "@/lib/auth/jwt";
import { errorResponse } from "@/lib/utils/errors";
import { nowTaipei, formatTime, todayInTaipei } from "@/lib/utils/time";

/** GET /api/bookings/past-due — list CONFIRMED bookings whose time has passed */
export async function GET(request: NextRequest) {
  try {
    const admin = await getAdminFromCookie(request);
    if (!admin) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Date uses todayInTaipei() (TZ-safe). Time keeps nowTaipei() because
    // formatTime → .getHours() coincidentally returns Taipei wall-clock on
    // UTC servers thanks to the buggy nowTaipei() shift.
    const todayStr = todayInTaipei();
    const currentTime = formatTime(nowTaipei());

    const pastDue = await prisma.booking.findMany({
      where: {
        tenantId: admin.tenantId,
        status: "CONFIRMED",
        OR: [
          // Bookings from before today
          { date: { lt: new Date(todayStr + "T00:00:00.000Z") } },
          // Bookings from today whose endTime has passed
          {
            date: new Date(todayStr + "T00:00:00.000Z"),
            endTime: { lte: currentTime },
          },
        ],
      },
      include: {
        service: { select: { name: true, price: true } },
        user: { select: { displayName: true } },
        payment: { select: { status: true, method: true, transferLastFive: true } },
      },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
    });

    return Response.json({ bookings: pastDue });
  } catch (error) {
    return errorResponse(error);
  }
}
