/**
 * V3.6 §5.2 + V3.7 §C/D/F/G — daily 對帳 endpoint.
 *
 * PATCH /api/bookings/[id]/settle  → set settledAt = now()
 *   - If booking.status === CONFIRMED, also auto-transition to COMPLETED
 *     (with checkedInAt = now if null) since "確認" in the daily reconciliation
 *     view implies "this happened + payment received".
 *   - If booking.status === COMPLETED, just set settledAt.
 *   - If booking.status === NO_SHOW / CANCELLED, reject.
 *   - V3.7 §C: also flip Payment.status → RECEIVED + receivedAt = now
 *     (mirrors mark-received endpoint logic; idempotent re-settle short-circuits).
 *   - V3.7 §F: fire-and-forget paymentReceivedMessage to customer LINE
 *     (only when lineUserId starts with "U" — manual-/legacy- skipped).
 *
 * DELETE /api/bookings/[id]/settle → clear settledAt (revert to unsettled).
 *   - V3.7 §G: fire-and-forget paymentSettleRevokedMessage so customer
 *     who already received the receipt gets a correction.
 *   - Does NOT roll back Payment.status (audit trail preserved); admin can
 *     re-settle which will re-push the receipt.
 *
 * Idempotent: re-settling a settled booking returns the same timestamp
 * without re-pushing the LINE message.
 *
 * Cross-tenant safe via adminUser.tenantId.
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminFromCookie } from "@/lib/auth/jwt";
import { errorResponse, UnauthorizedError, AppError } from "@/lib/utils/errors";
import { getLineClient } from "@/lib/line/client";
import { paymentReceivedMessage, paymentSettleRevokedMessage } from "@/lib/line/messages";
import { logger } from "@/lib/utils/logger";
import { invalidateReportsCache } from "@/lib/cache/invalidate";

type RouteParams = { params: Promise<{ id: string }> };

/** V3.7 §3 (老闆 confirm): real LINE user IDs start with "U". manual-/legacy-/
 * imported-/anything-else gets no push to avoid silent rate-limit errors. */
function isPushableLineUserId(lineUserId: string | null | undefined): boolean {
  return typeof lineUserId === "string" && lineUserId.startsWith("U");
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const admin = await getAdminFromCookie(request);
    if (!admin) throw new UnauthorizedError();

    const { id } = await params;

    const booking = await prisma.booking.findFirst({
      where: { id, tenantId: admin.tenantId },
      select: {
        id: true,
        status: true,
        settledAt: true,
        checkedInAt: true,
        date: true,
        service: { select: { name: true, price: true } },
        user: { select: { lineUserId: true, displayName: true, segment: true } },
        payment: { select: { id: true, amount: true, status: true } },
      },
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

    // V3.7 §C — atomic Booking + Payment write. We don't care about
    // Payment.transferLastFive here (the customer already filled it earlier);
    // we just set status RECEIVED + receivedAt. If Payment row is missing
    // (cash walk-in not gone through LIFF), create it on the fly.
    const paymentAmount = booking.payment?.amount ?? booking.service.price;
    await prisma.$transaction(async (tx) => {
      await tx.booking.update({ where: { id }, data });
      if (booking.payment) {
        if (booking.payment.status !== "RECEIVED" && booking.payment.status !== "WAIVED") {
          await tx.payment.update({
            where: { id: booking.payment.id },
            data: { status: "RECEIVED", receivedAt: settleTime },
          });
        }
      } else {
        await tx.payment.create({
          data: {
            bookingId: id,
            amount: paymentAmount,
            method: "CASH",
            status: "RECEIVED",
            receivedAt: settleTime,
          },
        });
      }
    });

    // V3.7 §F — fire-and-forget LINE push. Failure must not break settle.
    if (isPushableLineUserId(booking.user?.lineUserId)) {
      try {
        const lineClient = getLineClient();
        const dateStr = booking.date.toLocaleDateString("en-CA", { timeZone: "Asia/Taipei" });
        const googleReviewUrl =
          process.env.GOOGLE_REVIEW_URL ||
          "https://maps.app.goo.gl/5XNK3uakFphFhSvd8";
        await lineClient.pushMessage(
          booking.user!.lineUserId,
          paymentReceivedMessage({
            serviceName: booking.service.name,
            date: dateStr,
            amount: paymentAmount,
            displayName: booking.user!.displayName ?? undefined,
            isVip: booking.user!.segment === "VIP",
            googleReviewUrl,
          }),
        );
      } catch (err) {
        logger.error("settle: failed to push paymentReceivedMessage", err, "bookings");
      }
    }
    invalidateReportsCache();

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

    // Fetch first so we can push the apology message AFTER the unset succeeds.
    const booking = await prisma.booking.findFirst({
      where: { id, tenantId: admin.tenantId },
      select: {
        id: true,
        settledAt: true,
        date: true,
        service: { select: { name: true, price: true } },
        user: { select: { lineUserId: true } },
        payment: { select: { amount: true } },
      },
    });
    if (!booking || booking.settledAt == null) {
      return Response.json({ error: "Booking not found or not settled" }, { status: 404 });
    }

    const result = await prisma.booking.updateMany({
      where: { id, tenantId: admin.tenantId, settledAt: { not: null } },
      data: { settledAt: null },
    });
    if (result.count === 0) {
      return Response.json({ error: "Booking not found or not settled" }, { status: 404 });
    }

    // V3.7 §G — apology push. Same gate as PATCH (real LINE U-ids only).
    if (isPushableLineUserId(booking.user?.lineUserId)) {
      try {
        const lineClient = getLineClient();
        const dateStr = booking.date.toLocaleDateString("en-CA", { timeZone: "Asia/Taipei" });
        const amount = booking.payment?.amount ?? booking.service.price;
        await lineClient.pushMessage(
          booking.user!.lineUserId,
          paymentSettleRevokedMessage({
            serviceName: booking.service.name,
            date: dateStr,
            amount,
          }),
        );
      } catch (err) {
        logger.error("unsettle: failed to push paymentSettleRevokedMessage", err, "bookings");
      }
    }
    invalidateReportsCache();

    return Response.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
