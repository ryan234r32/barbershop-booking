import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminFromCookie } from "@/lib/auth/jwt";
import { errorResponse, UnauthorizedError } from "@/lib/utils/errors";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * POST /api/bookings/[id]/acknowledge — admin marks "I've seen this booking".
 *
 * Idempotent: re-acknowledging a booking is a no-op (returns 200 with the
 * existing timestamp). This matters because the same modal queue can be open
 * on two devices — both can ack the same row without error.
 *
 * Cross-tenant safe: the WHERE clause includes adminUser.tenantId.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const admin = await getAdminFromCookie(request);
    if (!admin) throw new UnauthorizedError();

    const { id } = await params;

    const booking = await prisma.booking.findFirst({
      where: { id, tenantId: admin.tenantId },
      select: { id: true, adminAcknowledgedAt: true },
    });
    if (!booking) {
      return Response.json({ error: "Booking not found" }, { status: 404 });
    }

    // Idempotent: only update if not already acked.
    if (booking.adminAcknowledgedAt) {
      return Response.json({
        ok: true,
        adminAcknowledgedAt: booking.adminAcknowledgedAt,
        wasAlreadyAcked: true,
      });
    }

    const updated = await prisma.booking.update({
      where: { id },
      data: { adminAcknowledgedAt: new Date() },
      select: { adminAcknowledgedAt: true },
    });

    return Response.json({
      ok: true,
      adminAcknowledgedAt: updated.adminAcknowledgedAt,
      wasAlreadyAcked: false,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
