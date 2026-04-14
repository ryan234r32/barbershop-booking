/**
 * Web Push sender for admin PWA notifications.
 *
 *  ┌─ sendWebPushToAdmin(tenantId, payload, opts) ────────────────┐
 *  │                                                                │
 *  │  1. Ensure VAPID env is set (noop if not)                      │
 *  │  2. Optional quiet-hours gate (default off — admin wants       │
 *  │     booking alerts 24/7; caller opts in for messages inbox)    │
 *  │  3. Fetch PushSubscription rows for tenant                     │
 *  │  4. Fan out sendNotification calls                             │
 *  │     410 / 404 / 401 → delete row                               │
 *  │     429 / 5xx / net → keep row, increment failureCount         │
 *  │  5. Return { sent, failed }                                    │
 *  │                                                                │
 *  └────────────────────────────────────────────────────────────────┘
 *
 * Fire-and-forget: the outer try/catch never throws, caller doesn't need
 * to await unless they want the counts.
 */

import webpush from "web-push";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/utils/logger";
import { nowTaipei } from "@/lib/utils/time";

export interface PushPayload {
  title: string;
  body: string;
  /** Where to navigate on tap. Default: "/calendar" (see sw.ts notificationclick). */
  url?: string;
  /** Collapse/dedup key. Same tag replaces prior unshown notification. */
  tag?: string;
}

export interface SendResult {
  sent: number;
  failed: number;
}

export interface SendOptions {
  /**
   * When true, skip push if now() is inside 20:00-08:00 Taipei.
   * Default false — booking alerts should fire 24/7 (3am booking = fraud signal).
   * Intended for future message-inbox use.
   */
  respectQuietHours?: boolean;
}

const QUIET_START_HOUR = 20; // 20:00 Taipei
const QUIET_END_HOUR = 8; // 08:00 Taipei

/** True if `at` (default: now Taipei) is within 20:00-08:00. Pure, testable. */
export function isInQuietHours(at: Date = nowTaipei()): boolean {
  const h = at.getHours();
  return h >= QUIET_START_HOUR || h < QUIET_END_HOUR;
}

/**
 * Lazy initialise VAPID on first use.
 * Returns true when configured and ready; false when env is missing.
 * Missing env must not crash module import — the feature just becomes inert.
 */
let vapidReady: boolean | null = null;
function ensureVapidConfigured(): boolean {
  if (vapidReady !== null) return vapidReady;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:admin@1008hairstudio.com";
  if (!pub || !priv) {
    logger.warn("Web Push disabled — VAPID keys not configured", "web-push");
    vapidReady = false;
    return false;
  }
  try {
    webpush.setVapidDetails(subject, pub, priv);
    vapidReady = true;
    return true;
  } catch (err) {
    logger.error("Web Push VAPID configuration failed", err as Error, "web-push");
    vapidReady = false;
    return false;
  }
}

/** Internal: reset memoised state — tests only. */
export function _resetVapidMemo() {
  vapidReady = null;
}

/** Status codes that mean the subscription is permanently dead. */
const DEAD_STATUS = new Set([401, 404, 410]);

/**
 * Fan out a push to every active subscription for this tenant's admins.
 * Fire-and-forget — never throws. Callers can await the counts for logging.
 */
export async function sendWebPushToAdmin(
  tenantId: string,
  payload: PushPayload,
  opts: SendOptions = {}
): Promise<SendResult> {
  try {
    if (!ensureVapidConfigured()) return { sent: 0, failed: 0 };

    if (opts.respectQuietHours && isInQuietHours()) {
      logger.info("Web Push skipped — quiet hours", "web-push");
      return { sent: 0, failed: 0 };
    }

    const subscriptions = await prisma.pushSubscription.findMany({
      where: { tenantId },
      select: { id: true, endpoint: true, p256dh: true, auth: true },
    });

    if (subscriptions.length === 0) return { sent: 0, failed: 0 };

    const body = JSON.stringify(payload);
    let sent = 0;
    let failed = 0;

    await Promise.all(
      subscriptions.map(async (sub) => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            body
          );
          sent += 1;
        } catch (err) {
          failed += 1;
          const statusCode = (err as { statusCode?: number }).statusCode;

          if (statusCode !== undefined && DEAD_STATUS.has(statusCode)) {
            await prisma.pushSubscription
              .delete({ where: { id: sub.id } })
              .catch((e) =>
                logger.warn("failed to delete dead subscription", "web-push", {
                  id: sub.id,
                  err: String(e),
                })
              );
            logger.info("push subscription removed (dead endpoint)", "web-push", {
              id: sub.id,
              statusCode,
            });
          } else {
            await prisma.pushSubscription
              .update({
                where: { id: sub.id },
                data: {
                  failureCount: { increment: 1 },
                  lastFailedAt: new Date(),
                },
              })
              .catch(() => {
                /* non-critical */
              });
            logger.warn("push send failed (transient)", "web-push", {
              id: sub.id,
              statusCode,
            });
          }
        }
      })
    );

    return { sent, failed };
  } catch (err) {
    logger.error("Web Push send failed", err as Error, "web-push");
    return { sent: 0, failed: 0 };
  }
}
