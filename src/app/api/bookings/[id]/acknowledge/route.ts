import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAdminFromCookie } from "@/lib/auth/jwt";
import { errorResponse, UnauthorizedError } from "@/lib/utils/errors";
import { invalidateReportsCache } from "@/lib/cache/invalidate";

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
    // Outer try/catch handles ZodError → 400 via errorResponse; we just need
    // to tolerate a missing body gracefully.
    const body = await request.json().catch(() => null);
    const parsed: z.infer<typeof ackSchema> = body ? ackSchema.parse(body) : undefined;
    const expectedUpdatedAt = parsed?.expectedUpdatedAt;

    const booking = await prisma.booking.findFirst({
      where: { id, tenantId: admin.tenantId },
      select: { id: true, adminAcknowledgedAt: true, updatedAt: true },
    });
    if (!booking) {
      return Response.json({ error: "Booking not found" }, { status: 404 });
    }

    // Idempotent: short-circuit if already acked (no DB write needed).
    if (booking.adminAcknowledgedAt) {
      // Still enforce the OCC check so a stale read on an already-acked
      // booking that has since been rescheduled (and re-set to null) returns 409.
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
      return Response.json({
        ok: true,
        adminAcknowledgedAt: booking.adminAcknowledgedAt,
        updatedAt: booking.updatedAt,
        wasAlreadyAcked: true,
      });
    }

    // Conditional update: WHERE id=? AND updatedAt=? (codex P1 fix).
    // If another transaction (e.g. /reschedule) bumps updatedAt between our
    // findFirst and update, updateMany returns count=0 and we surface 409.
    // This closes the TOCTOU between the read and the unconditional write.
    const ackTime = new Date();
    const updateResult = await prisma.booking.updateMany({
      where: {
        id,
        tenantId: admin.tenantId,
        adminAcknowledgedAt: null,
        ...(expectedUpdatedAt
          ? { updatedAt: new Date(expectedUpdatedAt) }
          : { updatedAt: booking.updatedAt }),
      },
      data: { adminAcknowledgedAt: ackTime },
    });

    if (updateResult.count === 0) {
      // Re-read for the latest state to surface in 409
      const fresh = await prisma.booking.findFirst({
        where: { id, tenantId: admin.tenantId },
        select: { adminAcknowledgedAt: true, updatedAt: true },
      });
      return Response.json(
        {
          error: "stale_ack",
          message: "此預約已更新，請重新確認",
          current: fresh,
        },
        { status: 409 },
      );
    }

    // Re-fetch to get the post-update updatedAt for the client's next OCC token.
    const fresh = await prisma.booking.findFirst({
      where: { id, tenantId: admin.tenantId },
      select: { adminAcknowledgedAt: true, updatedAt: true },
    });
    invalidateReportsCache();

    return Response.json({
      ok: true,
      adminAcknowledgedAt: fresh?.adminAcknowledgedAt ?? ackTime,
      updatedAt: fresh?.updatedAt,
      wasAlreadyAcked: false,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
