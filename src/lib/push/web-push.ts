import webpush from "web-push";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/utils/logger";
import { nowTaipei } from "@/lib/utils/time";

webpush.setVapidDetails(
  "mailto:admin@1008hairstudio.com",
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

/**
 * Send Web Push to all subscriptions for a tenant's admin users.
 * Respects quiet hours (20:00-11:00 Taipei time).
 * Fire-and-forget — never throws.
 */
export async function sendWebPushToAdmin(
  tenantId: string,
  payload: PushPayload
) {
  try {
    // 安靜時段：20:00 後不推播
    const now = nowTaipei();
    const hour = now.getHours();
    if (hour >= 20 || hour < 8) {
      logger.info("Web Push skipped — quiet hours", "web-push");
      return;
    }

    const subscriptions = await prisma.pushSubscription.findMany({
      where: { tenantId },
    });

    if (subscriptions.length === 0) return;

    const results = await Promise.allSettled(
      subscriptions.map(async (sub) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            JSON.stringify(payload)
          );
        } catch (error: unknown) {
          // 410 Gone = subscription expired, delete it
          if (
            error instanceof webpush.WebPushError &&
            error.statusCode === 410
          ) {
            await prisma.pushSubscription.delete({ where: { id: sub.id } });
            logger.info(`Deleted expired push subscription ${sub.id}`, "web-push");
          } else {
            throw error;
          }
        }
      })
    );

    const failed = results.filter((r) => r.status === "rejected").length;
    if (failed > 0) {
      logger.warn(`Web Push: ${failed}/${results.length} failed`, "web-push");
    }
  } catch (error) {
    logger.error("Web Push send failed", error as Error, "web-push");
  }
}
