import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { prisma } from "@/lib/prisma";
import { errorResponse } from "@/lib/utils/errors";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

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

    // Upload to Supabase Storage
    const ext = file.type.split("/")[1];
    const filePath = `receipts/${bookingId}-${Date.now()}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const supabase = getSupabase();
    const { error: uploadError } = await supabase.storage
      .from("payments")
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      return Response.json({ error: "上傳失敗：" + uploadError.message }, { status: 500 });
    }

    const { data: urlData } = supabase.storage
      .from("payments")
      .getPublicUrl(filePath);

    // Upsert payment record with screenshot URL
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: { service: { select: { price: true } } },
    });

    const payment = await prisma.payment.upsert({
      where: { bookingId },
      update: {
        screenshotUrl: urlData.publicUrl,
        method: "BANK_TRANSFER",
      },
      create: {
        bookingId,
        amount: booking?.service.price || 0,
        method: "BANK_TRANSFER",
        status: "PENDING",
        screenshotUrl: urlData.publicUrl,
      },
    });

    return Response.json({ payment, url: urlData.publicUrl }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
