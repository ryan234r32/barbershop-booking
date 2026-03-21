import { prisma } from "@/lib/prisma";

/**
 * Schedule reminder notifications for a booking.
 * Creates 24h and 1h reminder entries in the notifications table.
 */
export async function scheduleReminders(params: {
  tenantId: string;
  bookingId: string;
  lineUserId: string;
  bookingDate: Date;
  startTime: string;
}) {
  const { tenantId, bookingId, lineUserId, bookingDate, startTime } = params;

  const [hours] = startTime.split(":").map(Number);

  // Create a datetime for the booking's start in Taipei timezone
  const bookingDateTime = new Date(bookingDate);
  bookingDateTime.setHours(hours, 0, 0, 0);

  // 24h before
  const reminder24h = new Date(bookingDateTime.getTime() - 24 * 60 * 60 * 1000);
  // 1h before
  const reminder1h = new Date(bookingDateTime.getTime() - 1 * 60 * 60 * 1000);

  const now = new Date();

  const notifications = [];

  // Only schedule if the reminder time is in the future
  if (reminder24h > now) {
    notifications.push({
      tenantId,
      bookingId,
      type: "REMINDER_24H" as const,
      scheduledAt: reminder24h,
      lineUserId,
      status: "PENDING" as const,
    });
  }

  if (reminder1h > now) {
    notifications.push({
      tenantId,
      bookingId,
      type: "REMINDER_1H" as const,
      scheduledAt: reminder1h,
      lineUserId,
      status: "PENDING" as const,
    });
  }

  if (notifications.length > 0) {
    await prisma.notification.createMany({ data: notifications });
  }
}

/**
 * Cancel all pending notifications for a booking.
 */
export async function cancelBookingNotifications(bookingId: string) {
  await prisma.notification.updateMany({
    where: {
      bookingId,
      status: "PENDING",
    },
    data: {
      status: "CANCELLED",
    },
  });
}
