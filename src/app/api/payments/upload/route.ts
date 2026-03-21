import { NextRequest } from "next/server";
import { put } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { errorResponse } from "@/lib/utils/errors";

/** POST /api/payments/upload — upload transfer screenshot */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const bookingId = formData.get("bookingId") as string | null;

    if (!file || !bookingId) {
      return Response.json({ error: "Missing file or bookingId" }, { status: 400 });
    }

    // Validate file type
    if (!file.type.startsWith("image/")) {
      return Response.json({ error: "只接受圖片檔案" }, { status: 400 });
    }

    // Max 5MB
    if (file.size > 5 * 1024 * 1024) {
      return Response.json({ error: "檔案大小不能超過 5MB" }, { status: 400 });
    }

    // Upload to Vercel Blob
    const blob = await put(`receipts/${bookingId}-${Date.now()}.${file.type.split("/")[1]}`, file, {
      access: "public",
    });

    // Upsert payment record with screenshot URL
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: { service: { select: { price: true } } },
    });

    const payment = await prisma.payment.upsert({
      where: { bookingId },
      update: {
        screenshotUrl: blob.url,
        method: "BANK_TRANSFER",
      },
      create: {
        bookingId,
        amount: booking?.service.price || 0,
        method: "BANK_TRANSFER",
        status: "PENDING",
        screenshotUrl: blob.url,
      },
    });

    return Response.json({ payment, url: blob.url }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
