/**
 * V3.6 §5.2 — daily 對帳 endpoint.
 *
 * PATCH /api/bookings/[id]/settle  → set settledAt = now()
 *   - If booking.status === CONFIRMED, also auto-transition to COMPLETED
 *     (with checkedInAt = now if null) since "確認" in the daily reconciliation
 *     view implies "this happened + payment received".
 *   - If booking.status === COMPLETED, just set settledAt.
 *   - If booking.status === NO_SHOW / CANCELLED, reject.
 *
 * DELETE /api/bookings/[id]/settle → clear settledAt (revert to unsettled).
 *
 * Idempotent: re-settling a settled booking returns the same timestamp.
 * Cross-tenant safe via adminUser.tenantId.
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminFromCookie } from "@/lib/auth/jwt";
import { errorResponse, UnauthorizedError, AppError } from "@/lib/utils/errors";

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const admin = await getAdminFromCookie(request);
    if (!admin) throw new UnauthorizedError();

    const { id } = await params;

    const booking = await prisma.booking.findFirst({
      where: { id, tenantId: admin.tenantId },
      select: { id: true, status: true, settledAt: true, checkedInAt: true },
    });
    if (!booking) {
      return Response.json({ error: "Booking not found" }, { status: 404 });
    }

    if (booking.settledAt) {
      return Response.json({
        ok: true,
        settledAt: booking.settledAt,
        wasAlreadySettled: true,
      });
    }

    if (booking.status === "NO_SHOW") {
      throw new AppError("無法對帳：此預約為 No-show，請另行處理", 400, "no_show_settle");
    }
    if (booking.status === "CANCELLED" || booking.status === "CANCELLED_BY_ADMIN") {
      throw new AppError("無法對帳：此預約已取消", 400, "cancelled_settle");
    }

    const settleTime = new Date();
    const data: {
      settledAt: Date;
      status?: "COMPLETED";
      checkedInAt?: Date;
    } = { settledAt: settleTime };
    if (booking.status === "CONFIRMED") {
      data.status = "COMPLETED";
      if (booking.checkedInAt == null) data.checkedInAt = settleTime;
    }

    await prisma.booking.update({ where: { id }, data });

    return Response.json({
      ok: true,
      settledAt: settleTime,
      autoCompleted: booking.status === "CONFIRMED",
      wasAlreadySettled: false,
    });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const admin = await getAdminFromCookie(request);
    if (!admin) throw new UnauthorizedError();

    const { id } = await params;
    const result = await prisma.booking.updateMany({
      where: { id, tenantId: admin.tenantId, settledAt: { not: null } },
      data: { settledAt: null },
    });
    if (result.count === 0) {
      return Response.json({ error: "Booking not found or not settled" }, { status: 404 });
    }
    return Response.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
