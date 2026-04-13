import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getLineClient } from "@/lib/line/client";
import { errorResponse } from "@/lib/utils/errors";
import { logger } from "@/lib/utils/logger";

type RouteParams = { params: Promise<{ bookingId: string }> };

/** POST /api/payments/[bookingId]/confirm — customer confirms payment method */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { bookingId } = await params;
    const body = await request.json();
    const method = body.method as "CASH" | "BANK_TRANSFER";

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        service: { select: { name: true, price: true } },
        user: { select: { lineUserId: true, displayName: true } },
      },
    });

    if (!booking) {
      return Response.json({ error: "Booking not found" }, { status: 404 });
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

    // Send LINE confirmation to customer
    try {
      const lineClient = getLineClient();
      const methodLabel = method === "CASH" ? "到店現金付款" : "銀行轉帳";
      const description = method === "CASH"
        ? "到店時直接付款即可，我們期待為您服務！"
        : "截圖已上傳，等待店家確認中。";

      await lineClient.pushMessage(booking.user.lineUserId, {
        type: "flex",
        altText: `已選擇${methodLabel}`,
        contents: {
          type: "bubble",
          body: {
            type: "box",
            layout: "vertical",
            contents: [
              { type: "text", text: `付款方式已確認`, weight: "bold", size: "lg", color: "#003D2B" },
              { type: "separator", margin: "md" },
              { type: "text", text: `服務：${booking.service.name}`, size: "sm", color: "#2D3A30", margin: "lg" },
              { type: "text", text: `金額：NT$${booking.service.price.toLocaleString()}`, size: "sm", color: "#2D3A30", margin: "sm" },
              { type: "text", text: `付款方式：${methodLabel}`, size: "sm", color: "#003D2B", weight: "bold", margin: "sm" },
              { type: "text", text: description, size: "xs", color: "#809A8E", margin: "lg", wrap: true },
            ],
          },
        },
      });
    } catch (lineErr) {
      logger.error("Failed to send payment confirmation LINE message", lineErr, "payments");
    }

    return Response.json({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}
