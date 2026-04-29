/**
 * V3.6 §5.2 — daily 對帳 endpoint.
 *
 * PATCH /api/bookings/[id]/settle  → set settledAt = now()
 * DELETE /api/bookings/[id]/settle → clear settledAt (revert)
 *
 * Used by the daily view "確認" button. Idempotent — re-confirming a booking
 * returns the same timestamp without DB write. Cross-tenant safe via
 * adminUser.tenantId.
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAdminFromCookie } from "@/lib/auth/jwt";
import { errorResponse, UnauthorizedError } from "@/lib/utils/errors";

type RouteParams = { params: Promise<{ id: string }> };

const bodySchema = z
  .object({ expectedUpdatedAt: z.string().datetime().optional() })
  .optional();

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const admin = await getAdminFromCookie(request);
    if (!admin) throw new UnauthorizedError();

    const { id } = await params;
    const body = await request.json().catch(() => null);
    const parsed = body ? bodySchema.parse(body) : undefined;
    const expectedUpdatedAt = parsed?.expectedUpdatedAt;

    const booking = await prisma.booking.findFirst({
      where: { id, tenantId: admin.tenantId },
      select: { id: true, settledAt: true, updatedAt: true },
    });
    if (!booking) {
      return Response.json({ error: "Booking not found" }, { status: 404 });
    }

    // Idempotent
    if (booking.settledAt) {
      return Response.json({
        ok: true,
        settledAt: booking.settledAt,
        updatedAt: booking.updatedAt,
        wasAlreadySettled: true,
      });
    }

    const settleTime = new Date();
    const result = await prisma.booking.updateMany({
      where: {
        id,
        tenantId: admin.tenantId,
        settledAt: null,
        ...(expectedUpdatedAt
          ? { updatedAt: new Date(expectedUpdatedAt) }
          : { updatedAt: booking.updatedAt }),
      },
      data: { settledAt: settleTime },
    });

    if (result.count === 0) {
      const fresh = await prisma.booking.findFirst({
        where: { id, tenantId: admin.tenantId },
        select: { settledAt: true, updatedAt: true },
      });
      return Response.json(
        {
          error: "stale_write",
          message: "此預約已更新，請重新整理頁面",
          current: fresh,
        },
        { status: 409 },
      );
    }

    const fresh = await prisma.booking.findFirst({
      where: { id, tenantId: admin.tenantId },
      select: { settledAt: true, updatedAt: true },
    });

    return Response.json({
      ok: true,
      settledAt: fresh?.settledAt ?? settleTime,
      updatedAt: fresh?.updatedAt,
      wasAlreadySettled: false,
    });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const admin = await getAdminFromCookie(request);
    if (!admin) throw new UnauthorizedError();

    const { id } = await params;
    const result = await prisma.booking.updateMany({
      where: { id, tenantId: admin.tenantId, settledAt: { not: null } },
      data: { settledAt: null },
    });
    if (result.count === 0) {
      return Response.json({ error: "Booking not found or not settled" }, { status: 404 });
    }
    return Response.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
