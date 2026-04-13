import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { processPendingNotifications } from "@/lib/notifications/sender";
import { scheduleBirthdayNotifications } from "@/lib/notifications/scheduler";
import { verifyCronSecret } from "@/lib/utils/cron-auth";
import { logger } from "@/lib/utils/logger";
import { TIMEZONE } from "@/lib/utils/constants";

/** GET /api/cron/reminders — Vercel Cron Job (hourly) to schedule birthdays + send pending notifications */
export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    let birthdayCount = 0;

    // Schedule birthday greetings once per day at 9 AM Taipei time
    const taipeiHour = parseInt(
      new Date().toLocaleString("en-US", {
        timeZone: TIMEZONE,
        hour: "numeric",
        hour12: false,
      })
    );

    if (taipeiHour === 9) {
      const tenants = await prisma.tenant.findMany({
        where: { isActive: true },
        select: { id: true },
      });

      for (const tenant of tenants) {
        try {
          const count = await scheduleBirthdayNotifications(tenant.id);
          birthdayCount += count;
        } catch (err) {
          logger.error(
            `Failed to schedule birthdays for tenant ${tenant.id}`,
            err,
            "cron/reminders"
          );
        }
      }
    }

    // Process all pending notifications (reminders, thank-you, follow-ups, birthdays)
    const result = await processPendingNotifications();

    return Response.json({
      success: true,
      sent: result.sent,
      failed: result.failed,
      birthdaysScheduled: birthdayCount,
    });
  } catch (error) {
    logger.error("Cron reminders failed", error, "cron/reminders");
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}
