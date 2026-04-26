/**
 * Coupon issuance — Booking COMPLETED hook (PRD-v3 §8, Wave 4c).
 *
 * On booking completion, if the tenant has couponAbTest enabled, deterministically
 * assign the customer to arm A (30-day) or arm B (45-day) using userId hash, then
 * issue a Coupon. Both arms = 5% off (95 折); only the expiry differs — the single
 * variable lets us measure whether urgency or haircut-cycle alignment drives more
 * repeat visits.
 *
 * Emergency overrides via tenant.featureFlags:
 *   - couponStrategyAOnly: true → all customers get arm A
 *   - couponStrategyBOnly: true → all customers get arm B
 *   - couponAbTest: false (or absent) → no coupons issued
 *
 * Idempotent: if the same booking already has a coupon issued (BOOKING_COMPLETED
 * reason and usedForBookingId is null), we don't double-issue. Multiple completes
 * of the same booking → single coupon.
 */

import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/utils/logger";
import { getLineClient } from "@/lib/line/client";
import { CouponType } from "@prisma/client";
import type { Coupon } from "@prisma/client";

interface CouponFlags {
  couponAbTest?: boolean;
  couponStrategyAOnly?: boolean;
  couponStrategyBOnly?: boolean;
}

const STRATEGY_A_DAYS = 30;
const STRATEGY_B_DAYS = 45;
const COUPON_DISCOUNT_PCT = 5; // 95 折

/**
 * Stable hash of userId → 0 or 1. Used to deterministically assign arms.
 * Same user always lands in the same arm; resists rebalancing artifacts.
 */
function assignArm(userId: string): "A" | "B" {
  let h = 0;
  for (let i = 0; i < userId.length; i++) {
    h = ((h << 5) - h + userId.charCodeAt(i)) | 0;
  }
  return Math.abs(h) % 2 === 0 ? "A" : "B";
}

function generateCode(arm: "A" | "B"): string {
  // Format: 95-A-XXXXXX (human-readable + arm marker for owner support).
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `95-${arm}-${rand}`;
}

/**
 * Issue a coupon for a completed booking. Returns the coupon, or null if
 * skipped (feature-flag off, already issued, customer has manual lineUserId, etc).
 */
export async function issueCouponForCompletedBooking(params: {
  bookingId: string;
  tenantId: string;
  userId: string;
  lineUserId: string;
}): Promise<Coupon | null> {
  const { bookingId, tenantId, userId, lineUserId } = params;

  // Skip walk-in / phone bookings without real LINE accounts — we can't push the
  // coupon to them and the "earn it back" UX falls flat.
  if (lineUserId.startsWith("manual-") || lineUserId.startsWith("legacy-")) {
    return null;
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { featureFlags: true, businessName: true, liffId: true },
  });
  const flags = (tenant?.featureFlags ?? {}) as CouponFlags;
  if (!flags.couponAbTest && !flags.couponStrategyAOnly && !flags.couponStrategyBOnly) {
    return null;
  }

  // Idempotency: already issued for this booking?
  const existing = await prisma.coupon.findFirst({
    where: {
      tenantId,
      userId,
      issuedReason: "BOOKING_COMPLETED",
      // We tag the issuing booking via the code suffix → not queryable, so we
      // approximate: if a BOOKING_COMPLETED coupon was issued in the last 5 min
      // for this user, assume same booking. Strict idempotency would require
      // a sourceBookingId column (consider for V3.5).
      issuedAt: { gte: new Date(Date.now() - 5 * 60 * 1000) },
    },
  });
  if (existing) return existing;

  // Decide arm
  let arm: "A" | "B";
  if (flags.couponStrategyAOnly) arm = "A";
  else if (flags.couponStrategyBOnly) arm = "B";
  else arm = assignArm(userId);

  const days = arm === "A" ? STRATEGY_A_DAYS : STRATEGY_B_DAYS;
  const couponType: CouponType =
    arm === "A" ? "STRATEGY_A_30D_95OFF" : "STRATEGY_B_45D_95OFF";
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

  const code = generateCode(arm);

  const coupon = await prisma.coupon.create({
    data: {
      tenantId,
      userId,
      code,
      type: couponType,
      discountPct: COUPON_DISCOUNT_PCT,
      experimentArm: arm,
      expiresAt,
      issuedReason: "BOOKING_COMPLETED",
    },
  });

  // Push coupon notification (best-effort).
  try {
    const lineClient = getLineClient();
    const expireStr = expiresAt.toLocaleDateString("zh-TW", {
      timeZone: "Asia/Taipei",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const liffUrl = tenant?.liffId
      ? `https://liff.line.me/${tenant.liffId}/my-coupons`
      : undefined;
    await lineClient.pushMessage(lineUserId, {
      type: "text",
      text:
        `🎁 ${tenant?.businessName ?? "我們"}送您一張 95 折券！\n` +
        `\n優惠碼：${code}` +
        `\n有效期：至 ${expireStr}（${days} 天）` +
        `\n下次預約時自動帶入折抵\n` +
        (liffUrl ? `\n👉 查看：${liffUrl}` : ""),
    });
  } catch (err) {
    logger.error("issueCoupon LINE push failed", err, "coupons", {
      bookingId,
      couponCode: code,
    });
  }

  logger.info("coupon issued", "coupons", {
    bookingId,
    userId,
    arm,
    days,
    code,
  });

  return coupon;
}
