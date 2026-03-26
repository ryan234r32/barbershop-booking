import { prisma } from "@/lib/prisma";
import { getLineClient } from "@/lib/line/client";
import { reminderMessage, thankYouMessage } from "@/lib/line/messages";

/**
 * Process and send all pending notifications that are due.
 * Called by the /api/cron/reminders endpoint every 15 minutes.
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

      // Handle THANK_YOU notifications (for completed bookings)
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
      } else if (booking && booking.status === "CONFIRMED") {
        // Handle REMINDER notifications
        const hoursUntil = notification.type === "REMINDER_24H" ? 24 : 1;

        const message = reminderMessage({
          serviceName: booking.service.name,
          date: booking.date.toISOString().split("T")[0],
          startTime: booking.startTime,
          shopName: booking.tenant.businessName,
          hoursUntil,
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
