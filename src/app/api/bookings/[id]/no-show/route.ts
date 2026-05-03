import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAdminFromCookie } from "@/lib/auth/jwt";
import { errorResponse, UnauthorizedError } from "@/lib/utils/errors";
import { MAX_VIOLATIONS } from "@/lib/utils/constants";
import { cancelBookingNotifications } from "@/lib/notifications/scheduler";
import { notifyAdminCancellation } from "@/lib/notifications/admin-notify";
import { logger } from "@/lib/utils/logger";
import { invalidateReportsCache } from "@/lib/cache/invalidate";

type RouteParams = { params: Promise<{ id: string }> };

const noShowSchema = z
  .object({
    /**
     * Optimistic-concurrency token. Same pattern as /acknowledge + /checkin.
     */
    expectedUpdatedAt: z.string().datetime().optional(),
  })
  .optional();

/**
 * PATCH /api/bookings/[id]/no-show — V3.5 admin marks booking as 爽約.
 *
 * One-way action (per plan §1.2 + dialog confirmation in client):
 *   - sets booking.status = NO_SHOW
 *   - resets booking.checkedInAt = NULL (in case it was incorrectly checked in)
 *   - increments user.violationCount; restricts user if MAX_VIOLATIONS reached
 *   - creates a CancellationRecord with isViolation = true
 *   - cancels pending reminder notifications
 *   - notifies admin (fire-and-forget)
 *
 * Allowed only when status = CONFIRMED. Already-no-show is a no-op (idempotent).
 *
 * Cross-tenant safe + stale-write guard same as /checkin.
 *
 * Admin-only.
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const admin = await getAdminFromCookie(request);
    if (!admin) throw new UnauthorizedError();

    const { id } = await params;
    const body = await request.json().catch(() => null);
    const parsed: z.infer<typeof noShowSchema> = body ? noShowSchema.parse(body) : undefined;
    const expectedUpdatedAt = parsed?.expectedUpdatedAt;

    const booking = await prisma.booking.findFirst({
      where: { id, tenantId: admin.tenantId },
      include: {
        user: { select: { id: true, displayName: true, violationCount: true } },
        service: { select: { name: true } },
      },
    });
    if (!booking) {
      return Response.json({ error: "Booking not found" }, { status: 404 });
    }

    // Idempotent — already no-show, return current state.
    if (booking.status === "NO_SHOW") {
      return Response.json({
        ok: true,
        booking: {
          id: booking.id,
          status: booking.status,
          updatedAt: booking.updatedAt,
        },
        wasNoOp: true,
      });
    }

    if (booking.status !== "CONFIRMED") {
      return Response.json(
        {
          error: "invalid_status",
          message: `只能對「已確認」的預約標記爽約（目前狀態：${booking.status}）`,
        },
        { status: 400 },
      );
    }

    // Stale-write check up front so we don't double-increment violationCount on
    // a retry against a stale row.
    if (
      expectedUpdatedAt &&
      new Date(expectedUpdatedAt).getTime() !== booking.updatedAt.getTime()
    ) {
      return Response.json(
        {
          error: "stale_write",
          message: "此預約已更新，請重新整理後再試",
          current: { status: booking.status, updatedAt: booking.updatedAt },
        },
        { status: 409 },
      );
    }

    const newViolationCount = booking.user.violationCount + 1;
    const shouldRestrict = newViolationCount >= MAX_VIOLATIONS;
    const restrictedUntil = shouldRestrict
      ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      : undefined;

    const result = await prisma.$transaction(async (tx) => {
      // Conditional update: same OCC fence as /acknowledge to prevent
      // races with /reschedule etc. If the row moved between findFirst and
      // here, updateMany returns count=0 and we throw to roll back the
      // transaction so violationCount/cancellation aren't applied.
      const updateResult = await tx.booking.updateMany({
        where: {
          id,
          tenantId: admin.tenantId,
          status: "CONFIRMED",
          updatedAt: booking.updatedAt,
        },
        data: {
          status: "NO_SHOW",
          checkedInAt: null,
        },
      });

      if (updateResult.count === 0) {
        throw new StaleWriteError();
      }

      await tx.user.update({
        where: { id: booking.userId },
        data: {
          violationCount: newViolationCount,
          bookingRestricted: shouldRestrict,
          ...(restrictedUntil ? { restrictedUntil } : {}),
        },
      });

      await tx.cancellationRecord.upsert({
        where: { bookingId: id },
        create: {
          bookingId: id,
          userId: booking.userId,
          isViolation: true,
          reason: "未到店 (No-show)",
          bookingDate: booking.date,
          bookingTime: booking.startTime,
        },
        update: {
          isViolation: true,
          reason: "未到店 (No-show)",
        },
      });

      const fresh = await tx.booking.findFirst({
        where: { id },
        select: { id: true, status: true, checkedInAt: true, updatedAt: true },
      });
      return fresh;
    });

    // Cancel pending reminder notifications — best-effort.
    cancelBookingNotifications(id).catch((err) =>
      logger.error("cancelBookingNotifications failed", err, "bookings", { bookingId: id }),
    );

    // Notify admin (fire-and-forget — same pattern as admin_cancel).
    try {
      await notifyAdminCancellation({
        tenantId: booking.tenantId,
        displayName: booking.user.displayName || "未知顧客",
        serviceName: booking.service.name,
        date: booking.date.toISOString().split("T")[0],
        startTime: booking.startTime,
        isViolation: true,
        cancelledBy: "admin",
      });
    } catch (err) {
      logger.error("notifyAdminCancellation (no-show) failed", err, "bookings", { bookingId: id });
    }
    invalidateReportsCache();

    return Response.json({
      ok: true,
      booking: result,
      violation: {
        violationCount: newViolationCount,
        restricted: shouldRestrict,
      },
      wasNoOp: false,
    });
  } catch (err) {
    if (err instanceof StaleWriteError) {
      const fresh = await prisma.booking.findFirst({
        where: { id: (await params).id },
        select: { status: true, updatedAt: true },
      });
      return Response.json(
        {
          error: "stale_write",
          message: "此預約已更新，請重新整理後再試",
          current: fresh,
        },
        { status: 409 },
      );
    }
    return errorResponse(err);
  }
}

class StaleWriteError extends Error {
  constructor() {
    super("stale_write");
    this.name = "StaleWriteError";
  }
}
