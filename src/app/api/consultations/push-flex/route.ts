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
import { Redis } from "@upstash/redis";
import { prisma } from "@/lib/prisma";
import { requireBookingAuth } from "@/lib/auth/booking-auth";
import { getLineClient } from "@/lib/line/client";
import {
  serviceInquiryFlexMessage,
  bleachConsultationFlexMessage,
} from "@/lib/line/messages";
import { errorResponse, AppError } from "@/lib/utils/errors";
import { logger } from "@/lib/utils/logger";

/** 5/19 bug fix: 客戶連點多次「打開 LINE 對話」會收到一堆 Flex 騷擾。
 *  Redis SET NX EX 5min — 同 lineUserId + serviceType 在 cooldown 內僅推一次。
 *  Redis 不可用 (local dev) 時 silently skip dedup，functional fallback。 */
const DEDUPE_TTL_SECONDS = 300;

function getRedisOrNull(): Redis | null {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null;
  }
  return new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });
}

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

    // 5/19 dedup: 5 分鐘 cooldown 內同 user+type 不重複推。SET NX EX 是原子操作。
    const redis = getRedisOrNull();
    let shouldPush = true;
    if (redis) {
      const key = `flex-pushed:${auth.lineUserId}:${input.serviceType}`;
      const result = await redis.set(key, "1", { nx: true, ex: DEDUPE_TTL_SECONDS });
      shouldPush = result === "OK"; // null = key already exists → skip
    }

    if (shouldPush) {
      try {
        const client = getLineClient();
        await client.pushMessage(auth.lineUserId, flex);
      } catch (lineErr) {
        // Don't break the LIFF flow on LINE failures — log + return 200.
        logger.error("push-flex push failed", lineErr, "consultations");
      }
    }

    return Response.json({ ok: true, deduped: !shouldPush });
  } catch (err) {
    return errorResponse(err);
  }
}
