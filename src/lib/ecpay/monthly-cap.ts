/**
 * Monthly cap guardrail for ECPay receipts.
 *
 * ECPay's 個人戶 (personal account) caps out at NT$300k/month. We sit at 280k
 * to give ourselves headroom for in-flight transactions settling near month-end.
 * When exceeded, callers are pushed back to Tier A (bank transfer + last-five).
 */

import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/utils/errors";
import { TIMEZONE } from "@/lib/utils/constants";
import { ECPAY_MONTHLY_CAP_TWD } from "@/lib/utils/constants";

/** Get Taipei-local [monthStart, nextMonthStart) bounds as UTC Date instances. */
function taipeiMonthBounds(now: Date): { start: Date; end: Date } {
  // Extract Taipei-local year + month from `now`.
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);
  const y = Number(parts.find((p) => p.type === "year")?.value);
  const m = Number(parts.find((p) => p.type === "month")?.value); // 1-12

  // Taipei is UTC+8 with no DST. Taipei 00:00 of day 1 = UTC prior-day 16:00.
  // Build "YYYY-MM-01T00:00:00+08:00" and let Date parse it.
  const pad = (n: number) => n.toString().padStart(2, "0");
  const start = new Date(`${y}-${pad(m)}-01T00:00:00+08:00`);
  const nextY = m === 12 ? y + 1 : y;
  const nextM = m === 12 ? 1 : m + 1;
  const end = new Date(`${nextY}-${pad(nextM)}-01T00:00:00+08:00`);
  return { start, end };
}

/**
 * SUM of ECPayOrder.amount where status === PAID and createdAt within the
 * current Taipei-calendar month. Used as the running total against the cap.
 */
export async function getMonthlyReceivedTotal(
  tenantId: string,
  now: Date = new Date()
): Promise<number> {
  const { start, end } = taipeiMonthBounds(now);
  const agg = await prisma.eCPayOrder.aggregate({
    where: {
      tenantId,
      status: "PAID",
      createdAt: { gte: start, lt: end },
    },
    _sum: { amount: true },
  });
  return agg._sum.amount ?? 0;
}

/**
 * Throw MONTHLY_CAP_EXCEEDED if adding `nextAmount` to the current month's
 * received total would push us over ECPAY_MONTHLY_CAP_TWD.
 */
export async function assertWithinMonthlyCap(
  tenantId: string,
  nextAmount: number
): Promise<void> {
  const current = await getMonthlyReceivedTotal(tenantId);
  if (current + nextAmount > ECPAY_MONTHLY_CAP_TWD) {
    throw new AppError(
      "本月綠界收款額度接近上限，請改用轉帳+末五碼方式",
      409,
      "MONTHLY_CAP_EXCEEDED"
    );
  }
}
