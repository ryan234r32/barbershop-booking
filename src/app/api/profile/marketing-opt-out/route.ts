/**
 * V3.6 §14.5 — LIFF 客戶設定推播開關。
 *
 * GET  /api/profile/marketing-opt-out → { optedOut: boolean }
 * POST /api/profile/marketing-opt-out { optedOut: true | false }
 *
 * 只影響 retention-push cron（行銷推播）；交易性推播（預約確認、提醒）不受影響。
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireBookingAuth } from "@/lib/auth/booking-auth";
import { errorResponse } from "@/lib/utils/errors";

const bodySchema = z.object({ optedOut: z.boolean() });

export async function GET(request: NextRequest) {
  try {
    const auth = await requireBookingAuth(request);
    if (auth.type === "admin") {
      // Admin probing is allowed but uninteresting — return false.
      return Response.json({ optedOut: false });
    }
    const user = await prisma.user.findUnique({
      where: { tenantId_lineUserId: { tenantId: auth.tenantId, lineUserId: auth.lineUserId } },
      select: { marketingOptOut: true },
    });
    return Response.json({ optedOut: user?.marketingOptOut ?? false });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireBookingAuth(request);
    if (auth.type === "admin") {
      return Response.json({ error: "admin cannot opt out" }, { status: 400 });
    }
    const body = await request.json();
    const { optedOut } = bodySchema.parse(body);

    await prisma.user.update({
      where: { tenantId_lineUserId: { tenantId: auth.tenantId, lineUserId: auth.lineUserId } },
      data: { marketingOptOut: optedOut },
    });
    return Response.json({ ok: true, optedOut });
  } catch (err) {
    return errorResponse(err);
  }
}
