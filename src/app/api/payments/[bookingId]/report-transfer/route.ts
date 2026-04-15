import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { errorResponse, AppError, UnauthorizedError } from "@/lib/utils/errors";
import { reportTransferSchema } from "@/lib/utils/validation";
import { requireBookingAuth, requireBookingOwnership } from "@/lib/auth/booking-auth";
import { notifyAdminTransferReported } from "@/lib/notifications/admin-notify";
import { getLineClient } from "@/lib/line/client";
import { transferReportedMessage } from "@/lib/line/messages";
import { logger } from "@/lib/utils/logger";

type RouteParams = { params: Promise<{ bookingId: string }> };

/**
 * POST /api/payments/[bookingId]/report-transfer
 *
 * Customer reports the last-5-digit of their transfer-out bank account.
 * State transitions:
 *   - No Payment yet          → create Payment(method=BANK_TRANSFER, status=VERIFYING)
 *   - Payment PENDING         → update to VERIFYING, set method=BANK_TRANSFER
 *   - Payment VERIFYING       → 409 (locked; last5 cannot be changed once submitted)
 *   - Payment RECEIVED/WAIVED → 409 (terminal)
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { bookingId } = await params;
    const auth = await requireBookingAuth(request);

    const body = await request.json();
    const { transferLastFive } = reportTransferSchema.parse(body);

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        service: { select: { name: true, price: true } },
        user: { select: { lineUserId: true, displayName: true } },
        payment: true,
        tenant: { select: { liffId: true } },
      },
    });

    if (!booking) {
      throw new AppError("找不到此預約", 404, "BOOKING_NOT_FOUND");
    }
    requireBookingOwnership(auth, booking);

    if (booking.status !== "CONFIRMED") {
      throw new AppError("此預約無法回報付款", 422, "BOOKING_NOT_CONFIRMED");
    }

    const existing = booking.payment;
    if (existing && (existing.status === "VERIFYING" || existing.status === "RECEIVED" || existing.status === "WAIVED")) {
      throw new AppError(
        existing.status === "VERIFYING"
          ? "已回報過末五碼，如需修改請聯絡店家"
          : "此預約付款已完成",
        409,
        "PAYMENT_LOCKED",
      );
    }

    const payment = existing
      ? await prisma.payment.update({
          where: { bookingId },
          data: {
            method: "BANK_TRANSFER",
            status: "VERIFYING",
            transferLastFive,
            verifiedAt: new Date(),
          },
        })
      : await prisma.payment.create({
          data: {
            bookingId,
            amount: booking.service.price,
            method: "BANK_TRANSFER",
            status: "VERIFYING",
            transferLastFive,
            verifiedAt: new Date(),
          },
        });

    // Fire-and-forget admin notification
    void notifyAdminTransferReported({
      tenantId: booking.tenantId,
      bookingId,
      displayName: booking.user.displayName ?? "客戶",
      serviceName: booking.service.name,
      date: booking.date.toISOString().slice(0, 10),
      startTime: booking.startTime,
      amount: payment.amount,
      transferLastFive,
    }).catch((err) => {
      logger.error("notifyAdminTransferReported failed", err, "payments");
    });

    // Push Flex to customer (awaited; fire-and-forget gets killed on Vercel).
    if (booking.user.lineUserId && !booking.user.lineUserId.startsWith("manual-")) {
      try {
        const liffBaseUrl = booking.tenant.liffId
          ? `https://liff.line.me/${booking.tenant.liffId}`
          : undefined;
        await getLineClient().pushMessage(
          booking.user.lineUserId,
          transferReportedMessage({
            serviceName: booking.service.name,
            date: booking.date.toISOString().slice(0, 10),
            startTime: booking.startTime,
            endTime: booking.endTime,
            price: payment.amount,
            transferLastFive,
            liffBaseUrl,
          }),
        );
      } catch (lineErr) {
        logger.error("Failed to push transferReported Flex", lineErr, "payments");
      }
    }

    return Response.json({
      success: true,
      payment: {
        status: payment.status,
        transferLastFive: payment.transferLastFive,
        verifiedAt: payment.verifiedAt,
      },
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return Response.json({ error: error.message }, { status: 401 });
    }
    return errorResponse(error);
  }
}
