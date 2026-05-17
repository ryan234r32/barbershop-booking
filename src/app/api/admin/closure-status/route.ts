/**
 * V3.7 Tier 1.3 minimal — 公休狀態 banner data source.
 *
 * 老闆痛點：預約窗 45 天，老闆可能忘記設下下月特殊公休（家庭聚餐、母親節等），
 * 結果客人約到他不在的時段。Tier 1.10 cron 月初提醒一次，但這個 endpoint 提供
 * dashboard 隨時可查的「未設月份」資訊，前端用它顯示 banner。
 *
 * Logic:
 *   - 取今日 + [30, 60] 天兩個月份（含當月、下月、下下月）
 *   - 各 month count holidays
 *   - 回傳 0 holidays 的月份清單
 *
 * Read-only, admin only。
 */
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminFromCookie } from "@/lib/auth/jwt";
import { errorResponse, UnauthorizedError } from "@/lib/utils/errors";

interface MonthStatus {
  year: number;
  month: number; // 1-12
  label: string; // "2026 年 8 月"
  holidayCount: number;
  daysUntilMonthStart: number;
}

export async function GET(request: NextRequest) {
  try {
    const admin = await getAdminFromCookie(request);
    if (!admin) throw new UnauthorizedError();

    // Use Taipei timezone for "today".
    const today = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Taipei" }));
    today.setHours(0, 0, 0, 0);

    // Check current month + next 2 months (covers 45-day booking window + buffer).
    const months: MonthStatus[] = [];
    for (let offset = 0; offset <= 2; offset += 1) {
      const target = new Date(today.getFullYear(), today.getMonth() + offset, 1);
      const year = target.getFullYear();
      const month = target.getMonth() + 1;
      const start = new Date(Date.UTC(year, month - 1, 1));
      const end = new Date(Date.UTC(year, month, 1));

      const holidayCount = await prisma.holiday.count({
        where: { tenantId: admin.tenantId, date: { gte: start, lt: end } },
      });

      const daysUntilMonthStart = Math.max(
        0,
        Math.floor((target.getTime() - today.getTime()) / (24 * 60 * 60 * 1000)),
      );

      months.push({
        year,
        month,
        label: `${year} 年 ${month} 月`,
        holidayCount,
        daysUntilMonthStart,
      });
    }

    // "需提醒" = 未設特殊公休 (count 0) AND 月初還沒到 + 距月初 ≤ 60 天（在預約窗範圍內）
    const monthsNeedingAttention = months.filter(
      (m) => m.holidayCount === 0 && m.daysUntilMonthStart > 0 && m.daysUntilMonthStart <= 60,
    );

    return Response.json({
      months,
      needsAttention: monthsNeedingAttention,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
