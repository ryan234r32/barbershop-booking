import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isSlotAvailable } from "@/lib/booking/availability";
import {
  acquireBookingRowLock,
  acquireBookingSpanLock,
  releaseBookingLock,
  releaseBookingSpanLock,
} from "@/lib/booking/lock";
import { getIdempotentResult, storeIdempotentResult } from "@/lib/booking/idempotency";
import { cancelBookingNotifications, scheduleReminders } from "@/lib/notifications/scheduler";
import { getLineClient } from "@/lib/line/client";
import { rescheduleConfirmationMessage } from "@/lib/line/messages";
import { notifyAdminNewBooking } from "@/lib/notifications/admin-notify";
import { rescheduleBookingSchema } from "@/lib/utils/validation";
import { errorResponse, SlotUnavailableError, AppError } from "@/lib/utils/errors";
import { addHours, addDaysToISO, getDayOfWeek, todayInTaipei } from "@/lib/utils/time";
import { MAX_ADVANCE_DAYS } from "@/lib/utils/constants";
import { logger } from "@/lib/utils/logger";
import { requireBookingAuth, requireBookingOwnership } from "@/lib/auth/booking-auth";
import { invalidateReportsCache } from "@/lib/cache/invalidate";

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

    // Idempotency check happens AFTER the row lock so concurrent same-key
    // requests collapse to one (review finding P1). The first request executes,
    // stores the result, and releases the lock; the second acquires the lock,
    // finds the cached result, and returns it without re-executing.
    if (input.idempotencyKey) {
      const cached = await getIdempotentResult<unknown>(
        `reschedule:${id}`,
        input.idempotencyKey,
      );
      if (cached) {
        return Response.json(cached);
      }
    }

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

    // Reschedule policy (老闆訪談 §3 / Roadmap F04):
    // 改期完全開放 — 無時間限制，無違規（只有 No-show 算違規）。
    // 唯一限制：appointment 已結束就不能改期。
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

    // LIFF 客戶改期同樣受 45 天 + 公休日限制（admin 不受限）
    const newDateObj = new Date(input.date + "T00:00:00.000Z");
    if (auth.type === "liff") {
      const today = todayInTaipei();
      const maxDate = addDaysToISO(today, MAX_ADVANCE_DAYS);
      if (input.date > maxDate) {
        throw new AppError(
          `改期日期最多只能提前 ${MAX_ADVANCE_DAYS} 天`,
          400,
          "BEYOND_ADVANCE_WINDOW",
        );
      }
      const dayOfWeek = getDayOfWeek(newDateObj);
      const [bh, holiday] = await Promise.all([
        prisma.businessHours.findUnique({
          where: { tenantId_dayOfWeek: { tenantId: booking.tenantId, dayOfWeek } },
          select: { isOpen: true },
        }),
        prisma.holiday.findUnique({
          where: { tenantId_date: { tenantId: booking.tenantId, date: newDateObj } },
          select: { reason: true },
        }),
      ]);
      if (bh && !bh.isOpen) {
        throw new AppError("本日公休，請選其他日期", 400, "CLOSED_WEEKDAY");
      }
      if (holiday) {
        throw new AppError(
          holiday.reason ? `本日公休（${holiday.reason}）` : "本日公休，請選其他日期",
          400,
          "HOLIDAY",
        );
      }
    }

    // Calculate new end time
    const newEndTime = addHours(input.startTime, booking.service.slotsNeeded);

    // Acquire locks on EVERY hour the new booking will occupy (codex P0 fix).
    // Single-startTime locking would let two 2-slot bookings race into 12:00
    // and 13:00 — both pass isSlotAvailable, both commit, hour 13 is double-booked.
    const lock = await acquireBookingSpanLock({
      tenantId: booking.tenantId,
      date: input.date,
      startTime: input.startTime,
      slotsNeeded: booking.service.slotsNeeded,
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

      await prisma.booking.update({
        where: { id },
        data: {
          date: newDateObj,
          startTime: input.startTime,
          endTime: newEndTime,
          // Reset admin ack: the time/day moved, so the prior confirmation
          // doesn't carry over to the new slot. Admin re-acks via the push notif.
          adminAcknowledgedAt: null,
        },
      });

      // ─── Cache writes BEFORE notifications (codex P1 + P2 fix) ───
      // The 10s row-lock lease can expire if Vercel cold-starts the LINE
      // notification path. By writing idempotency + undo cache first, a retry
      // that arrives after lock expiry hits the idempotency cache instead of
      // re-executing (which would double-notify).

      // Store undo snapshot for the 30s undo toast (PRD-v3 E-5).
      const undoStored = await storeIdempotentResult(
        UNDO_SCOPE,
        id,
        {
          oldDate,
          oldStartTime,
          oldEndTime,
          newDate: input.date,
          newStartTime: input.startTime,
        },
        UNDO_TTL_SECONDS,
      );

      // undoAvailable reflects actual cache persistence (codex P2 fix #6) —
      // if Redis is down, don't tell the client "you can undo" when they can't.
      const result = {
        booking: {
          id,
          date: input.date,
          startTime: input.startTime,
          endTime: newEndTime,
          oldDate,
          oldStartTime,
        },
        undoAvailable: undoStored,
        undoExpiresInSeconds: undoStored ? UNDO_TTL_SECONDS : 0,
      };

      // Cache the idempotent result EARLY — before any awaited notification work.
      if (input.idempotencyKey) {
        await storeIdempotentResult(
          `reschedule:${id}`,
          input.idempotencyKey,
          result,
          UNDO_TTL_SECONDS,
        );
      }

      // ─── Notifications (after cache, so retry-safety is in place) ───
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
    invalidateReportsCache();

      return Response.json(result);
    } finally {
      await releaseBookingSpanLock(lock);
    }
    } finally {
      await releaseBookingLock(rowLock);
    }
  } catch (error) {
    return errorResponse(error);
  }
}
