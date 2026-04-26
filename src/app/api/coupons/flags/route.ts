import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireBookingAuth, requireAdmin } from "@/lib/auth/booking-auth";
import { errorResponse } from "@/lib/utils/errors";

const flagsSchema = z.object({
  couponAbTest: z.boolean().optional(),
  couponStrategyAOnly: z.boolean().optional(),
  couponStrategyBOnly: z.boolean().optional(),
});

interface FeatureFlags {
  couponAbTest?: boolean;
  couponStrategyAOnly?: boolean;
  couponStrategyBOnly?: boolean;
  [k: string]: unknown;
}

/**
 * PATCH /api/coupons/flags — admin updates tenant.featureFlags (Wave 4c).
 * Idempotent. Only known coupon flags are merged — other tenant flags untouched.
 */
export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireBookingAuth(request);
    requireAdmin(auth);

    const data = flagsSchema.parse(await request.json());

    const tenant = await prisma.tenant.findUnique({
      where: { id: auth.tenantId },
      select: { featureFlags: true },
    });
    const current = (tenant?.featureFlags ?? {}) as FeatureFlags;
    const next: FeatureFlags = { ...current };

    if (data.couponAbTest !== undefined) next.couponAbTest = data.couponAbTest;
    if (data.couponStrategyAOnly !== undefined)
      next.couponStrategyAOnly = data.couponStrategyAOnly;
    if (data.couponStrategyBOnly !== undefined)
      next.couponStrategyBOnly = data.couponStrategyBOnly;

    // Mutual exclusion: A-only XOR B-only — flipping one auto-clears the other.
    if (next.couponStrategyAOnly && next.couponStrategyBOnly) {
      next.couponStrategyBOnly = false;
    }

    await prisma.tenant.update({
      where: { id: auth.tenantId },
      data: { featureFlags: next as unknown as object },
    });

    return Response.json({
      flags: {
        couponAbTest: !!next.couponAbTest,
        couponStrategyAOnly: !!next.couponStrategyAOnly,
        couponStrategyBOnly: !!next.couponStrategyBOnly,
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
