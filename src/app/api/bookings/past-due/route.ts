import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminFromCookie } from "@/lib/auth/jwt";
import { errorResponse } from "@/lib/utils/errors";
import { nowTaipei, formatTime } from "@/lib/utils/time";
import { TIMEZONE } from "@/lib/utils/constants";

/** GET /api/bookings/past-due — list CONFIRMED bookings whose time has passed */
export async function GET(request: NextRequest) {
  try {
    const admin = await getAdminFromCookie(request);
    if (!admin) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = nowTaipei();
    const todayStr = now.toLocaleDateString("en-CA", { timeZone: TIMEZONE });
    const currentTime = formatTime(now);

    const pastDue = await prisma.booking.findMany({
      where: {
        tenantId: admin.tenantId,
        status: "CONFIRMED",
        OR: [
          // Bookings from before today
          { date: { lt: new Date(todayStr + "T00:00:00+08:00") } },
          // Bookings from today whose endTime has passed
          {
            date: new Date(todayStr + "T00:00:00+08:00"),
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
