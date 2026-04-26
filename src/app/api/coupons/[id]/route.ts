import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireBookingAuth, requireAdmin } from "@/lib/auth/booking-auth";
import { errorResponse, AppError } from "@/lib/utils/errors";

const patchSchema = z.object({
  action: z.enum(["mark-used", "void"]),
  bookingId: z.string().uuid().optional(),
});

/**
 * PATCH /api/coupons/[id] (admin) — mark a coupon as used or void it.
 *
 *   action=mark-used → flip usedAt + (optional) usedForBookingId. Idempotent: if
 *     already used, returns the existing record.
 *   action=void      → set expiresAt to past so it disappears from "available"
 *     buckets. We don't hard-delete to preserve A/B telemetry.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireBookingAuth(request);
    requireAdmin(auth);
    const { id } = await params;
    const data = patchSchema.parse(await request.json());

    const coupon = await prisma.coupon.findFirst({
      where: { id, tenantId: auth.tenantId },
    });
    if (!coupon) throw new AppError("找不到優惠券", 404, "COUPON_NOT_FOUND");

    if (data.action === "mark-used") {
      if (coupon.usedAt) return Response.json({ coupon });
      if (coupon.expiresAt < new Date()) {
        throw new AppError("此優惠券已過期，無法標記使用", 400, "COUPON_EXPIRED");
      }
      const updated = await prisma.coupon.update({
        where: { id },
        data: {
          usedAt: new Date(),
          usedForBookingId: data.bookingId,
        },
      });
      return Response.json({ coupon: updated });
    }

    // void
    const past = new Date(Date.now() - 1000);
    const updated = await prisma.coupon.update({
      where: { id },
      data: { expiresAt: past },
    });
    return Response.json({ coupon: updated });
  } catch (err) {
    return errorResponse(err);
  }
}
