import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { errorResponse } from "@/lib/utils/errors";
import { getAdminFromCookie } from "@/lib/auth/jwt";

type RouteParams = { params: Promise<{ bookingId: string }> };

/** GET /api/payments/[bookingId] — get payment for a booking */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { bookingId } = await params;

    const payment = await prisma.payment.findUnique({
      where: { bookingId },
      include: {
        booking: {
          select: { service: { select: { name: true, price: true } } },
        },
      },
    });

    if (!payment) {
      return Response.json({ error: "Payment not found" }, { status: 404 });
    }

    return Response.json({ payment });
  } catch (error) {
    return errorResponse(error);
  }
}

/** PATCH /api/payments/[bookingId] — update payment status (admin) */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const admin = await getAdminFromCookie(request);
    if (!admin) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { bookingId } = await params;
    const body = await request.json();

    const payment = await prisma.payment.upsert({
      where: { bookingId },
      update: {
        status: body.status,
        method: body.method,
        notes: body.notes,
        receivedAt: body.status === "RECEIVED" ? new Date() : undefined,
      },
      create: {
        bookingId,
        amount: body.amount || 0,
        status: body.status || "PENDING",
        method: body.method || "CASH",
        notes: body.notes,
      },
    });

    return Response.json({ payment });
  } catch (error) {
    return errorResponse(error);
  }
}
