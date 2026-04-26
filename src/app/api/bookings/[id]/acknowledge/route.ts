import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAdminFromCookie } from "@/lib/auth/jwt";
import { errorResponse, UnauthorizedError } from "@/lib/utils/errors";

type RouteParams = { params: Promise<{ id: string }> };

const ackSchema = z
  .object({
    /**
     * PRD-v3 E-1: optional optimistic-concurrency token.
     * The client sends the booking.updatedAt it observed; the server only
     * acks if the row hasn't been mutated since (e.g. by a reschedule that
     * reset adminAcknowledgedAt to null on a different device). On mismatch
     * we return 409 + the current state so the client can refetch and ask
     * the admin to re-confirm.
     */
    expectedUpdatedAt: z.string().datetime().optional(),
  })
  .optional();

/**
 * POST /api/bookings/[id]/acknowledge — admin marks "I've seen this booking".
 *
 * Idempotent: re-acknowledging a booking is a no-op (returns 200 with the
 * existing timestamp). This matters because the same modal queue can be open
 * on two devices — both can ack the same row without error.
 *
 * Cross-tenant safe: the WHERE clause includes adminUser.tenantId.
 *
 * Stale-write guard (PRD-v3 E-1): if `expectedUpdatedAt` is present and the
 * row has moved since, return 409 so the client refetches.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const admin = await getAdminFromCookie(request);
    if (!admin) throw new UnauthorizedError();

    const { id } = await params;

    // Body is optional — older clients may post no body at all.
    let parsed: z.infer<typeof ackSchema> = undefined;
    try {
      const body = await request.json().catch(() => null);
      parsed = body ? ackSchema.parse(body) : undefined;
    } catch (zodErr) {
      return errorResponse(zodErr);
    }
    const expectedUpdatedAt = parsed?.expectedUpdatedAt;

    const booking = await prisma.booking.findFirst({
      where: { id, tenantId: admin.tenantId },
      select: { id: true, adminAcknowledgedAt: true, updatedAt: true },
    });
    if (!booking) {
      return Response.json({ error: "Booking not found" }, { status: 404 });
    }

    // Optimistic-concurrency check (PRD-v3 E-1). We compare to ms precision —
    // Prisma stores DateTime with millisecond precision so direct comparison
    // is safe.
    if (
      expectedUpdatedAt &&
      new Date(expectedUpdatedAt).getTime() !== booking.updatedAt.getTime()
    ) {
      return Response.json(
        {
          error: "stale_ack",
          message: "此預約已更新，請重新確認",
          current: {
            adminAcknowledgedAt: booking.adminAcknowledgedAt,
            updatedAt: booking.updatedAt,
          },
        },
        { status: 409 },
      );
    }

    // Idempotent: only update if not already acked.
    if (booking.adminAcknowledgedAt) {
      return Response.json({
        ok: true,
        adminAcknowledgedAt: booking.adminAcknowledgedAt,
        updatedAt: booking.updatedAt,
        wasAlreadyAcked: true,
      });
    }

    const updated = await prisma.booking.update({
      where: { id },
      data: { adminAcknowledgedAt: new Date() },
      select: { adminAcknowledgedAt: true, updatedAt: true },
    });

    return Response.json({
      ok: true,
      adminAcknowledgedAt: updated.adminAcknowledgedAt,
      updatedAt: updated.updatedAt,
      wasAlreadyAcked: false,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
