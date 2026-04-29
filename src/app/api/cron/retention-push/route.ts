/**
 * V3.6 Phase H — daily retention push cron.
 *
 * Triggered every day at 02:00 UTC (10:00 Taipei). For each tenant, iterates
 * the 3 service categories × 3 stages and pushes LINE messages to qualifying
 * customers. Anti-spam guarded: cooldown / opt-out / daily limit / send window.
 *
 * Plan §14.4 / §14.5
 *
 * ⚠️  NOT YET WIRED IN vercel.json — pending owner approval of plan §14.8
 *     (B1-B6: discount %, loyal-customer skip, perm n=8 sample size, hair-care
 *     opt-out, send window, daily cap). Manual invocation works (admin can hit
 *     this endpoint with the cron secret); the schedule is intentionally absent
 *     from vercel.json to prevent unsolicited LINE pushes to real customers.
 *     To enable: add `{ path: "/api/cron/retention-push", schedule: "0 2 * * *" }`
 *     to vercel.json crons array.
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyCronSecret } from "@/lib/utils/cron-auth";
import { logger } from "@/lib/utils/logger";
import {
  RETENTION_RULES,
  DAILY_PUSH_LIMIT,
  SEND_HOUR_START,
  SEND_HOUR_END,
  findCandidates,
  isLoyalCustomer,
  hasCooldown,
  todayPushCount,
  sendRetentionPush,
  type ServiceCategory,
  type Stage,
} from "@/lib/notifications/retention-push";

export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Send window check — per Taipei wall-clock
  const taipeiHour = parseInt(
    new Date().toLocaleString("en-US", {
      timeZone: "Asia/Taipei",
      hour: "2-digit",
      hour12: false,
    }),
    10,
  );
  if (taipeiHour < SEND_HOUR_START || taipeiHour >= SEND_HOUR_END) {
    return Response.json({
      success: true,
      skipped: true,
      reason: `outside send window (${SEND_HOUR_START}-${SEND_HOUR_END}); current ${taipeiHour}`,
    });
  }

  try {
    const tenants = await prisma.tenant.findMany({
      where: { isActive: true },
      select: { id: true, businessName: true },
    });

    const summary: Array<{
      tenantId: string;
      service: ServiceCategory;
      stage: Stage;
      sent: number;
      skipped: number;
      reasons: Record<string, number>;
    }> = [];

    const services: ServiceCategory[] = ["剪髮", "染髮", "燙髮"];
    const stages: Stage[] = ["softReminder", "discount10", "winback"];

    for (const tenant of tenants) {
      const todayCount = await todayPushCount(tenant.id);
      if (todayCount >= DAILY_PUSH_LIMIT) {
        logger.info("retention push: daily limit reached", "cron", {
          tenantId: tenant.id,
          todayCount,
        });
        continue;
      }
      let remaining = DAILY_PUSH_LIMIT - todayCount;

      for (const service of services) {
        for (const stage of stages) {
          if (remaining <= 0) break;
          const rule = RETENTION_RULES[service];
          const days = rule[stage];
          const candidates = await findCandidates(tenant.id, service, days);

          let sent = 0;
          let skipped = 0;
          const reasons: Record<string, number> = {};
          for (const c of candidates) {
            if (remaining <= 0) {
              reasons["daily_limit"] = (reasons["daily_limit"] ?? 0) + 1;
              skipped++;
              continue;
            }
            if (await hasCooldown(tenant.id, c.userId)) {
              reasons["cooldown"] = (reasons["cooldown"] ?? 0) + 1;
              skipped++;
              continue;
            }
            // Loyal customers: skip soft + discount, but still send winback
            if (
              stage !== "winback" &&
              (await isLoyalCustomer(tenant.id, c.userId, service))
            ) {
              reasons["loyal_skip"] = (reasons["loyal_skip"] ?? 0) + 1;
              skipped++;
              continue;
            }

            const result = await sendRetentionPush({
              tenantId: tenant.id,
              userId: c.userId,
              lineUserId: c.lineUserId,
              service,
              stage,
            });
            if (result.ok) {
              sent++;
              remaining--;
            } else {
              reasons["send_failed"] = (reasons["send_failed"] ?? 0) + 1;
              skipped++;
            }
          }
          summary.push({
            tenantId: tenant.id,
            service,
            stage,
            sent,
            skipped,
            reasons,
          });
        }
      }
    }

    const totalSent = summary.reduce((s, r) => s + r.sent, 0);
    const totalSkipped = summary.reduce((s, r) => s + r.skipped, 0);
    logger.info("retention push complete", "cron", { totalSent, totalSkipped });

    return Response.json({
      success: true,
      totalSent,
      totalSkipped,
      summary,
    });
  } catch (err) {
    logger.error("retention-push cron failed", err, "cron");
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}
