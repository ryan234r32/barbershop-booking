import { prisma } from "@/lib/prisma";
import { getLineClient } from "@/lib/line/client";
import { reminderMessage } from "@/lib/line/messages";

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
      if (notification.booking && notification.booking.status === "CONFIRMED") {
        const { booking } = notification;
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
        // Booking was cancelled — skip notification
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
