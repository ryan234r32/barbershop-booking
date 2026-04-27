import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getLineClient } from "@/lib/line/client";
import { dailySettlementMessage } from "@/lib/line/messages";
import { verifyCronSecret } from "@/lib/utils/cron-auth";
import { todayInTaipei } from "@/lib/utils/time";
import { logger } from "@/lib/utils/logger";

/** GET /api/cron/daily-settlement — push daily settlement to admin at 20:30 Taipei */
export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const adminLineUserId = process.env.ADMIN_LINE_USER_ID;
    if (!adminLineUserId) {
      return Response.json({ success: true, skipped: true, reason: "ADMIN_LINE_USER_ID not set" });
    }

    // todayInTaipei() avoids the nowTaipei() UTC-server day-shift bug.
    const todayStr = todayInTaipei();
    const todayDate = new Date(todayStr + "T00:00:00.000Z");

    // Get all tenants (for multi-tenant support)
    const tenants = await prisma.tenant.findMany({ select: { id: true, businessName: true } });

    let totalSent = 0;

    for (const tenant of tenants) {
      const bookings = await prisma.booking.findMany({
        where: { tenantId: tenant.id, date: todayDate },
        include: {
          service: { select: { name: true, price: true } },
          user: { select: { displayName: true } },
        },
        orderBy: { startTime: "asc" },
      });

      if (bookings.length === 0) continue;

      const completed = bookings.filter((b) => b.status === "COMPLETED");
      const noShow = bookings.filter((b) => b.status === "NO_SHOW");
      const unresolved = bookings.filter((b) => b.status === "CONFIRMED");
      const revenue = completed.reduce((sum, b) => sum + b.service.price, 0);

      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://barbershop-booking-swart.vercel.app";

      const message = dailySettlementMessage({
        date: todayStr,
        bookings: bookings.map((b) => ({
          customerName: b.user.displayName || "未知",
          serviceName: b.service.name,
          startTime: b.startTime,
          status: b.status,
          price: b.service.price,
        })),
        summary: {
          total: bookings.length,
          completed: completed.length,
          noShow: noShow.length,
          unresolved: unresolved.length,
          revenue,
        },
        dashboardUrl: `${baseUrl}/dashboard`,
      });

      try {
        const lineClient = getLineClient();
        await lineClient.pushMessage(adminLineUserId, message);
        totalSent++;
      } catch (err) {
        logger.error("Failed to push daily settlement", err, "cron");
      }
    }

    return Response.json({ success: true, sent: totalSent });
  } catch (error) {
    logger.error("Daily settlement cron failed", error, "cron");
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}
