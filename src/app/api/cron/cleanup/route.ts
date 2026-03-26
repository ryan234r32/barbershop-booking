import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { resetExpiredViolations } from "@/lib/crm/segmentation";
import { verifyCronSecret } from "@/lib/utils/cron-auth";
import { logger } from "@/lib/utils/logger";

/** GET /api/cron/cleanup — daily cleanup tasks */
export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 1. Reset expired violations (monthly auto-reset)
    const violationsReset = await resetExpiredViolations();

    // 2. Mark past CONFIRMED bookings as NO_SHOW if still confirmed after their date
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    const noShowResult = await prisma.booking.updateMany({
      where: {
        status: "CONFIRMED",
        date: { lt: yesterday },
      },
      data: { status: "NO_SHOW" },
    });

    // 3. Clean up old sent notifications (older than 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const cleanedNotifications = await prisma.notification.deleteMany({
      where: {
        status: { in: ["SENT", "CANCELLED"] },
        createdAt: { lt: thirtyDaysAgo },
      },
    });

    return Response.json({
      success: true,
      violationsReset,
      noShowsMarked: noShowResult.count,
      notificationsCleaned: cleanedNotifications.count,
    });
  } catch (error) {
    logger.error("Cron cleanup failed", error, "cron/cleanup");
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}
