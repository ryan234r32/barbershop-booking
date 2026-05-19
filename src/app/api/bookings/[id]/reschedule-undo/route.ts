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
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  acquireBookingRowLock,
  acquireBookingSpanLock,
  releaseBookingLock,
  releaseBookingSpanLock,
} from "@/lib/booking/lock";
import { isSlotAvailable } from "@/lib/booking/availability";
import { getIdempotentResult } from "@/lib/booking/idempotency";
import { errorResponse, SlotUnavailableError, AppError, StaleWriteError } from "@/lib/utils/errors";
import { logger } from "@/lib/utils/logger";
import {
  requireBookingAuth,
  requireBookingOwnership,
} from "@/lib/auth/booking-auth";
import { getLineClient } from "@/lib/line/client";
import { rescheduleConfirmationMessage } from "@/lib/line/messages";
import { cancelBookingNotifications, scheduleReminders } from "@/lib/notifications/scheduler";
import { invalidateReportsCache } from "@/lib/cache/invalidate";
import {
  parseTimeToHour,
  todayInTaipei,
  getDayOfWeek,
} from "@/lib/utils/time";
import { DEFAULT_BUSINESS_HOURS } from "@/lib/utils/constants";

const UNDO_SCOPE = "reschedule-undo";

/** Optional OCC token — same shape as reschedule + checkout + checkin.
 *  Body itself is optional (legacy clients send no body); when present and
 *  expectedUpdatedAt is provided, the OCC fence runs in the updateMany guard. */
const undoBodySchema = z
  .object({
    expectedUpdatedAt: z.string().datetime().optional(),
  })
  .optional();

interface UndoSnapshot {
  oldDate: string;
  oldStartTime: string;
  oldEndTime: string;
  newDate: string;
  newStartTime: string;
  /** Legacy field — pre-2026-05-03 reschedules within 2h bumped violationCount;
   *  undo must still decrement it for snapshots written before the policy change. */
  wasLateReschedule?: boolean;
}

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireBookingAuth(request);
    const { id } = await params;

    // Body is optional (legacy clients send no body). Parse defensively so
    // a `{}` or empty body still works.
    const body = await request.json().catch(() => null);
    const parsed = body ? undoBodySchema.parse(body) : undefined;
    const expectedUpdatedAt = parsed?.expectedUpdatedAt;

    const snapshot = await getIdempotentResult<UndoSnapshot>(UNDO_SCOPE, id);
    if (!snapshot) {
      return Response.json(
        { error: "改期撤銷已過期，無法恢復" },
        { status: 410 },
      );
    }

    // V3.7 audit (5/19): time/date validation parity with POST /api/bookings.
    // Undo restores the booking to snapshot.oldDate / snapshot.oldStartTime,
    // so the same three rules apply: past-date, business-hours overtime,
    // holiday / closed-weekday. Without these, a snapshot that aged past
    // midnight could put a booking onto yesterday's calendar.
    const today = todayInTaipei();
    if (snapshot.oldDate < today) {
      throw new AppError(
        "原時段已是過去日期，無法撤銷改期",
        400,
        "PAST_DATE",
      );
    }

    const oldStartHour = parseTimeToHour(snapshot.oldStartTime);
    const openHour = parseTimeToHour(DEFAULT_BUSINESS_HOURS.startTime);
    const closeHour = parseTimeToHour(DEFAULT_BUSINESS_HOURS.endTime);
    // We don't have slotsOccupied yet (no booking lookup yet) — derive from
    // snapshot.oldEndTime so the guard fires before any DB I/O. Falls back to
    // a slot-aware check after booking fetch via isSlotAvailable.
    const oldEndHour = parseTimeToHour(snapshot.oldEndTime);
    const slotsOccupied = Math.max(1, oldEndHour - oldStartHour);
    if (oldStartHour < openHour || oldStartHour + slotsOccupied > closeHour) {
      throw new AppError(
        `原時段超出營業時間（${DEFAULT_BUSINESS_HOURS.startTime}–${DEFAULT_BUSINESS_HOURS.endTime}），無法撤銷改期`,
        400,
        "OUTSIDE_BUSINESS_HOURS",
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

      // V3.7 audit (5/19): holiday + closed-weekday guard on the snapshot
      // destination. Matches POST /api/bookings logic. If the owner marked
      // the old date a holiday between reschedule + undo, we must NOT silently
      // put the booking back onto a closed day.
      const dayOfWeek = getDayOfWeek(oldDateObj);
      const [bh, holiday] = await Promise.all([
        prisma.businessHours.findUnique({
          where: { tenantId_dayOfWeek: { tenantId: booking.tenantId, dayOfWeek } },
          select: { isOpen: true },
        }),
        prisma.holiday.findUnique({
          where: { tenantId_date: { tenantId: booking.tenantId, date: oldDateObj } },
          select: { reason: true, startTime: true, endTime: true },
        }),
      ]);
      if (bh && !bh.isOpen) {
        throw new AppError("原時段日期已設為公休，無法撤銷改期", 400, "CLOSED_WEEKDAY");
      }
      // Full-day holiday (both NULL = full closure) blocks undo entirely.
      // Partial-day closure is caught by isSlotAvailable downstream.
      if (holiday && !holiday.startTime && !holiday.endTime) {
        throw new AppError(
          holiday.reason
            ? `原時段日期已設為公休（${holiday.reason}），無法撤銷改期`
            : "原時段日期已設為公休，無法撤銷改期",
          400,
          "HOLIDAY",
        );
      }

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
        //
        // V3.7 audit (5/19): OCC fence on the restore write. We already check
        // currentDateStr / startTime above as a poor man's OCC, but `updatedAt`
        // is the canonical token — explicit expectedUpdatedAt from the client
        // OR fall back to the booking we just read inside the row-lock.
        await prisma.$transaction(async (tx) => {
          const updateResult = await tx.booking.updateMany({
            where: {
              id,
              tenantId: booking.tenantId,
              ...(expectedUpdatedAt
                ? { updatedAt: new Date(expectedUpdatedAt) }
                : { updatedAt: booking.updatedAt }),
            },
            data: {
              date: oldDateObj,
              startTime: snapshot.oldStartTime,
              endTime: snapshot.oldEndTime,
              adminAcknowledgedAt: null,
            },
          });
          if (updateResult.count === 0) {
            const fresh = await tx.booking.findFirst({
              where: { id, tenantId: booking.tenantId },
              select: { status: true, date: true, startTime: true, updatedAt: true },
            });
            throw new StaleWriteError(fresh);
          }
          if (snapshot.wasLateReschedule) {
            await tx.user.update({
              where: { id: booking.userId },
              data: { violationCount: { decrement: 1 } },
            });
          }
        });

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
    invalidateReportsCache();

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
