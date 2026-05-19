/**
 * V3.7 P3 (5/19) — push consultation Flex (請傳 3 張照片) to the LIFF user's LINE.
 *
 * Trigger: LIFF service-step CONSULTATION sheet「打開 LINE 對話」 button.
 *   1. LIFF posts here with X-LIFF-ID-Token + serviceType.
 *   2. Server verifies token, pushes appropriate Flex Message to that user's LINE.
 *   3. LIFF calls liff.closeWindow(), customer lands on LINE OA with Flex waiting.
 *
 * Uses existing message templates:
 *   - perm   → serviceInquiryFlexMessage (perm)
 *   - color  → serviceInquiryFlexMessage (color)
 *   - bleach → bleachConsultationFlexMessage
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireBookingAuth } from "@/lib/auth/booking-auth";
import { getLineClient } from "@/lib/line/client";
import {
  serviceInquiryFlexMessage,
  bleachConsultationFlexMessage,
} from "@/lib/line/messages";
import { errorResponse, AppError } from "@/lib/utils/errors";
import { logger } from "@/lib/utils/logger";

const bodySchema = z.object({
  serviceType: z.enum(["perm", "color", "bleach"]),
});

export async function POST(request: NextRequest) {
  try {
    const auth = await requireBookingAuth(request);
    if (auth.type !== "liff") {
      throw new AppError("LIFF only endpoint", 403, "liff_only");
    }
    const input = bodySchema.parse(await request.json());

    const tenant = await prisma.tenant.findUnique({
      where: { id: auth.tenantId },
      select: { businessName: true, liffId: true },
    });
    if (!tenant) {
      throw new AppError("Tenant not found", 404, "no_tenant");
    }
    const liffBaseUrl = tenant.liffId ? `https://liff.line.me/${tenant.liffId}` : "";

    const flex =
      input.serviceType === "bleach"
        ? bleachConsultationFlexMessage({
            liffBaseUrl,
            consultationLiffUrl: `${liffBaseUrl}/consultation`,
            shopName: tenant.businessName,
          })
        : serviceInquiryFlexMessage({
            serviceType: input.serviceType,
            liffBaseUrl,
            shopName: tenant.businessName,
          });

    try {
      const client = getLineClient();
      await client.pushMessage(auth.lineUserId, flex);
    } catch (lineErr) {
      // Don't break the LIFF flow on LINE failures — log + return 200.
      logger.error("push-flex push failed", lineErr, "consultations");
    }

    return Response.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
