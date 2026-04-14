import { NextRequest } from "next/server";
import { getAdminFromCookie } from "@/lib/auth/jwt";
import { sendWebPushToAdmin } from "@/lib/push/web-push";
import { errorResponse, UnauthorizedError } from "@/lib/utils/errors";

/**
 * POST /api/push/test — fire a test notification to the caller's admin tenant.
 * Use this after enabling notifications to confirm end-to-end delivery (VAPID,
 * service worker, phone unlock/lock behaviour). Admin-only.
 */
export async function POST(request: NextRequest) {
  try {
    const admin = await getAdminFromCookie(request);
    if (!admin) throw new UnauthorizedError();

    const result = await sendWebPushToAdmin(admin.tenantId, {
      title: "🔔 測試通知",
      body: "如果你看到這個，推播串接成功了。",
      url: "/calendar",
      tag: "test-notification",
    });

    return Response.json({ ok: true, ...result });
  } catch (err) {
    return errorResponse(err);
  }
}
