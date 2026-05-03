import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { errorResponse, AppError, UnauthorizedError } from "@/lib/utils/errors";
import { invalidateReportsCache } from "@/lib/cache/invalidate";
import { requireBookingAuth, requireAdmin, requireBookingOwnership } from "@/lib/auth/booking-auth";
import { getLineClient } from "@/lib/line/client";
import { paymentReceivedMessage } from "@/lib/line/messages";
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
        user: { select: { lineUserId: true, displayName: true, segment: true } },
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
    invalidateReportsCache();
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

    // Notify customer (best-effort) — 用 Flex Message receipt-style，跟
    // transferReportedMessage 視覺一致，形成完整體驗閉環。VIP 客戶有專屬感謝文案。
    const lineUserId = booking.user.lineUserId;
    if (lineUserId && !lineUserId.startsWith("manual-")) {
      try {
        const lineClient = getLineClient();
        const dateStr = booking.date.toLocaleDateString("en-CA", { timeZone: "Asia/Taipei" });
        const googleReviewUrl =
          process.env.GOOGLE_REVIEW_URL ||
          "https://maps.app.goo.gl/5XNK3uakFphFhSvd8";
        await lineClient.pushMessage(
          lineUserId,
          paymentReceivedMessage({
            serviceName: booking.service.name,
            date: dateStr,
            amount: payment.amount,
            displayName: booking.user.displayName ?? undefined,
            isVip: booking.user.segment === "VIP",
            googleReviewUrl,
          }),
        );
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
