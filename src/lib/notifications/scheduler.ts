import { prisma } from "@/lib/prisma";
import { TIMEZONE } from "@/lib/utils/constants";
import { logger } from "@/lib/utils/logger";

/**
 * Schedule a reminder notification for a booking.
 * Creates a REMINDER_24H entry scheduled at 20:00 Taipei time the evening before.
 */
export async function scheduleReminders(params: {
  tenantId: string;
  bookingId: string;
  lineUserId: string;
  bookingDate: Date;
  startTime: string;
}) {
  const { tenantId, bookingId, lineUserId, bookingDate } = params;

  // Pin reminder to 20:00 Taipei time the evening before the booking
  const bookingDateStr = bookingDate.toLocaleDateString("en-CA", {
    timeZone: TIMEZONE,
  });
  // Create a Date for the day before at 20:00 Taipei time
  const [year, month, day] = bookingDateStr.split("-").map(Number);
  const eveningBefore = new Date(
    Date.UTC(year, month - 1, day - 1, 20 - 8, 0, 0) // 20:00 Taipei = 12:00 UTC
  );

  const now = new Date();

  if (eveningBefore > now) {
    await prisma.notification.create({
      data: {
        tenantId,
        bookingId,
        type: "REMINDER_24H",
        scheduledAt: eveningBefore,
        lineUserId,
        status: "PENDING",
      },
    });
  }
}

/**
 * Schedule a thank-you notification for a completed booking.
 * Sends 30 minutes after the booking is marked COMPLETED.
 */
export async function scheduleThankYou(params: {
  tenantId: string;
  bookingId: string;
  lineUserId: string;
}) {
  const { tenantId, bookingId, lineUserId } = params;

  const scheduledAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes from now

  await prisma.notification.create({
    data: {
      tenantId,
      bookingId,
      type: "THANK_YOU",
      scheduledAt,
      lineUserId,
      status: "PENDING",
    },
  });
}

/**
 * Schedule a 7-day follow-up for perm/color services.
 * Only creates a notification if the service is perm (燙), color (染), or bleach (漂).
 */
export async function scheduleFollowUp(params: {
  tenantId: string;
  bookingId: string;
  lineUserId: string;
  serviceName: string;
}) {
  const { tenantId, bookingId, lineUserId, serviceName } = params;

  const serviceType = detectServiceType(serviceName);
  if (!serviceType) return; // Not a perm/color service — skip

  // Schedule 7 days from now, pinned to 11:00 Taipei time
  const now = new Date();
  const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const dateStr = sevenDaysLater.toLocaleDateString("en-CA", {
    timeZone: TIMEZONE,
  });
  const [year, month, day] = dateStr.split("-").map(Number);
  const scheduledAt = new Date(
    Date.UTC(year, month - 1, day, 11 - 8, 0, 0) // 11:00 Taipei = 03:00 UTC
  );

  await prisma.notification.create({
    data: {
      tenantId,
      bookingId,
      type: "FOLLOW_UP_7D",
      scheduledAt,
      lineUserId,
      status: "PENDING",
      messagePayload: { serviceType },
    },
  });
}

/**
 * Schedule birthday greeting notifications for users whose birthday is today.
 * Deduplicates by checking if a BIRTHDAY_GREETING was already sent this year.
 */
export async function scheduleBirthdayNotifications(tenantId: string) {
  const now = new Date();
  const taipeiNow = new Date(
    now.toLocaleString("en-US", { timeZone: TIMEZONE })
  );
  const currentMonth = taipeiNow.getMonth() + 1;
  const currentDay = taipeiNow.getDate();
  const currentYear = taipeiNow.getFullYear();

  // Find users with today's birthday
  const birthdayUsers = await prisma.user.findMany({
    where: {
      tenantId,
      birthdayMonth: currentMonth,
      birthdayDay: currentDay,
      lineUserId: { not: "" },
    },
    select: {
      id: true,
      lineUserId: true,
      displayName: true,
    },
  });

  if (birthdayUsers.length === 0) return 0;

  // Check which users already got a birthday greeting this year
  const yearStart = new Date(Date.UTC(currentYear, 0, 1));
  const existingGreetings = await prisma.notification.findMany({
    where: {
      tenantId,
      type: "BIRTHDAY_GREETING",
      lineUserId: { in: birthdayUsers.map((u) => u.lineUserId) },
      createdAt: { gte: yearStart },
      status: { in: ["PENDING", "SENT"] },
    },
    select: { lineUserId: true },
  });

  const alreadySent = new Set(existingGreetings.map((n) => n.lineUserId));
  const toSchedule = birthdayUsers.filter(
    (u) => !alreadySent.has(u.lineUserId)
  );

  if (toSchedule.length === 0) return 0;

  await prisma.notification.createMany({
    data: toSchedule.map((user) => ({
      tenantId,
      type: "BIRTHDAY_GREETING" as const,
      scheduledAt: now, // Immediately processable
      lineUserId: user.lineUserId,
      status: "PENDING" as const,
      messagePayload: { displayName: user.displayName },
    })),
  });

  logger.info(
    `Scheduled ${toSchedule.length} birthday greetings`,
    "scheduler",
    { tenantId, month: currentMonth, day: currentDay }
  );

  return toSchedule.length;
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

/** Detect if a service is perm or color based on its Chinese name */
export function detectServiceType(
  serviceName: string
): "perm" | "color" | null {
  if (serviceName.includes("漂") || serviceName.includes("染")) return "color";
  if (serviceName.includes("燙")) return "perm";
  return null;
}
