import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { errorResponse } from "@/lib/utils/errors";
import { getAdminFromCookie } from "@/lib/auth/jwt";
import { getLineClient } from "@/lib/line/client";
import { logger } from "@/lib/utils/logger";

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

    // When admin confirms payment received, notify customer via LINE
    if (body.status === "RECEIVED") {
      try {
        const booking = await prisma.booking.findUnique({
          where: { id: bookingId },
          include: {
            user: { select: { lineUserId: true } },
            service: { select: { name: true } },
          },
        });
        if (booking?.user.lineUserId) {
          const lineClient = getLineClient();
          await lineClient.pushMessage(booking.user.lineUserId, {
            type: "flex",
            altText: "付款已確認",
            contents: {
              type: "bubble",
              body: {
                type: "box",
                layout: "vertical",
                contents: [
                  { type: "text", text: "付款已確認 ✓", weight: "bold", size: "lg", color: "#4A7C59" },
                  { type: "text", text: `${booking.service.name} 的款項已確認收到，感謝您！`, size: "sm", color: "#2D3A30", margin: "md", wrap: true },
                ],
              },
            },
          });
        }
      } catch (lineErr) {
        logger.error("Failed to notify customer of payment confirmation", lineErr, "payments");
      }
    }

    return Response.json({ payment });
  } catch (error) {
    return errorResponse(error);
  }
}
