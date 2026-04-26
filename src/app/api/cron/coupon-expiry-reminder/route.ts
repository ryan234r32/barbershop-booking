import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getLineClient } from "@/lib/line/client";
import { verifyCronSecret } from "@/lib/utils/cron-auth";
import { logger } from "@/lib/utils/logger";
import { nowTaipei } from "@/lib/utils/time";

/**
 * GET /api/cron/coupon-expiry-reminder (PRD-v3 §8, Wave 4c)
 *
 * Daily 02:00 UTC = 10:00 Taipei. Push a reminder LINE message to customers
 * holding an unused coupon expiring in the next ~7 days. Idempotent within
 * the day: tracks which (couponId, day) combos have been pinged via the
 * `Notification` table (type=CUSTOM, payload.couponId=...).
 *
 * Window: 5–8 days before expiry. The 5-day floor avoids the first daily run
 * after issuance triggering a redundant ping; the 8-day ceiling lets us
 * tolerate cron slip.
 */
export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = nowTaipei();
    const startWindow = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);
    const endWindow = new Date(now.getTime() + 8 * 24 * 60 * 60 * 1000);

    const coupons = await prisma.coupon.findMany({
      where: {
        usedAt: null,
        expiresAt: { gte: startWindow, lte: endWindow },
      },
      include: {
        user: { select: { lineUserId: true, displayName: true } },
        tenant: { select: { businessName: true, liffId: true } },
      },
      take: 500,
    });

    let sent = 0;
    let skipped = 0;
    const lineClient = getLineClient();
    const todayStr = now.toLocaleDateString("en-CA", { timeZone: "Asia/Taipei" });

    for (const c of coupons) {
      if (!c.user?.lineUserId || c.user.lineUserId.startsWith("manual-") || c.user.lineUserId.startsWith("legacy-")) {
        skipped++;
        continue;
      }

      // Idempotency: have we already pinged this coupon today?
      const dedupTag = `coupon-expiry:${c.id}:${todayStr}`;
      const existing = await prisma.notification.findFirst({
        where: {
          tenantId: c.tenantId,
          type: "CUSTOM",
          lineUserId: c.user.lineUserId,
          messagePayload: { equals: { dedupTag } },
        },
        select: { id: true },
      });
      if (existing) {
        skipped++;
        continue;
      }

      const daysLeft = Math.ceil((c.expiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
      const expireStr = c.expiresAt.toLocaleDateString("zh-TW", {
        timeZone: "Asia/Taipei",
        month: "2-digit",
        day: "2-digit",
      });
      const liffUrl = c.tenant.liffId
        ? `https://liff.line.me/${c.tenant.liffId}/my-coupons`
        : undefined;

      try {
        await lineClient.pushMessage(c.user.lineUserId, {
          type: "text",
          text:
            `⏰ ${c.tenant.businessName ?? "我們"}的 95 折券快到期囉！\n\n` +
            `優惠碼：${c.code}\n` +
            `剩餘 ${daysLeft} 天（${expireStr} 到期）\n\n` +
            (liffUrl
              ? `下次預約時自動帶入折抵 👉 ${liffUrl}`
              : "預約時跟我們說優惠碼即可折抵"),
        });
        await prisma.notification.create({
          data: {
            tenantId: c.tenantId,
            type: "CUSTOM",
            scheduledAt: now,
            sentAt: now,
            status: "SENT",
            lineUserId: c.user.lineUserId,
            messagePayload: { dedupTag, couponId: c.id, code: c.code },
          },
        });
        sent++;
      } catch (err) {
        logger.error("coupon expiry push failed", err, "cron", { couponId: c.id });
        skipped++;
      }
    }

    return Response.json({ success: true, sent, skipped, candidates: coupons.length });
  } catch (err) {
    logger.error("coupon-expiry-reminder cron failed", err, "cron");
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}
