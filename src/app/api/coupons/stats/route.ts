import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireBookingAuth, requireAdmin } from "@/lib/auth/booking-auth";
import { errorResponse } from "@/lib/utils/errors";

interface ArmStats {
  arm: "A" | "B";
  expiryDays: number;
  issued: number;
  used: number;
  expired: number;
  available: number;
  redemptionRate: number;
}

interface FeatureFlags {
  couponAbTest?: boolean;
  couponStrategyAOnly?: boolean;
  couponStrategyBOnly?: boolean;
  [k: string]: unknown;
}

/**
 * GET /api/coupons/stats — admin A/B dashboard summary (PRD-v3 §8, Wave 4c).
 *
 * Returns counts per experiment arm (A=30d, B=45d) for issued/used/expired/
 * available, plus tenant feature flag state. Cheap aggregate query — runs
 * 4 SELECT COUNT(*)s per arm.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireBookingAuth(request);
    requireAdmin(auth);

    const tenantId = auth.tenantId;
    const now = new Date();

    const arms: ("A" | "B")[] = ["A", "B"];
    const stats: ArmStats[] = [];

    for (const arm of arms) {
      const [issued, used, expired, available] = await Promise.all([
        prisma.coupon.count({
          where: { tenantId, experimentArm: arm },
        }),
        prisma.coupon.count({
          where: { tenantId, experimentArm: arm, usedAt: { not: null } },
        }),
        prisma.coupon.count({
          where: {
            tenantId,
            experimentArm: arm,
            usedAt: null,
            expiresAt: { lte: now },
          },
        }),
        prisma.coupon.count({
          where: {
            tenantId,
            experimentArm: arm,
            usedAt: null,
            expiresAt: { gt: now },
          },
        }),
      ]);
      stats.push({
        arm,
        expiryDays: arm === "A" ? 30 : 45,
        issued,
        used,
        expired,
        available,
        redemptionRate: issued > 0 ? Math.round((used / issued) * 1000) / 10 : 0,
      });
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { featureFlags: true },
    });
    const flags = (tenant?.featureFlags ?? {}) as FeatureFlags;

    return Response.json({
      arms: stats,
      flags: {
        couponAbTest: !!flags.couponAbTest,
        couponStrategyAOnly: !!flags.couponStrategyAOnly,
        couponStrategyBOnly: !!flags.couponStrategyBOnly,
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
