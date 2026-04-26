/**
 * POST /api/bookings/[id]/reschedule-undo (PRD-v3 §4 / E-5)
 *
 * Reverts the most recent reschedule of a booking. Only valid within
 * the UNDO_TTL_SECONDS window after a successful reschedule — the
 * snapshot lives in Redis (idempotency cache) and expires automatically.
 *
 * Auth: same as reschedule (admin or LIFF owner of the booking).
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  acquireBookingRowLock,
  acquireBookingSpanLock,
  releaseBookingLock,
  releaseBookingSpanLock,
} from "@/lib/booking/lock";
import { isSlotAvailable } from "@/lib/booking/availability";
import { getIdempotentResult } from "@/lib/booking/idempotency";
import { errorResponse, SlotUnavailableError } from "@/lib/utils/errors";
import { logger } from "@/lib/utils/logger";
import {
  requireBookingAuth,
  requireBookingOwnership,
} from "@/lib/auth/booking-auth";
import { getLineClient } from "@/lib/line/client";
import { rescheduleConfirmationMessage } from "@/lib/line/messages";
import { cancelBookingNotifications, scheduleReminders } from "@/lib/notifications/scheduler";

const UNDO_SCOPE = "reschedule-undo";

interface UndoSnapshot {
  oldDate: string;
  oldStartTime: string;
  oldEndTime: string;
  newDate: string;
  newStartTime: string;
  /** True if the original reschedule was within 2h of appointment and bumped
   *  the user's violationCount. Undo must reverse it (codex P2 fix). */
  wasLateReschedule?: boolean;
}

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireBookingAuth(request);
    const { id } = await params;

    const snapshot = await getIdempotentResult<UndoSnapshot>(UNDO_SCOPE, id);
    if (!snapshot) {
      return Response.json(
        { error: "改期撤銷已過期，無法恢復" },
        { status: 410 },
      );
    }

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
      requireBookingOwnership(auth, booking);

      // Sanity: only undo if the booking is still where the snapshot says it
      // moved to. Otherwise something else has changed it and we shouldn't blindly
      // overwrite.
      const currentDateStr = booking.date
        .toLocaleDateString("en-CA", { timeZone: "Asia/Taipei" });
      if (
        currentDateStr !== snapshot.newDate ||
        booking.startTime !== snapshot.newStartTime
      ) {
        return Response.json(
          { error: "預約已被其他人變更，撤銷已失效" },
          { status: 409 },
        );
      }

      const oldDateObj = new Date(snapshot.oldDate + "T00:00:00.000Z");

      // Lock all hours the booking spanned at the original slot (codex P0 fix).
      const slotLock = await acquireBookingSpanLock({
        tenantId: booking.tenantId,
        date: snapshot.oldDate,
        startTime: snapshot.oldStartTime,
        slotsNeeded: booking.service.slotsNeeded,
      });
      if (!slotLock) {
        return Response.json(
          { error: "原時段被其他預約佔用，無法撤銷改期" },
          { status: 409 },
        );
      }

      try {
        const available = await isSlotAvailable({
          tenantId: booking.tenantId,
          date: oldDateObj,
          startTime: snapshot.oldStartTime,
          slotsNeeded: booking.service.slotsNeeded,
          excludeBookingId: id,
        });
        if (!available) throw new SlotUnavailableError();

        // Atomic restore + (optional) violation rollback (codex P2 fix).
        // If the original reschedule was within 2h, it bumped violationCount.
        // Undo must decrement it; otherwise an accidental drag would burn a
        // strike permanently even after being undone.
        await prisma.$transaction([
          prisma.booking.update({
            where: { id },
            data: {
              date: oldDateObj,
              startTime: snapshot.oldStartTime,
              endTime: snapshot.oldEndTime,
              adminAcknowledgedAt: null,
            },
          }),
          ...(snapshot.wasLateReschedule
            ? [
                prisma.user.update({
                  where: { id: booking.userId },
                  data: { violationCount: { decrement: 1 } },
                }),
              ]
            : []),
        ]);

        // Re-schedule reminders for the original slot
        cancelBookingNotifications(id).catch((err) =>
          logger.error("Failed to cancel notifications (undo)", err, "reschedule-undo"),
        );
        scheduleReminders({
          tenantId: booking.tenantId,
          bookingId: id,
          lineUserId: booking.user.lineUserId,
          bookingDate: oldDateObj,
          startTime: snapshot.oldStartTime,
        }).catch((err) =>
          logger.error("Failed to re-schedule reminders (undo)", err, "reschedule-undo"),
        );

        // Tell the customer their slot is back
        try {
          const lineClient = getLineClient();
          const liffBaseUrl = booking.tenant.liffId
            ? `https://liff.line.me/${booking.tenant.liffId}`
            : undefined;
          const msg = rescheduleConfirmationMessage({
            serviceName: booking.service.name,
            oldDate: snapshot.newDate,
            oldStartTime: snapshot.newStartTime,
            newDate: snapshot.oldDate,
            newStartTime: snapshot.oldStartTime,
            newEndTime: snapshot.oldEndTime,
            shopName: booking.tenant.businessName,
            liffBaseUrl,
            bookingId: id,
          });
          await lineClient.pushMessage(booking.user.lineUserId, msg);
        } catch (lineError) {
          logger.error(
            "Failed to send LINE undo confirmation",
            lineError,
            "reschedule-undo",
          );
        }

        return Response.json({
          booking: {
            id,
            date: snapshot.oldDate,
            startTime: snapshot.oldStartTime,
            endTime: snapshot.oldEndTime,
          },
          undone: true,
        });
      } finally {
        await releaseBookingSpanLock(slotLock);
      }
    } finally {
      await releaseBookingLock(rowLock);
    }
  } catch (error) {
    return errorResponse(error);
  }
}
