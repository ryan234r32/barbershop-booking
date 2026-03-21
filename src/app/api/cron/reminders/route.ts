import { NextRequest } from "next/server";
import { processPendingNotifications } from "@/lib/notifications/sender";

/** GET /api/cron/reminders — Vercel Cron Job to send pending notifications */
export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
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
    console.error("Cron reminders error:", error);
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}
