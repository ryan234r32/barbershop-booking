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
import { requireBookingAuth, requireBookingOwnership } from "@/lib/auth/booking-auth";

type RouteParams = { params: Promise<{ id: string }> };

/** POST /api/bookings/[id]/reschedule — reschedule an existing booking */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireBookingAuth(request);

    const { id } = await params;
    const body = await request.json();
    const input = rescheduleBookingSchema.parse(body);

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: {
        user: true,
        service: true,
        // Use select white-list to avoid leaking lineAccessToken / lineChannelSecret.
        tenant: {
          select: {
            id: true,
            businessName: true,
            phone: true,
            address: true,
            liffId: true,
          },
        },
      },
    });

    if (!booking) {
      return Response.json({ error: "Booking not found" }, { status: 404 });
    }

    // Caller must own this booking (LIFF) or be admin of this tenant.
    requireBookingOwnership(auth, booking);

    if (booking.status !== "CONFIRMED") {
      return Response.json({ error: "只能改期已確認的預約" }, { status: 400 });
    }

    // Reschedule policy (industry-aligned, 2026-04):
    //   ≥ 4h       → free online
    //   2h–4h      → allowed, but only once per booking (lateRescheduleCount guards re-abuse)
    //   < 2h       → allowed once, counts as a violation (same tier as no-show)
    //   2nd attempt inside 4h → blocked, must call
    const bookingDateStr = booking.date.toLocaleDateString("en-CA", { timeZone: "Asia/Taipei" });
    const [bY, bM, bD] = bookingDateStr.split("-").map(Number);
    const [bH] = booking.startTime.split(":").map(Number);
    const appointmentTime = new Date(Date.UTC(bY, bM - 1, bD, bH - 8, 0, 0));
    const now = new Date();
    const hoursUntil = (appointmentTime.getTime() - now.getTime()) / (1000 * 60 * 60);

    const isLateReschedule = hoursUntil < 4;
    const isVeryLateReschedule = hoursUntil < 2;

    if (isLateReschedule && booking.lateRescheduleCount >= 1) {
      return Response.json(
        {
          error: "這筆預約已經短時間改過一次，請致電店家協助",
          phoneNumber: booking.tenant.phone,
        },
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
          ...(isLateReschedule ? { lateRescheduleCount: { increment: 1 } } : {}),
        },
      });

      if (isVeryLateReschedule) {
        await prisma.user.update({
          where: { id: booking.userId },
          data: { violationCount: { increment: 1 } },
        });
      }

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
