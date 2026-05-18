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
    const force = body?.force === true; // 客戶端確認過衝突就帶 force=true

    // Half-set time range is meaningless — full-day closures use both NULL.
    const hasStart = !!input.startTime;
    const hasEnd = !!input.endTime;
    if (hasStart !== hasEnd) {
      throw new AppError("partial closure 必須同時提供 startTime 與 endTime", 400, "invalid_partial");
    }
    if (hasStart && hasEnd && parseInt(input.startTime!) >= parseInt(input.endTime!)) {
      throw new AppError("startTime 必須早於 endTime", 400, "invalid_time_range");
    }

    // V3.7 P2 (5/18 老闆反饋) — 設公休前先掃描該日期是否有 CONFIRMED 預約衝突。
    // 全天公休 → 任何 CONFIRMED booking 都算衝突。
    // 部分時段 → 只看 startTime ∈ [startTime, endTime) 的 booking 算衝突。
    // 找到衝突且未帶 force=true → 422 回傳衝突清單，前端確認後重送帶 force=true。
    const conflictingBookings = await prisma.booking.findMany({
      where: {
        tenantId: admin.tenantId,
        date: dateObj,
        status: "CONFIRMED",
      },
      select: {
        id: true,
        startTime: true,
        endTime: true,
        user: { select: { displayName: true, lineUserId: true, phone: true } },
        service: { select: { name: true } },
      },
      orderBy: { startTime: "asc" },
    });
    const conflicts = conflictingBookings.filter((b) => {
      if (!hasStart || !hasEnd) return true; // 整天公休 → 全部衝突
      const bStart = parseInt(b.startTime);
      const bEnd = parseInt(b.endTime);
      const cStart = parseInt(input.startTime!);
      const cEnd = parseInt(input.endTime!);
      // 重疊條件：兩個區間有交集
      return bStart < cEnd && cStart < bEnd;
    });

    if (conflicts.length > 0 && !force) {
      return Response.json(
        {
          requiresConfirmation: true,
          conflicts: conflicts.map((b) => ({
            id: b.id,
            startTime: b.startTime,
            endTime: b.endTime,
            customerName: b.user.displayName ?? "未綁定客戶",
            customerPhone: b.user.phone,
            customerLineUserId: b.user.lineUserId,
            serviceName: b.service.name,
          })),
          message: `此日期有 ${conflicts.length} 筆已預約，請先處理（改期 / 取消 / 通知）後再設定公休。`,
        },
        { status: 422 },
      );
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

    return Response.json(
      {
        holiday,
        ...(conflicts.length > 0
          ? { acknowledgedConflicts: conflicts.length }
          : {}),
      },
      { status: 201 },
    );
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
