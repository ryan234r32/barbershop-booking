/**
 * V3.7 Tier 1.10 — 月初公休提醒 cron.
 *
 * Why: per autoplan consensus D-G + plan §0a E-G — 強制 modal 對老闆 hostile，
 * 改成「dashboard banner + monthly setup task」。這個 cron 是 setup task 的提醒
 * 觸發點：每月 1 日 20:00 Taipei (12 UTC) 推 LINE 給老闆「該設下下月公休囉」。
 *
 * Logic:
 *   1. Compute TARGET_MONTH = approx +60 days from today (預約窗 45d + buffer)
 *   2. Count Holidays in that month for default tenant
 *   3. If 0 holidays set → push reminder to admin LINE
 *   4. If holidays already set → silent (老闆已記得)
 *
 * Schedule: `0 12 1 * *` (UTC) = monthly on 1st @ 20:00 Taipei.
 *
 * Idempotency: cron may fire twice (Vercel retry). Both fires send same message
 * = at worst老闆 收兩則一樣的提醒。可接受 (vs 漏發風險更大)。
 *
 * Future: 後續 Tier 1.3 加 dashboard banner 後，cron 也應該在 DB 開 banner
 * record，避免雙通路噪音。當前 v1 純 LINE push。
 */
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getLineClient } from "@/lib/line/client";
import { verifyCronSecret } from "@/lib/utils/cron-auth";
import { logger } from "@/lib/utils/logger";

export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const adminLineUserId = process.env.ADMIN_LINE_USER_ID;
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!adminLineUserId || !tenantId) {
      logger.warn("closure-reminder-monthly skipped — missing env", "cron", {
        hasAdminLine: !!adminLineUserId,
        hasTenant: !!tenantId,
      });
      return Response.json({ ok: true, skipped: true, reason: "missing env" });
    }

    // Compute target month = today + ~60 days (預約窗 45d + 2 週 buffer)
    const today = new Date();
    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() + 60);
    const targetYear = targetDate.getFullYear();
    const targetMonth = targetDate.getMonth() + 1; // JS month 0-indexed
    const monthStart = new Date(Date.UTC(targetYear, targetMonth - 1, 1));
    const monthEnd = new Date(Date.UTC(targetYear, targetMonth, 1));

    // Count holidays already set for target month
    const existingCount = await prisma.holiday.count({
      where: {
        tenantId,
        date: { gte: monthStart, lt: monthEnd },
      },
    });

    if (existingCount > 0) {
      logger.info("closure-reminder-monthly silent — holidays already set", "cron", {
        targetMonth: `${targetYear}-${targetMonth}`,
        existingCount,
      });
      return Response.json({ ok: true, skipped: true, reason: "already set", existingCount });
    }

    // No holidays for target month → push reminder
    const monthLabel = `${targetYear} 年 ${targetMonth} 月`;
    const lineClient = getLineClient();
    await lineClient.pushMessage(adminLineUserId, {
      type: "text",
      text:
        `提醒：${monthLabel} 還沒設定公休／特殊休息日喔～\n\n` +
        `為避免顧客約到你不在的時段（預約窗 45 天 + 2 週 buffer），建議現在就到「店鋪設定 → 公休管理」設一下。\n\n` +
        `如果這個月沒有特別公休，按一下「沿用週期性公休」也能消掉這則提醒。`,
    });

    logger.info("closure-reminder-monthly pushed", "cron", {
      targetMonth: `${targetYear}-${targetMonth}`,
      adminLineUserId,
    });

    return Response.json({
      ok: true,
      pushed: true,
      targetMonth: `${targetYear}-${targetMonth}`,
    });
  } catch (err) {
    logger.error("closure-reminder-monthly failed", err, "cron");
    return Response.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
