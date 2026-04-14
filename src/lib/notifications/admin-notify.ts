import { getLineClient } from "@/lib/line/client";
import { adminNewBookingMessage, adminCancellationMessage } from "@/lib/line/messages";
import { sendWebPushToAdmin } from "@/lib/push/web-push";
import { logger } from "@/lib/utils/logger";

/**
 * Send admin notifications when a new booking is created.
 *
 * Dual-channel with mutex: Web Push takes precedence when any subscription
 * delivered; LINE is the fallback only when Web Push reached zero devices.
 * Avoids double-pinging the admin when both channels are configured.
 *
 *   tenantId given AND ≥1 sub delivered → PWA only
 *   no tenantId OR 0 subs delivered      → LINE (if ADMIN_LINE_USER_ID set)
 *   both empty                           → warn (admin is blind to new bookings)
 */
export async function notifyAdminNewBooking(params: {
  tenantId?: string;
  /** Used to drive the admin acknowledge flow — tap-to-confirm in calendar. */
  bookingId?: string;
  displayName: string;
  serviceName: string;
  date: string;
  startTime: string;
  endTime: string;
  price: number;
}): Promise<void> {
  const { tenantId, bookingId, displayName, serviceName, date, startTime } = params;

  // Notification URL drives the post-tap behaviour:
  //   /calendar?date=YYYY-MM-DD&ack=<bookingId>
  // The calendar page reads `date` to switch view, and `ack` to auto-open the
  // BookingDetailSheet with a "✓ 已確認" button. Falls back to /calendar if no id.
  const url = bookingId
    ? `/calendar?date=${encodeURIComponent(date)}&ack=${encodeURIComponent(bookingId)}`
    : "/calendar";

  // Channel 1: Web Push (PWA)
  let webPushSent = 0;
  if (tenantId) {
    try {
      const result = await sendWebPushToAdmin(tenantId, {
        title: "新預約",
        body: `${displayName} · ${serviceName} · ${date} ${startTime}`,
        url,
        tag: `booking-new-${date}-${startTime}`,
      });
      webPushSent = result.sent;
    } catch (err) {
      logger.error("Web Push new-booking failed", err, "admin-notify");
    }
  }

  // Channel 2: LINE fallback — only if Web Push reached zero devices
  const adminLineUserId = process.env.ADMIN_LINE_USER_ID;
  if (webPushSent === 0 && adminLineUserId) {
    try {
      const lineClient = getLineClient();
      const message = adminNewBookingMessage(params);
      await lineClient.pushMessage(adminLineUserId, message);
    } catch (err) {
      logger.error("LINE push new-booking failed", err, "admin-notify");
    }
    return;
  }

  if (webPushSent === 0 && !adminLineUserId) {
    logger.warn(
      "admin not notified — no active push subscriptions and no ADMIN_LINE_USER_ID",
      "admin-notify",
      { tenantId, date, startTime }
    );
  }
}

/**
 * Send admin notifications when a booking is cancelled.
 * Same dual-channel mutex as notifyAdminNewBooking.
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

  let webPushSent = 0;
  if (tenantId) {
    const who = cancelledBy === "admin" ? "(店家取消)" : isViolation ? "(違規)" : "";
    try {
      const result = await sendWebPushToAdmin(tenantId, {
        title: `取消預約 ${who}`.trim(),
        body: `${displayName} · ${serviceName} · ${date} ${startTime}`,
        url: "/calendar",
        tag: `booking-cancel-${date}-${startTime}`,
      });
      webPushSent = result.sent;
    } catch (err) {
      logger.error("Web Push cancellation failed", err, "admin-notify");
    }
  }

  const adminLineUserId = process.env.ADMIN_LINE_USER_ID;
  if (webPushSent === 0 && adminLineUserId) {
    try {
      const lineClient = getLineClient();
      const message = adminCancellationMessage(params);
      await lineClient.pushMessage(adminLineUserId, message);
    } catch (err) {
      logger.error("LINE push cancellation failed", err, "admin-notify");
    }
  }
}
