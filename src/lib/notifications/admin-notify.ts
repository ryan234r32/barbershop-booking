import { getLineClient } from "@/lib/line/client";
import { adminNewBookingMessage, adminCancellationMessage } from "@/lib/line/messages";
import { sendWebPushToAdmin } from "@/lib/push/web-push";
import { logger } from "@/lib/utils/logger";

/**
 * Send notifications to admin when a new booking is created.
 * Two channels (either or both):
 *  - Web Push: always attempted if tenantId is provided and admin subscribed
 *  - LINE push: only if ADMIN_LINE_USER_ID env is set (opt-in backup channel)
 * Fire-and-forget — must never block booking creation.
 */
export async function notifyAdminNewBooking(params: {
  tenantId?: string;
  displayName: string;
  serviceName: string;
  date: string;
  startTime: string;
  endTime: string;
  price: number;
}): Promise<void> {
  const { tenantId, displayName, serviceName, date, startTime } = params;

  // Channel 1: Web Push (primary — PWA on admin's phone)
  if (tenantId) {
    sendWebPushToAdmin(tenantId, {
      title: "新預約",
      body: `${displayName} · ${serviceName} · ${date} ${startTime}`,
      url: "/calendar",
      tag: `booking-new-${date}-${startTime}`,
    }).catch((err) => logger.error("Web Push new-booking failed", err, "admin-notify"));
  }

  // Channel 2: LINE push (optional backup — only if env configured)
  const adminLineUserId = process.env.ADMIN_LINE_USER_ID;
  if (adminLineUserId) {
    try {
      const lineClient = getLineClient();
      const message = adminNewBookingMessage(params);
      await lineClient.pushMessage(adminLineUserId, message);
    } catch (err) {
      logger.error("LINE push new-booking failed", err, "admin-notify");
    }
  }
}

/**
 * Send notifications to admin when a booking is cancelled.
 * Same dual-channel approach as notifyAdminNewBooking.
 */
export async function notifyAdminCancellation(params: {
  tenantId?: string;
  displayName: string;
  serviceName: string;
  date: string;
  startTime: string;
  isViolation: boolean;
  cancelledBy: "customer" | "admin";
}): Promise<void> {
  const { tenantId, displayName, serviceName, date, startTime, isViolation, cancelledBy } = params;

  if (tenantId) {
    const who = cancelledBy === "admin" ? "(店家取消)" : isViolation ? "(違規)" : "";
    sendWebPushToAdmin(tenantId, {
      title: `取消預約 ${who}`.trim(),
      body: `${displayName} · ${serviceName} · ${date} ${startTime}`,
      url: "/calendar",
      tag: `booking-cancel-${date}-${startTime}`,
    }).catch((err) => logger.error("Web Push cancellation failed", err, "admin-notify"));
  }

  const adminLineUserId = process.env.ADMIN_LINE_USER_ID;
  if (adminLineUserId) {
    try {
      const lineClient = getLineClient();
      const message = adminCancellationMessage(params);
      await lineClient.pushMessage(adminLineUserId, message);
    } catch (err) {
      logger.error("LINE push cancellation failed", err, "admin-notify");
    }
  }
}
