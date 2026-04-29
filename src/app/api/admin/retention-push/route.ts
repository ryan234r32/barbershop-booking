/**
 * V3.6 §14.6 — admin monitoring widget data.
 *
 * GET /api/admin/retention-push
 *   → today's planned + sent counts grouped by service / stage
 *   + 7-day SENT history for trend
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminFromCookie } from "@/lib/auth/jwt";
import { errorResponse, UnauthorizedError } from "@/lib/utils/errors";
import { todayInTaipei } from "@/lib/utils/time";

export async function GET(request: NextRequest) {
  try {
    const admin = await getAdminFromCookie(request);
    if (!admin) throw new UnauthorizedError();

    const todayIso = todayInTaipei();
    const [y, m, d] = todayIso.split("-").map(Number);
    const todayStart = new Date(Date.UTC(y, m - 1, d, -8, 0, 0));
    const todayEnd = new Date(Date.UTC(y, m - 1, d, 15, 59, 59, 999));
    const weekAgo = new Date(todayStart.getTime() - 7 * 24 * 3600 * 1000);

    const [today, week] = await Promise.all([
      prisma.pushSchedule.findMany({
        where: {
          tenantId: admin.tenantId,
          createdAt: { gte: todayStart, lte: todayEnd },
        },
        select: { serviceCategory: true, stage: true, status: true, sentAt: true },
      }),
      prisma.pushSchedule.findMany({
        where: {
          tenantId: admin.tenantId,
          status: "SENT",
          sentAt: { gte: weekAgo },
        },
        select: { sentAt: true, stage: true, convertedAt: true },
      }),
    ]);

    // Aggregate today by stage × service
    type Bucket = { sent: number; queued: number; failed: number; skipped: number };
    const empty = (): Bucket => ({ sent: 0, queued: 0, failed: 0, skipped: 0 });
    const todayGrouped: Record<string, Record<string, Bucket>> = {
      SOFT_REMINDER: { 剪髮: empty(), 染髮: empty(), 燙髮: empty() },
      DISCOUNT_10: { 剪髮: empty(), 染髮: empty(), 燙髮: empty() },
      WINBACK: { 剪髮: empty(), 染髮: empty(), 燙髮: empty() },
    };
    for (const t of today) {
      const stageKey = t.stage as keyof typeof todayGrouped;
      const svc = t.serviceCategory as "剪髮" | "染髮" | "燙髮";
      if (!todayGrouped[stageKey]?.[svc]) continue;
      if (t.status === "SENT") todayGrouped[stageKey][svc].sent++;
      else if (t.status === "QUEUED") todayGrouped[stageKey][svc].queued++;
      else if (t.status === "FAILED") todayGrouped[stageKey][svc].failed++;
      else if (t.status === "SKIPPED") todayGrouped[stageKey][svc].skipped++;
    }

    // 7-day daily totals
    const daily: Array<{ date: string; sent: number; converted: number }> = [];
    for (let i = 6; i >= 0; i--) {
      const dt = new Date(todayStart.getTime() - i * 24 * 3600 * 1000);
      const iso = dt.toLocaleDateString("en-CA", { timeZone: "Asia/Taipei" });
      const sent = week.filter(
        (w) =>
          w.sentAt &&
          w.sentAt.toLocaleDateString("en-CA", { timeZone: "Asia/Taipei" }) === iso,
      ).length;
      const converted = week.filter(
        (w) =>
          w.sentAt &&
          w.convertedAt &&
          w.sentAt.toLocaleDateString("en-CA", { timeZone: "Asia/Taipei" }) === iso,
      ).length;
      daily.push({ date: iso, sent, converted });
    }

    return Response.json({
      today: todayGrouped,
      todayTotal: today.length,
      todaySent: today.filter((t) => t.status === "SENT").length,
      daily,
      conversionRate7d:
        week.length > 0
          ? Math.round((week.filter((w) => w.convertedAt).length / week.length) * 1000) / 10
          : 0,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
