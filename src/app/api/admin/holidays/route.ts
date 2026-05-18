import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { errorResponse, AppError } from "@/lib/utils/errors";
import { getAdminFromCookie } from "@/lib/auth/jwt";

/// V3.7 P1-3 — Holiday now supports optional partial-day closure
/// (老闆固定週四 11-13 健身 + 偶發整天店休 use the same model).
/// Both startTime+endTime missing → full-day. Half-supplied → 400.
const upsertSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:00$/).optional(),
  endTime: z.string().regex(/^\d{2}:00$/).optional(),
  reason: z.string().max(120).optional(),
});

/** GET /api/admin/holidays — list holidays */
export async function GET(request: NextRequest) {
  try {
    const admin = await getAdminFromCookie(request);
    if (!admin) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const holidays = await prisma.holiday.findMany({
      where: { tenantId: admin.tenantId },
      orderBy: { date: "asc" },
    });

    return Response.json({ holidays });
  } catch (error) {
    return errorResponse(error);
  }
}

/** POST /api/admin/holidays — create / replace a holiday for a date. */
export async function POST(request: NextRequest) {
  try {
    const admin = await getAdminFromCookie(request);
    if (!admin) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const input = upsertSchema.parse(body);
    const dateObj = new Date(input.date + "T00:00:00.000Z");

    // Half-set time range is meaningless — full-day closures use both NULL.
    const hasStart = !!input.startTime;
    const hasEnd = !!input.endTime;
    if (hasStart !== hasEnd) {
      throw new AppError("partial closure 必須同時提供 startTime 與 endTime", 400, "invalid_partial");
    }
    if (hasStart && hasEnd && parseInt(input.startTime!) >= parseInt(input.endTime!)) {
      throw new AppError("startTime 必須早於 endTime", 400, "invalid_time_range");
    }

    // Upsert by (tenantId, date) so re-setting the same day just updates the range.
    const holiday = await prisma.holiday.upsert({
      where: { tenantId_date: { tenantId: admin.tenantId, date: dateObj } },
      create: {
        tenantId: admin.tenantId,
        date: dateObj,
        startTime: input.startTime ?? null,
        endTime: input.endTime ?? null,
        reason: input.reason ?? null,
      },
      update: {
        startTime: input.startTime ?? null,
        endTime: input.endTime ?? null,
        reason: input.reason ?? null,
      },
    });

    return Response.json({ holiday }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

/** DELETE /api/admin/holidays?id=... or ?date=YYYY-MM-DD */
export async function DELETE(request: NextRequest) {
  try {
    const admin = await getAdminFromCookie(request);
    if (!admin) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const id = searchParams.get("id");
    const date = searchParams.get("date");

    if (id) {
      await prisma.holiday.deleteMany({
        where: { id, tenantId: admin.tenantId },
      });
    } else if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      await prisma.holiday.deleteMany({
        where: { tenantId: admin.tenantId, date: new Date(date + "T00:00:00.000Z") },
      });
    } else {
      return Response.json({ error: "Missing holiday id or date" }, { status: 400 });
    }

    return Response.json({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}
