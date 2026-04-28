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

/**
 * Notify admin that a customer has reported a bank-transfer last-5-digit.
 * Dual-channel with the same mutex pattern.
 */
export async function notifyAdminTransferReported(params: {
  tenantId?: string;
  bookingId: string;
  displayName: string;
  serviceName: string;
  date: string;
  startTime: string;
  amount: number;
  transferLastFive: string;
}): Promise<void> {
  const { tenantId, bookingId, displayName, serviceName, date, startTime, amount, transferLastFive } = params;

  let webPushSent = 0;
  if (tenantId) {
    try {
      const result = await sendWebPushToAdmin(tenantId, {
        title: "待對帳轉帳",
        body: `${displayName} · 末5碼 ${transferLastFive} · NT$${amount}`,
        url: `/payments?q=${encodeURIComponent(transferLastFive)}`,
        tag: `payment-verify-${bookingId}`,
      });
      webPushSent = result.sent;
    } catch (err) {
      logger.error("Web Push transfer-reported failed", err, "admin-notify");
    }
  }

  const adminLineUserId = process.env.ADMIN_LINE_USER_ID;
  if (webPushSent === 0 && adminLineUserId) {
    try {
      const lineClient = getLineClient();
      // 老闆視覺辨識度：text + 官方 sticker（package 11537 / sticker 52002735 = "OK 兔兔"）
      // 合併成一個 multi-message push，一次到達避免 LINE 1 sec 限流
      await lineClient.pushMessage(adminLineUserId, [
        {
          type: "text",
          text: `💳 待對帳\n${displayName} · ${serviceName}\n${date} ${startTime}\n金額：NT$${amount.toLocaleString()}\n末五碼：${transferLastFive}`,
        },
        {
          type: "sticker",
          packageId: "11537",
          stickerId: "52002735",
        },
      ]);
    } catch (err) {
      logger.error("LINE push transfer-reported failed", err, "admin-notify");
    }
  }
}

/**
 * Notify admin that a customer submitted a consultation request (Wave 4a).
 * Same dual-channel mutex pattern.
 */
export async function notifyAdminNewConsultation(params: {
  tenantId?: string;
  consultationId: string;
  displayName: string;
  serviceName: string;
  hasPhoto: boolean;
}): Promise<void> {
  const { tenantId, consultationId, displayName, serviceName, hasPhoto } = params;

  let webPushSent = 0;
  if (tenantId) {
    try {
      const result = await sendWebPushToAdmin(tenantId, {
        title: "新諮詢請求",
        body: `${displayName} · ${serviceName}${hasPhoto ? "（含照片）" : ""}`,
        url: `/consultations?focus=${encodeURIComponent(consultationId)}`,
        tag: `consultation-${consultationId}`,
      });
      webPushSent = result.sent;
    } catch (err) {
      logger.error("Web Push consultation failed", err, "admin-notify");
    }
  }

  const adminLineUserId = process.env.ADMIN_LINE_USER_ID;
  if (webPushSent === 0 && adminLineUserId) {
    try {
      const lineClient = getLineClient();
      await lineClient.pushMessage(adminLineUserId, {
        type: "text",
        text: `💬 新諮詢請求\n${displayName} · ${serviceName}${hasPhoto ? "\n📷 含照片" : ""}\n\n👉 後台 /consultations 查看`,
      });
    } catch (err) {
      logger.error("LINE push consultation failed", err, "admin-notify");
    }
  }
}
