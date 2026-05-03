import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getLineClient } from "@/lib/line/client";
import { dailySettlementMessage } from "@/lib/line/messages";
import { verifyCronSecret } from "@/lib/utils/cron-auth";
import { todayInTaipei } from "@/lib/utils/time";
import { logger } from "@/lib/utils/logger";

/** GET /api/cron/daily-settlement — push daily settlement to admin at 20:30 Taipei */
export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const adminLineUserId = process.env.ADMIN_LINE_USER_ID;
    if (!adminLineUserId) {
      return Response.json({ success: true, skipped: true, reason: "ADMIN_LINE_USER_ID not set" });
    }

    // todayInTaipei() avoids the nowTaipei() UTC-server day-shift bug.
    const todayStr = todayInTaipei();
    const todayDate = new Date(todayStr + "T00:00:00.000Z");

    // Get all tenants (for multi-tenant support)
    const tenants = await prisma.tenant.findMany({ select: { id: true, businessName: true } });

    let totalSent = 0;

    for (const tenant of tenants) {
      const [bookings, expenses] = await Promise.all([
        prisma.booking.findMany({
          where: { tenantId: tenant.id, date: todayDate },
          include: {
            service: { select: { name: true, price: true } },
            user: { select: { displayName: true } },
          },
          orderBy: { startTime: "asc" },
        }),
        prisma.expense.findMany({
          where: { tenantId: tenant.id, date: todayDate },
          select: { amount: true },
        }),
      ]);

      if (bookings.length === 0 && expenses.length === 0) continue;

      const completed = bookings.filter((b) => b.status === "COMPLETED");
      const noShow = bookings.filter((b) => b.status === "NO_SHOW");
      const unresolved = bookings.filter((b) => b.status === "CONFIRMED");
      const revenue = completed.reduce((sum, b) => sum + b.service.price, 0);
      const expenseTotal = expenses.reduce((s, e) => s + e.amount, 0);

      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://barbershop-booking-swart.vercel.app";

      const message = dailySettlementMessage({
        date: todayStr,
        bookings: bookings.map((b) => ({
          customerName: b.user.displayName || "未知",
          serviceName: b.service.name,
          startTime: b.startTime,
          status: b.status,
          price: b.service.price,
        })),
        summary: {
          total: bookings.length,
          completed: completed.length,
          noShow: noShow.length,
          unresolved: unresolved.length,
          revenue,
          // V3.7 §G — surface expenses + net profit in the daily LINE message.
          expenseCount: expenses.length,
          expenseTotal,
          netProfit: revenue - expenseTotal,
        },
        // V3.7 §G — deep-link to 財務/每日 (the new reconciliation hub) instead
        // of the legacy /dashboard page. Uses ?view=daily&date= so a tap lands
        // directly on today's reconciliation panel.
        dashboardUrl: `${baseUrl}/reports?view=daily&date=${todayStr}`,
      });

      try {
        const lineClient = getLineClient();
        await lineClient.pushMessage(adminLineUserId, message);
        totalSent++;
      } catch (err) {
        logger.error("Failed to push daily settlement", err, "cron");
      }
    }

    return Response.json({ success: true, sent: totalSent });
  } catch (error) {
    logger.error("Daily settlement cron failed", error, "cron");
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}
