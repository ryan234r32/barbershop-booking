import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { errorResponse, AppError, UnauthorizedError } from "@/lib/utils/errors";
import { requireBookingAuth, requireAdmin, requireBookingOwnership } from "@/lib/auth/booking-auth";
import { getLineClient } from "@/lib/line/client";
import { logger } from "@/lib/utils/logger";

type RouteParams = { params: Promise<{ bookingId: string }> };

/**
 * PATCH /api/payments/[bookingId]/mark-received — admin confirms payment received.
 *
 * Idempotent: calling on an already-RECEIVED payment returns 200 with no side effects.
 * Accepts bookings in PENDING (cash walk-in) or VERIFYING (transfer reported) state.
 * If Payment row does not exist yet (cash booking never went through LIFF), create it.
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { bookingId } = await params;
    const auth = await requireBookingAuth(request);
    requireAdmin(auth);

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        service: { select: { name: true, price: true } },
        user: { select: { lineUserId: true, displayName: true } },
        payment: true,
      },
    });

    if (!booking) {
      throw new AppError("找不到此預約", 404, "BOOKING_NOT_FOUND");
    }
    requireBookingOwnership(auth, booking);

    const existing = booking.payment;

    // Idempotency: already RECEIVED → 200 no-op
    if (existing?.status === "RECEIVED") {
      return Response.json({
        success: true,
        idempotent: true,
        payment: {
          status: existing.status,
          receivedAt: existing.receivedAt,
        },
      });
    }

    if (existing?.status === "WAIVED") {
      throw new AppError("此付款已免收，無法再標記已收款", 409, "PAYMENT_WAIVED");
    }

    const now = new Date();
    const payment = existing
      ? await prisma.payment.update({
          where: { bookingId },
          data: { status: "RECEIVED", receivedAt: now },
        })
      : await prisma.payment.create({
          data: {
            bookingId,
            amount: booking.service.price,
            method: "CASH",
            status: "RECEIVED",
            receivedAt: now,
          },
        });

    // Notify customer (best-effort)
    const lineUserId = booking.user.lineUserId;
    if (lineUserId && !lineUserId.startsWith("manual-")) {
      try {
        const lineClient = getLineClient();
        await lineClient.pushMessage(lineUserId, {
          type: "text",
          text: `✓ 已確認收款\n${booking.service.name}\n金額：NT$${payment.amount.toLocaleString()}\n期待您的光臨！`,
        });
      } catch (err) {
        logger.error("Failed to push payment-received to customer", err, "payments");
      }
    }

    return Response.json({
      success: true,
      payment: {
        status: payment.status,
        receivedAt: payment.receivedAt,
        method: payment.method,
      },
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return Response.json({ error: error.message }, { status: 401 });
    }
    return errorResponse(error);
  }
}
