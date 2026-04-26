import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireBookingAuth, requireAdmin } from "@/lib/auth/booking-auth";
import { errorResponse, AppError } from "@/lib/utils/errors";
import { CouponType, type Prisma } from "@prisma/client";

/**
 * GET /api/coupons (PRD-v3 §8, Wave 4c)
 *   LIFF caller: returns the caller's own coupons.
 *     ?status=available|used|expired|all (default available — non-expired non-used)
 *   Admin caller: returns all coupons in the tenant (paginated).
 *     ?arm=A|B  ?status=…  ?limit=100
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireBookingAuth(request);
    const { searchParams } = request.nextUrl;
    const status = searchParams.get("status") || "available";
    const limit = Math.min(parseInt(searchParams.get("limit") || "100") || 100, 500);

    const baseWhere: Prisma.CouponWhereInput = { tenantId: auth.tenantId };

    if (auth.type === "liff") {
      const user = await prisma.user.findUnique({
        where: {
          tenantId_lineUserId: {
            tenantId: auth.tenantId,
            lineUserId: auth.lineUserId,
          },
        },
        select: { id: true },
      });
      if (!user) return Response.json({ items: [] });
      baseWhere.userId = user.id;
    } else {
      requireAdmin(auth);
      const arm = searchParams.get("arm");
      if (arm === "A" || arm === "B") baseWhere.experimentArm = arm;
    }

    const now = new Date();
    if (status === "available") {
      baseWhere.usedAt = null;
      baseWhere.expiresAt = { gt: now };
    } else if (status === "used") {
      baseWhere.usedAt = { not: null };
    } else if (status === "expired") {
      baseWhere.usedAt = null;
      baseWhere.expiresAt = { lte: now };
    }

    const items = await prisma.coupon.findMany({
      where: baseWhere,
      include:
        auth.type === "admin"
          ? {
              user: { select: { id: true, displayName: true, lineUserId: true, segment: true } },
            }
          : undefined,
      orderBy: [{ usedAt: { sort: "desc", nulls: "first" } }, { issuedAt: "desc" }],
      take: limit,
    });

    return Response.json({ items });
  } catch (err) {
    return errorResponse(err);
  }
}

const adminIssueSchema = z.object({
  userId: z.string().uuid(),
  arm: z.enum(["A", "B"]).default("A"),
  notes: z.string().optional(),
});

/**
 * POST /api/coupons — admin manually issues a coupon (e.g. apology / VIP gift).
 * Auto-issuance on booking COMPLETED happens in lib/coupons/issue.ts.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireBookingAuth(request);
    requireAdmin(auth);
    const data = adminIssueSchema.parse(await request.json());

    const user = await prisma.user.findFirst({
      where: { id: data.userId, tenantId: auth.tenantId },
      select: { id: true },
    });
    if (!user) throw new AppError("找不到客戶", 404, "USER_NOT_FOUND");

    const days = data.arm === "A" ? 30 : 45;
    const couponType: CouponType =
      data.arm === "A" ? "STRATEGY_A_30D_95OFF" : "STRATEGY_B_45D_95OFF";
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    const code = `MANUAL-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

    const coupon = await prisma.coupon.create({
      data: {
        tenantId: auth.tenantId,
        userId: user.id,
        code,
        type: couponType,
        discountPct: 5,
        experimentArm: data.arm,
        expiresAt,
        issuedReason: "MANUAL",
      },
    });

    return Response.json({ coupon }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
