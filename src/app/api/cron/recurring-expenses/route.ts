/**
 * V3.7 §D — Recurring expense materialiser.
 *
 * Schedule: Vercel Cron `30 16 * * *` (UTC) = 00:30 Taipei daily.
 *
 * For each tenant: walk active ExpenseRecurringRule rows where
 *   `dayOfMonth === todayTaipei.day && (endDate ?? +∞) >= today`
 *   AND `(lastMaterialisedAt ?? -∞) < today` (idempotent guard).
 * Insert one Expense row per matching rule. Last day of month is handled by
 * coercing `dayOfMonth=31` → "the last day of *this* month" so February + 30-day
 * months don't silently skip rent.
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyCronSecret } from "@/lib/utils/cron-auth";
import { todayInTaipei } from "@/lib/utils/time";
import { logger } from "@/lib/utils/logger";

export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const todayStr = todayInTaipei();
  const todayDate = new Date(`${todayStr}T00:00:00.000Z`);
  const [year, month, day] = todayStr.split("-").map((s) => parseInt(s, 10));
  const lastDayOfThisMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const isLastDayOfMonth = day === lastDayOfThisMonth;

  // Find all rules whose dayOfMonth matches today (or whose >= 28 day exceeds
  // this month and today is the last calendar day — so 31 fires on Feb 28/29).
  const rules = await prisma.expenseRecurringRule.findMany({
    where: {
      active: true,
      startDate: { lte: todayDate },
      OR: [
        { dayOfMonth: day },
        ...(isLastDayOfMonth ? [{ dayOfMonth: { gt: lastDayOfThisMonth } }] : []),
      ],
    },
  });

  // Apply endDate + lastMaterialisedAt filters in JS so we can short-circuit
  // and report skipped reasons without three extra DB roundtrips.
  let created = 0;
  let skippedAlready = 0;
  let skippedExpired = 0;

  for (const rule of rules) {
    if (rule.endDate && rule.endDate < todayDate) {
      skippedExpired++;
      continue;
    }
    if (rule.lastMaterialisedAt && rule.lastMaterialisedAt >= todayDate) {
      skippedAlready++;
      continue;
    }

    try {
      await prisma.$transaction([
        prisma.expense.create({
          data: {
            tenantId: rule.tenantId,
            date: todayDate,
            amount: rule.amount,
            category: rule.category,
            type: rule.type,
            paidMethod: rule.paidMethod,
            notes: rule.notes,
            recurringRuleId: rule.id,
          },
        }),
        prisma.expenseRecurringRule.update({
          where: { id: rule.id },
          data: { lastMaterialisedAt: todayDate },
        }),
      ]);
      created++;
    } catch (err) {
      logger.error("recurring-expense materialisation failed", {
        ruleId: rule.id,
        tenantId: rule.tenantId,
        err: err instanceof Error ? err.message : String(err),
      });
    }
  }

  logger.info("recurring-expenses cron complete", {
    today: todayStr,
    rulesEvaluated: rules.length,
    created,
    skippedAlready,
    skippedExpired,
  });

  return Response.json({
    ok: true,
    today: todayStr,
    rulesEvaluated: rules.length,
    created,
    skippedAlready,
    skippedExpired,
  });
}
