/**
 * V3.6 §5.2 — 結班 endpoint.
 *
 * POST /api/admin/day-close { date: "YYYY-MM-DD" }
 *   → writes Tenant.dayClosedAt[date] = ISO timestamp
 *   → daily view UI then renders read-only with "已結班 · 補登從 ⋯ 進入"
 *
 * DELETE /api/admin/day-close { date: "YYYY-MM-DD" }
 *   → un-locks (clears the date key); for "補登" path
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAdminFromCookie } from "@/lib/auth/jwt";
import { errorResponse, UnauthorizedError } from "@/lib/utils/errors";

const bodySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD"),
});

export async function POST(request: NextRequest) {
  try {
    const admin = await getAdminFromCookie(request);
    if (!admin) throw new UnauthorizedError();

    const body = await request.json();
    const { date } = bodySchema.parse(body);

    const tenant = await prisma.tenant.findUnique({
      where: { id: admin.tenantId },
      select: { dayClosedAt: true },
    });
    const map = ((tenant?.dayClosedAt as Record<string, string> | null) ?? {});
    map[date] = new Date().toISOString();

    await prisma.tenant.update({
      where: { id: admin.tenantId },
      data: { dayClosedAt: map },
    });

    return Response.json({ ok: true, date, closedAt: map[date] });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const admin = await getAdminFromCookie(request);
    if (!admin) throw new UnauthorizedError();

    const body = await request.json();
    const { date } = bodySchema.parse(body);

    const tenant = await prisma.tenant.findUnique({
      where: { id: admin.tenantId },
      select: { dayClosedAt: true },
    });
    const map = ((tenant?.dayClosedAt as Record<string, string> | null) ?? {});
    if (!(date in map)) {
      return Response.json({ ok: true, alreadyOpen: true });
    }
    delete map[date];
    await prisma.tenant.update({
      where: { id: admin.tenantId },
      data: { dayClosedAt: map },
    });
    return Response.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
