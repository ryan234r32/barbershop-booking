import { NextRequest, NextResponse } from "next/server";
import { errorResponse, UnauthorizedError } from "@/lib/utils/errors";
import { requireBookingAuth } from "@/lib/auth/booking-auth";
import { createEcpayAtmOrder } from "@/lib/ecpay/order-service";

/**
 * POST /api/payments/[bookingId]/ecpay/create-order
 *
 * Customer (or admin-on-behalf) chose Tier S on the payment page. We:
 *   1. Authenticate the caller (admin JWT OR LIFF ID token).
 *   2. Validate the booking, enforce monthly cap, acquire a Redis lock.
 *   3. Persist an ECPayOrder(PENDING) in the DB.
 *   4. Build the auto-submitting HTML form via the ECPay SDK and return it.
 *
 * The client's browser posts that form to ECPay, which responds with the
 * virtual account page and fires webhooks at us (see PR3).
 */

// SDK uses Node crypto + Buffer; Edge runtime would fail.
export const runtime = "nodejs";

type RouteParams = { params: Promise<{ bookingId: string }> };

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { bookingId } = await params;
    const auth = await requireBookingAuth(request);

    const actor =
      auth.type === "admin"
        ? { type: "admin" as const, adminId: auth.adminId }
        : { type: "liff" as const, lineUserId: auth.lineUserId };

    const result = await createEcpayAtmOrder({
      bookingId,
      tenantId: auth.tenantId,
      actor,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    return errorResponse(error);
  }
}
