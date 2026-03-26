import { NextRequest } from "next/server";
import { processPendingNotifications } from "@/lib/notifications/sender";
import { verifyCronSecret } from "@/lib/utils/cron-auth";
import { logger } from "@/lib/utils/logger";

/** GET /api/cron/reminders — Vercel Cron Job to send pending notifications */
export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await processPendingNotifications();
    return Response.json({
      success: true,
      sent: result.sent,
      failed: result.failed,
    });
  } catch (error) {
    logger.error("Cron reminders failed", error, "cron/reminders");
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}
