import { prisma } from "@/lib/prisma";
import { errorResponse } from "@/lib/utils/errors";
import { MAX_ADVANCE_DAYS } from "@/lib/utils/constants";
import { todayInTaipei, addDaysToISO } from "@/lib/utils/time";

/**
 * GET /api/business-config — 客戶端日曆唯一資料來源（無需登入）。
 *
 * 回傳：
 *   - maxAdvanceDays: 客戶最遠可預約幾天（目前 45 天）
 *   - closedWeekdays: 每週固定公休的星期數陣列（0=Sun..6=Sat），
 *     由 BusinessHours.isOpen=false 推導。例：每週一二三公休 → [1,2,3]
 *   - holidays: 從今天到 today+MAX_ADVANCE_DAYS 之間的個別假日，YYYY-MM-DD 陣列
 *
 * 動機：消除「LIFF 日曆寫死週一公休 / 寫死 30 天」與資料庫脫節的問題。
 * 客戶端只要呼叫這支，就能反映 admin 在 /settings 改的所有公休設定。
 */
export async function GET() {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return Response.json({ error: "DEFAULT_TENANT_ID not configured" }, { status: 500 });
    }

    const today = todayInTaipei();
    const maxDate = addDaysToISO(today, MAX_ADVANCE_DAYS);

    const [businessHours, holidayRows] = await Promise.all([
      prisma.businessHours.findMany({
        where: { tenantId },
        select: { dayOfWeek: true, isOpen: true },
      }),
      prisma.holiday.findMany({
        where: {
          tenantId,
          date: {
            gte: new Date(today + "T00:00:00.000Z"),
            lte: new Date(maxDate + "T23:59:59.999Z"),
          },
        },
        select: { date: true, reason: true, startTime: true, endTime: true },
        orderBy: { date: "asc" },
      }),
    ]);

    const closedWeekdays = businessHours
      .filter((bh) => !bh.isOpen)
      .map((bh) => bh.dayOfWeek)
      .sort();

    // V3.7 P1-3: only full-day closures are returned in `holidays` (LIFF calendar
    // disables those dates entirely). Partial-day closures live in
    // `partialClosures` — LIFF keeps the date selectable, slot list reflects the
    // blocked hours via /api/slots.
    const holidays = holidayRows
      .filter((h) => !h.startTime && !h.endTime)
      .map((h) => ({
        date: h.date.toISOString().slice(0, 10),
        reason: h.reason,
      }));
    const partialClosures = holidayRows
      .filter((h) => h.startTime && h.endTime)
      .map((h) => ({
        date: h.date.toISOString().slice(0, 10),
        startTime: h.startTime,
        endTime: h.endTime,
        reason: h.reason,
      }));

    return Response.json({
      maxAdvanceDays: MAX_ADVANCE_DAYS,
      closedWeekdays,
      holidays,
      partialClosures,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
