import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAdminFromCookie } from "@/lib/auth/jwt";
import { errorResponse, UnauthorizedError } from "@/lib/utils/errors";
import { invalidateReportsCache } from "@/lib/cache/invalidate";

type RouteParams = { params: Promise<{ id: string }> };

const checkinSchema = z
  .object({
    /**
     * V3.5 夯客流程：admin 手動切換已報到狀態。
     * Behavior is a toggle:
     *   - NULL → now()       (mark as checked-in)
     *   - NOT NULL → NULL    (un-checkin / 改回尚未到來)
     *
     * If body is empty we infer from the current row state. The optional
     * `desired` field is for clients that want to be explicit (e.g. retries
     * where a stale toggle could flip the wrong way).
     */
    desired: z.enum(["checked_in", "not_yet"]).optional(),
    /**
     * Optimistic-concurrency token — same pattern as /acknowledge. Prevents
     * two devices from clobbering each other when the row was rescheduled
     * or otherwise mutated since the client read it.
     */
    expectedUpdatedAt: z.string().datetime().optional(),
  })
  .optional();

/**
 * PATCH /api/bookings/[id]/checkin — V3.5 admin toggles 已報到 state.
 *
 * Toggle semantics (default behavior, no body required):
 *   checkedInAt NULL      → now()        (尚未到來 → 已報到)
 *   checkedInAt NOT NULL  → NULL         (已報到 → 尚未到來)
 *
 * Allowed only when status = CONFIRMED. Cancelled / no-show / completed
 * bookings cannot be checked in (move to a different state first).
 *
 * Idempotent if the desired state already matches the current row.
 *
 * Cross-tenant safe: WHERE clause filters by admin.tenantId.
 * Stale-write guard: optional `expectedUpdatedAt` returns 409 on mismatch.
 *
 * Admin-only (no LIFF path — customers cannot self-checkin).
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const admin = await getAdminFromCookie(request);
    if (!admin) throw new UnauthorizedError();

    const { id } = await params;
    const body = await request.json().catch(() => null);
    const parsed: z.infer<typeof checkinSchema> = body ? checkinSchema.parse(body) : undefined;
    const desired = parsed?.desired;
    const expectedUpdatedAt = parsed?.expectedUpdatedAt;

    const booking = await prisma.booking.findFirst({
      where: { id, tenantId: admin.tenantId },
      select: {
        id: true,
        status: true,
        checkedInAt: true,
        updatedAt: true,
      },
    });
    if (!booking) {
      return Response.json({ error: "Booking not found" }, { status: 404 });
    }

    if (booking.status !== "CONFIRMED") {
      return Response.json(
        {
          error: "invalid_status",
          message: `只能對「已確認」的預約進行報到（目前狀態：${booking.status}）`,
        },
        { status: 400 },
      );
    }

    // Compute next state. If client said `desired`, honor it. Otherwise toggle.
    const isCurrentlyCheckedIn = booking.checkedInAt !== null;
    const shouldCheckIn =
      desired === "checked_in" ? true : desired === "not_yet" ? false : !isCurrentlyCheckedIn;

    // Idempotent: no DB write if desired state already matches.
    if (shouldCheckIn === isCurrentlyCheckedIn) {
      return Response.json({
        ok: true,
        checkedInAt: booking.checkedInAt,
        updatedAt: booking.updatedAt,
        wasNoOp: true,
      });
    }

    const nextCheckedInAt = shouldCheckIn ? new Date() : null;

    // Conditional update — same OCC pattern as /acknowledge to avoid TOCTOU
    // between the read above and the write here.
    const updateResult = await prisma.booking.updateMany({
      where: {
        id,
        tenantId: admin.tenantId,
        ...(expectedUpdatedAt
          ? { updatedAt: new Date(expectedUpdatedAt) }
          : { updatedAt: booking.updatedAt }),
      },
      data: { checkedInAt: nextCheckedInAt },
    });

    if (updateResult.count === 0) {
      const fresh = await prisma.booking.findFirst({
        where: { id, tenantId: admin.tenantId },
        select: { checkedInAt: true, updatedAt: true },
      });
      return Response.json(
        {
          error: "stale_write",
          message: "此預約已更新，請重新整理後再試",
          current: fresh,
        },
        { status: 409 },
      );
    }

    const fresh = await prisma.booking.findFirst({
      where: { id, tenantId: admin.tenantId },
      select: { checkedInAt: true, updatedAt: true },
    });
    invalidateReportsCache();

    return Response.json({
      ok: true,
      checkedInAt: fresh?.checkedInAt ?? nextCheckedInAt,
      updatedAt: fresh?.updatedAt,
      wasNoOp: false,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
