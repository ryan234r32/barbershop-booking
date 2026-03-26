import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyCronSecret } from "@/lib/utils/cron-auth";
import { createTenantLineClient } from "@/lib/line/client";
import { weeklyReportMessage } from "@/lib/line/messages";
import { generateWeeklyReport } from "@/app/api/admin/weekly-report/route";
import { logger } from "@/lib/utils/logger";

/** GET /api/cron/weekly-report — auto-send weekly report to admin via LINE
 *  Scheduled: Sunday 22:00 UTC = Monday 06:00 Taiwan time
 */
export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const adminLineUserId = process.env.ADMIN_LINE_USER_ID;
    if (!adminLineUserId) {
      logger.info("ADMIN_LINE_USER_ID not set, skipping weekly report push", "cron/weekly-report");
      return Response.json({
        success: true,
        skipped: true,
        reason: "ADMIN_LINE_USER_ID not configured",
      });
    }

    // Get all active tenants
    const tenants = await prisma.tenant.findMany({
      where: { isActive: true },
      select: {
        id: true,
        lineAccessToken: true,
        lineChannelSecret: true,
      },
    });

    let sent = 0;
    let failed = 0;

    for (const tenant of tenants) {
      try {
        const report = await generateWeeklyReport(tenant.id);
        const flexMsg = weeklyReportMessage(report);
        const lineClient = createTenantLineClient(
          tenant.lineAccessToken,
          tenant.lineChannelSecret
        );
        await lineClient.pushMessage(adminLineUserId, flexMsg);
        sent++;
        logger.info(`Weekly report sent for tenant ${tenant.id}`, "cron/weekly-report");
      } catch (err) {
        failed++;
        logger.error(
          `Failed to send weekly report for tenant ${tenant.id}`,
          err,
          "cron/weekly-report"
        );
      }
    }

    return Response.json({ success: true, sent, failed });
  } catch (error) {
    logger.error("Cron weekly-report failed", error, "cron/weekly-report");
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}
