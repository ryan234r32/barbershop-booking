import { prisma } from "@/lib/prisma";
import { getLineClient } from "@/lib/line/client";
import {
  reminderMessage,
  thankYouMessage,
  followUpMessage,
  birthdayMessage,
} from "@/lib/line/messages";

/**
 * Process and send all pending notifications that are due.
 * Called by the /api/cron/reminders endpoint hourly.
 */
export async function processPendingNotifications() {
  const now = new Date();

  const pendingNotifications = await prisma.notification.findMany({
    where: {
      status: "PENDING",
      scheduledAt: { lte: now },
    },
    include: {
      booking: {
        include: {
          service: true,
          tenant: true,
        },
      },
    },
    take: 50, // Process in batches
  });

  const lineClient = getLineClient();
  const results = { sent: 0, failed: 0 };

  for (const notification of pendingNotifications) {
    try {
      const { booking } = notification;

      // --- THANK_YOU ---
      if (notification.type === "THANK_YOU" && booking) {
        const liffUrl = `https://liff.line.me/${booking.tenant.liffId || process.env.NEXT_PUBLIC_LIFF_ID}`;
        const message = thankYouMessage({
          shopName: booking.tenant.businessName,
          serviceName: booking.service.name,
          liffUrl,
        });

        await lineClient.pushMessage(notification.lineUserId, message);
        await prisma.notification.update({
          where: { id: notification.id },
          data: { status: "SENT", sentAt: now },
        });
        results.sent++;

      // --- FOLLOW_UP_7D ---
      } else if (notification.type === "FOLLOW_UP_7D" && booking) {
        const liffUrl = `https://liff.line.me/${booking.tenant.liffId || process.env.NEXT_PUBLIC_LIFF_ID}`;
        const payload = notification.messagePayload as {
          serviceType: "perm" | "color";
        } | null;
        const serviceType = payload?.serviceType || "perm";

        const message = followUpMessage({
          serviceType,
          serviceName: booking.service.name,
          shopName: booking.tenant.businessName,
          liffUrl,
        });

        await lineClient.pushMessage(notification.lineUserId, message);
        await prisma.notification.update({
          where: { id: notification.id },
          data: { status: "SENT", sentAt: now },
        });
        results.sent++;

      // --- BIRTHDAY_GREETING ---
      } else if (notification.type === "BIRTHDAY_GREETING") {
        // Birthday notifications have no booking — use messagePayload for displayName
        const payload = notification.messagePayload as {
          displayName?: string | null;
        } | null;

        // Get tenant info for shop name and LIFF URL
        const tenant = await prisma.tenant.findUnique({
          where: { id: notification.tenantId },
        });
        if (!tenant) {
          await prisma.notification.update({
            where: { id: notification.id },
            data: { status: "FAILED", errorMessage: "Tenant not found" },
          });
          results.failed++;
          continue;
        }

        const liffUrl = `https://liff.line.me/${tenant.liffId || process.env.NEXT_PUBLIC_LIFF_ID}`;
        const message = birthdayMessage({
          displayName: payload?.displayName || "",
          shopName: tenant.businessName,
          liffUrl,
        });

        await lineClient.pushMessage(notification.lineUserId, message);
        await prisma.notification.update({
          where: { id: notification.id },
          data: { status: "SENT", sentAt: now },
        });
        results.sent++;

      // --- REMINDER (24H or 2H) ---
      } else if (booking && booking.status === "CONFIRMED") {
        const reminderLiffUrl = booking.tenant.liffId
          ? `https://liff.line.me/${booking.tenant.liffId}`
          : undefined;
        const hoursUntil = notification.type === "REMINDER_2H" ? 2 : 24;
        const message = reminderMessage({
          serviceName: booking.service.name,
          date: booking.date.toISOString().split("T")[0],
          startTime: booking.startTime,
          shopName: booking.tenant.businessName,
          hoursUntil,
          bookingId: booking.id,
          liffBaseUrl: reminderLiffUrl,
          shopAddress: booking.tenant.address || undefined,
        });

        await lineClient.pushMessage(notification.lineUserId, message);
        await prisma.notification.update({
          where: { id: notification.id },
          data: { status: "SENT", sentAt: now },
        });
        results.sent++;

      } else {
        // Booking was cancelled or missing — skip notification
        await prisma.notification.update({
          where: { id: notification.id },
          data: { status: "CANCELLED" },
        });
      }
    } catch (error) {
      await prisma.notification.update({
        where: { id: notification.id },
        data: {
          status: "FAILED",
          errorMessage: error instanceof Error ? error.message : "Unknown error",
        },
      });
      results.failed++;
    }
  }

  return results;
}
