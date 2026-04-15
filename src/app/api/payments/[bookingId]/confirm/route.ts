import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getLineClient } from "@/lib/line/client";
import { cashSelectedMessage } from "@/lib/line/messages";
import { errorResponse } from "@/lib/utils/errors";
import { logger } from "@/lib/utils/logger";
import { getLineUserIdFromRequest } from "@/lib/liff/verify-id-token";

type RouteParams = { params: Promise<{ bookingId: string }> };

/** POST /api/payments/[bookingId]/confirm — customer confirms payment method */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { bookingId } = await params;

    const lineUserId = await getLineUserIdFromRequest(request);
    if (!lineUserId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const method = body.method as "CASH" | "BANK_TRANSFER";

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        service: { select: { name: true, price: true } },
        user: { select: { lineUserId: true, displayName: true } },
        tenant: { select: { businessName: true, address: true, liffId: true } },
      },
    });

    if (!booking) {
      return Response.json({ error: "Booking not found" }, { status: 404 });
    }

    if (booking.user.lineUserId !== lineUserId) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    // Upsert payment record with chosen method
    await prisma.payment.upsert({
      where: { bookingId },
      update: { method },
      create: {
        bookingId,
        amount: booking.service.price,
        method,
        status: "PENDING",
      },
    });

    // Push LINE Flex to customer. Cash gets a distinct "pay-at-store" Flex;
    // bank transfer users see the real "transfer received" Flex only after
    // submitting last-5 via report-transfer, so skip here.
    if (method === "CASH") {
      try {
        const liffBaseUrl = booking.tenant.liffId
          ? `https://liff.line.me/${booking.tenant.liffId}`
          : undefined;
        await getLineClient().pushMessage(
          booking.user.lineUserId,
          cashSelectedMessage({
            serviceName: booking.service.name,
            date: booking.date.toISOString().slice(0, 10),
            startTime: booking.startTime,
            endTime: booking.endTime,
            price: booking.service.price,
            shopName: booking.tenant.businessName,
            shopAddress: booking.tenant.address ?? undefined,
            liffBaseUrl,
          }),
        );
      } catch (lineErr) {
        logger.error("Failed to push cashSelected Flex", lineErr, "payments");
      }
    }

    return Response.json({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}
