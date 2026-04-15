import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { errorResponse } from "@/lib/utils/errors";
import { getAdminFromCookie } from "@/lib/auth/jwt";
import { getMonthlyReceivedTotal } from "@/lib/ecpay/monthly-cap";
import { ECPAY_MONTHLY_CAP_TWD } from "@/lib/utils/constants";
import { TIMEZONE } from "@/lib/utils/constants";

function taipeiMonthBounds(now: Date): { start: Date; end: Date } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);
  const y = Number(parts.find((p) => p.type === "year")?.value);
  const m = Number(parts.find((p) => p.type === "month")?.value);
  const pad = (n: number) => n.toString().padStart(2, "0");
  const start = new Date(`${y}-${pad(m)}-01T00:00:00+08:00`);
  const nextY = m === 12 ? y + 1 : y;
  const nextM = m === 12 ? 1 : m + 1;
  const end = new Date(`${nextY}-${pad(nextM)}-01T00:00:00+08:00`);
  return { start, end };
}

/**
 * GET /api/admin/ecpay/monthly-summary
 *
 * Returns the running ECPay "已入帳" total for the current Taipei-calendar month
 * alongside the NT$280k guardrail cap (Eng F15). Powers the summary card on the
 * admin /payments ATM tab.
 *
 * Response: { count, total, cap, percentage }
 *   - count: number of PAID ECPayOrders created this month
 *   - total: NT$ sum of those orders
 *   - cap:   ECPAY_MONTHLY_CAP_TWD (280_000)
 *   - percentage: 0-100+ (int, may exceed 100 if cap breached by near-boundary timing)
 */
export async function GET(request: NextRequest) {
  try {
    const admin = await getAdminFromCookie(request);
    if (!admin) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { start, end } = taipeiMonthBounds(new Date());
    const [total, count] = await Promise.all([
      getMonthlyReceivedTotal(admin.tenantId),
      prisma.eCPayOrder.count({
        where: {
          tenantId: admin.tenantId,
          status: "PAID",
          createdAt: { gte: start, lt: end },
        },
      }),
    ]);

    const percentage = Math.min(
      999,
      Math.round((total / ECPAY_MONTHLY_CAP_TWD) * 100)
    );

    return Response.json({
      count,
      total,
      cap: ECPAY_MONTHLY_CAP_TWD,
      percentage,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
