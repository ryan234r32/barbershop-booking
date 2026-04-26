import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isSlotAvailable } from "@/lib/booking/availability";
import {
  acquireBookingLock,
  acquireBookingRowLock,
  releaseBookingLock,
} from "@/lib/booking/lock";
import { getIdempotentResult, storeIdempotentResult } from "@/lib/booking/idempotency";
import { cancelBookingNotifications, scheduleReminders } from "@/lib/notifications/scheduler";
import { getLineClient } from "@/lib/line/client";
import { rescheduleConfirmationMessage } from "@/lib/line/messages";
import { notifyAdminNewBooking } from "@/lib/notifications/admin-notify";
import { rescheduleBookingSchema } from "@/lib/utils/validation";
import { errorResponse, SlotUnavailableError } from "@/lib/utils/errors";
import { addHours } from "@/lib/utils/time";
import { logger } from "@/lib/utils/logger";
import { requireBookingAuth, requireBookingOwnership } from "@/lib/auth/booking-auth";

const rescheduleWithIdempotencySchema = rescheduleBookingSchema.extend({
  /** Optional idempotency key — used by drag-reschedule on the calendar to
   *  guard against accidental double-submit (PRD-v3 E-5). */
  idempotencyKey: z.string().min(1).max(128).optional(),
});

const UNDO_SCOPE = "reschedule-undo";
const UNDO_TTL_SECONDS = 30; // PRD-v3 E-5 — undo toast dismisses at 5s, allow margin

type RouteParams = { params: Promise<{ id: string }> };

/** POST /api/bookings/[id]/reschedule — reschedule an existing booking */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireBookingAuth(request);

    const { id } = await params;
    const body = await request.json();
    const input = rescheduleWithIdempotencySchema.parse(body);

    // Idempotency short-circuit: re-submit with same key returns cached response.
    if (input.idempotencyKey) {
      const cached = await getIdempotentResult<unknown>(
        `reschedule:${id}`,
        input.idempotencyKey,
      );
      if (cached) {
        return Response.json(cached);
      }
    }

    // Acquire the booking-row lock BEFORE any other work, so a concurrent
    // reschedule of the same booking serialises here (PRD-v3 E-6).
    const rowLock = await acquireBookingRowLock(id);
    if (!rowLock) {
      return Response.json(
        { error: "此預約正在被另一個操作改期，請稍後再試" },
        { status: 409 },
      );
    }
    try {

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

    // Reschedule policy: line reschedule allowed any time before appointment;
    // < 2h adds a violation to the user's record (same tier as no-show).
    const bookingDateStr = booking.date.toLocaleDateString("en-CA", { timeZone: "Asia/Taipei" });
    const [bY, bM, bD] = bookingDateStr.split("-").map(Number);
    const [bH] = booking.startTime.split(":").map(Number);
    const appointmentTime = new Date(Date.UTC(bY, bM - 1, bD, bH - 8, 0, 0));
    const now = new Date();
    const hoursUntil = (appointmentTime.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (hoursUntil <= 0) {
      return Response.json(
        { error: "預約已結束，無法改期" },
        { status: 400 }
      );
    }

    const isVeryLateReschedule = hoursUntil < 2;

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
      const oldEndTime = booking.endTime;

      // Atomic update + (optional) violation increment (PRD-v3 E-3).
      // Without a transaction, a partial failure would leave the booking
      // moved but the violation un-recorded.
      await prisma.$transaction([
        prisma.booking.update({
          where: { id },
          data: {
            date: newDateObj,
            startTime: input.startTime,
            endTime: newEndTime,
            // Reset admin ack: the time/day moved, so the prior confirmation
            // doesn't carry over to the new slot. Admin re-acks via the push notif.
            adminAcknowledgedAt: null,
          },
        }),
        ...(isVeryLateReschedule
          ? [
              prisma.user.update({
                where: { id: booking.userId },
                data: { violationCount: { increment: 1 } },
              }),
            ]
          : []),
      ]);

      // Store undo snapshot — short TTL covers the toast window. PRD-v3 E-5.
      await storeIdempotentResult(
        UNDO_SCOPE,
        id,
        { oldDate, oldStartTime, oldEndTime, newDate: input.date, newStartTime: input.startTime },
        UNDO_TTL_SECONDS,
      );

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

      // Notify admin (also re-acks via the new bookingId on the new date/time).
      // Await on Vercel — fire-and-forget promises get killed at response time.
      try {
        await notifyAdminNewBooking({
          tenantId: booking.tenantId,
          bookingId: id,
          displayName: booking.user.displayName || "未知顧客",
          serviceName: booking.service.name,
          date: input.date,
          startTime: input.startTime,
          endTime: newEndTime,
          price: booking.service.price,
        });
      } catch (err) {
        logger.error("Failed to notify admin (reschedule)", err, "reschedule");
      }

      const result = {
        booking: {
          id,
          date: input.date,
          startTime: input.startTime,
          endTime: newEndTime,
          oldDate,
          oldStartTime,
        },
        undoAvailable: true,
        undoExpiresInSeconds: UNDO_TTL_SECONDS,
      };

      // Cache the result for idempotency (PRD-v3 E-5).
      if (input.idempotencyKey) {
        await storeIdempotentResult(
          `reschedule:${id}`,
          input.idempotencyKey,
          result,
          UNDO_TTL_SECONDS,
        );
      }

      return Response.json(result);
    } finally {
      await releaseBookingLock(lock);
    }
    } finally {
      await releaseBookingLock(rowLock);
    }
  } catch (error) {
    return errorResponse(error);
  }
}
