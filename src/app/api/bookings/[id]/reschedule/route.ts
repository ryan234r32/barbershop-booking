import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { isSlotAvailable } from "@/lib/booking/availability";
import { acquireBookingLock, releaseBookingLock } from "@/lib/booking/lock";
import { cancelBookingNotifications, scheduleReminders } from "@/lib/notifications/scheduler";
import { getLineClient } from "@/lib/line/client";
import { rescheduleConfirmationMessage } from "@/lib/line/messages";
import { notifyAdminNewBooking } from "@/lib/notifications/admin-notify";
import { rescheduleBookingSchema } from "@/lib/utils/validation";
import { errorResponse, SlotUnavailableError } from "@/lib/utils/errors";
import { addHours } from "@/lib/utils/time";
import { logger } from "@/lib/utils/logger";

type RouteParams = { params: Promise<{ id: string }> };

/** POST /api/bookings/[id]/reschedule — reschedule an existing booking */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    const input = rescheduleBookingSchema.parse(body);

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: {
        user: true,
        service: true,
        tenant: true,
      },
    });

    if (!booking) {
      return Response.json({ error: "Booking not found" }, { status: 404 });
    }

    if (booking.status !== "CONFIRMED") {
      return Response.json({ error: "只能改期已確認的預約" }, { status: 400 });
    }

    // Check reschedule policy — 4h before appointment (more lenient than cancel's 24h)
    const bookingDateStr = booking.date.toLocaleDateString("en-CA", { timeZone: "Asia/Taipei" });
    const [bY, bM, bD] = bookingDateStr.split("-").map(Number);
    const [bH] = booking.startTime.split(":").map(Number);
    const appointmentTime = new Date(Date.UTC(bY, bM - 1, bD, bH - 8, 0, 0));
    const now = new Date();
    const hoursUntil = (appointmentTime.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (hoursUntil < 4) {
      return Response.json(
        { error: "4 小時內的改期，請致電店家", phoneNumber: booking.tenant.phone },
        { status: 403 }
      );
    }

    // Calculate new end time
    const newEndTime = addHours(input.startTime, booking.service.slotsNeeded);
    const newDateObj = new Date(input.date + "T00:00:00+08:00");

    // Acquire lock on the new slot
    const lock = await acquireBookingLock({
      tenantId: booking.tenantId,
      date: input.date,
      startTime: input.startTime,
    });
    if (!lock) {
      return Response.json({ error: "該時段正在被其他人預約，請稍後再試" }, { status: 409 });
    }

    try {
      // Double-check new slot availability
      const available = await isSlotAvailable({
        tenantId: booking.tenantId,
        date: newDateObj,
        startTime: input.startTime,
        slotsNeeded: booking.service.slotsNeeded,
        excludeBookingId: id, // Exclude current booking from conflict check
      });

      if (!available) {
        throw new SlotUnavailableError();
      }

      // Update booking (preserves ID, payment, history)
      const oldDate = booking.date.toISOString().split("T")[0];
      const oldStartTime = booking.startTime;

      await prisma.booking.update({
        where: { id },
        data: {
          date: newDateObj,
          startTime: input.startTime,
          endTime: newEndTime,
        },
      });

      // Cancel old notifications and schedule new ones
      cancelBookingNotifications(id).catch((err) =>
        logger.error("Failed to cancel old notifications", err, "reschedule")
      );

      scheduleReminders({
        tenantId: booking.tenantId,
        bookingId: id,
        lineUserId: booking.user.lineUserId,
        bookingDate: newDateObj,
        startTime: input.startTime,
      }).catch((err) =>
        logger.error("Failed to schedule new reminders", err, "reschedule")
      );

      // Send LINE reschedule confirmation
      try {
        const lineClient = getLineClient();
        const liffBaseUrl = booking.tenant.liffId
          ? `https://liff.line.me/${booking.tenant.liffId}`
          : undefined;
        const msg = rescheduleConfirmationMessage({
          serviceName: booking.service.name,
          oldDate,
          oldStartTime,
          newDate: input.date,
          newStartTime: input.startTime,
          newEndTime,
          shopName: booking.tenant.businessName,
          liffBaseUrl,
          bookingId: id,
        });
        await lineClient.pushMessage(booking.user.lineUserId, msg);
      } catch (lineError) {
        logger.error("Failed to send reschedule LINE message", lineError, "reschedule");
      }

      // Notify admin
      notifyAdminNewBooking({
        tenantId: booking.tenantId,
        displayName: booking.user.displayName || "未知顧客",
        serviceName: booking.service.name,
        date: input.date,
        startTime: input.startTime,
        endTime: newEndTime,
        price: booking.service.price,
      }).catch((err) =>
        logger.error("Failed to notify admin (reschedule)", err, "reschedule")
      );

      return Response.json({
        booking: {
          id,
          date: input.date,
          startTime: input.startTime,
          endTime: newEndTime,
          oldDate,
          oldStartTime,
        },
      });
    } finally {
      await releaseBookingLock(lock);
    }
  } catch (error) {
    return errorResponse(error);
  }
}
