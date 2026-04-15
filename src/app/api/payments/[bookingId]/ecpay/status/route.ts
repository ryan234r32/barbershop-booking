import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { errorResponse, AppError, UnauthorizedError } from "@/lib/utils/errors";
import { requireBookingAuth } from "@/lib/auth/booking-auth";

/**
 * GET /api/payments/[bookingId]/ecpay/status
 *
 * Client-side polling endpoint. Returns the latest ECPayOrder for the booking,
 * scrubbed of anything the client shouldn't see:
 *   - no merchantTradeNo (opaque reference; customer doesn't need it)
 *   - no rawCreateResponse / rawPaymentInfo / rawReturn (admin-only)
 *
 * Tenant-isolated via the same path as the booking lookup.
 */

export const runtime = "nodejs";

type RouteParams = { params: Promise<{ bookingId: string }> };

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { bookingId } = await params;
    const auth = await requireBookingAuth(request);

    // Confirm the booking is in the caller's tenant before exposing its orders.
    const booking = await prisma.booking.findFirst({
      where: { id: bookingId, tenantId: auth.tenantId },
      select: { id: true },
    });
    if (!booking) {
      throw new AppError("找不到此預約", 404, "BOOKING_NOT_FOUND");
    }

    const order = await prisma.eCPayOrder.findFirst({
      where: { bookingId, tenantId: auth.tenantId },
      orderBy: { createdAt: "desc" },
      select: {
        status: true,
        vAccount: true,
        bankCode: true,
        expireDate: true,
        amount: true,
      },
    });

    if (!order) {
      throw new AppError("尚未建立綠界訂單", 404, "ECPAY_ORDER_NOT_FOUND");
    }

    return NextResponse.json(order);
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    return errorResponse(error);
  }
}
