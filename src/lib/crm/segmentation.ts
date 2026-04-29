import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  AT_RISK_DAYS,
  LAPSED_DAYS,
  VIP_RECENT_DAYS,
  VIP_VISITS_180D,
  REGULAR_VISITS_365D,
} from "@/lib/utils/constants";

/**
 * Recalculate customer segments.
 * If no tenantId provided, processes all active tenants.
 */
export async function recalculateSegments(tenantId?: string) {
  if (!tenantId) {
    const tenants = await prisma.tenant.findMany({
      where: { isActive: true },
      select: { id: true },
    });
    for (const t of tenants) {
      await recalculateSegmentsForTenant(t.id);
    }
    return { tenantsProcessed: tenants.length };
  }

  await recalculateSegmentsForTenant(tenantId);
  return { tenantsProcessed: 1 };
}

/**
 * Single-SQL CRM segmentation (Plan A 2026-04-29 — 依 1008 真實 3.36 次/年訪頻校準).
 *
 * Aggregates COMPLETED bookings per user with two windowed counts (180d + 365d)
 * in one LEFT JOIN, then applies segment CASE in priority order. Postgres planner:
 * aggregate → hash join → bulk UPDATE. O(N+M).
 *
 * Segment rules (constants in lib/utils/constants.ts):
 *   BLACKLISTED → no change (manual lockout)
 *   totalVisits = 0 → NEW
 *   lastVisitAt < (now - LAPSED_DAYS=240) → LAPSED
 *   lastVisitAt < (now - AT_RISK_DAYS=120) → AT_RISK
 *   cnt_180d ≥ VIP_VISITS_180D=6 AND lastVisitAt ≥ (now - VIP_RECENT_DAYS=60) → VIP
 *   cnt_365d ≥ REGULAR_VISITS_365D=3 AND lastVisitAt ≥ (now - AT_RISK_DAYS=120) → REGULAR
 *   else → NEW
 */
async function recalculateSegmentsForTenant(tenantId: string) {
  const now = new Date();
  const atRiskDate = new Date(now.getTime() - AT_RISK_DAYS * 24 * 60 * 60 * 1000);
  const lapsedDate = new Date(now.getTime() - LAPSED_DAYS * 24 * 60 * 60 * 1000);
  const vipRecentDate = new Date(now.getTime() - VIP_RECENT_DAYS * 24 * 60 * 60 * 1000);
  const window180d = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
  const window365d = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

  await prisma.$executeRaw`
    UPDATE users
    SET
      segment = (CASE
        WHEN users.segment = 'BLACKLISTED' THEN users.segment
        WHEN users.total_visits = 0 THEN 'NEW'
        WHEN users.last_visit_at < ${lapsedDate} THEN 'LAPSED'
        WHEN users.last_visit_at < ${atRiskDate} THEN 'AT_RISK'
        WHEN COALESCE(sub.cnt_180d, 0) >= ${VIP_VISITS_180D}
             AND users.last_visit_at >= ${vipRecentDate} THEN 'VIP'
        WHEN COALESCE(sub.cnt_365d, 0) >= ${REGULAR_VISITS_365D}
             AND users.last_visit_at >= ${atRiskDate} THEN 'REGULAR'
        ELSE 'NEW'
      END)::"CustomerSegment",
      is_vip = (CASE
        WHEN users.segment != 'BLACKLISTED'
             AND COALESCE(sub.cnt_180d, 0) >= ${VIP_VISITS_180D}
             AND users.last_visit_at >= ${vipRecentDate} THEN true
        ELSE users.is_vip
      END)
    FROM (
      SELECT u.id,
             COALESCE(SUM(CASE WHEN v.date >= ${window180d} THEN 1 ELSE 0 END), 0)::int AS cnt_180d,
             COALESCE(COUNT(v.id), 0)::int AS cnt_365d
      FROM users u
      LEFT JOIN bookings v
        ON v.user_id = u.id
        AND v.tenant_id = ${tenantId}
        AND v.status = 'COMPLETED'
        AND v.date >= ${window365d}
      WHERE u.tenant_id = ${tenantId}
      GROUP BY u.id
    ) sub
    WHERE users.id = sub.id
  `;
}

/**
 * Reset expired violations. Called by daily cron.
 */
export async function resetExpiredViolations() {
  const now = new Date();

  const result = await prisma.user.updateMany({
    where: {
      bookingRestricted: true,
      restrictedUntil: { lte: now },
    },
    data: {
      bookingRestricted: false,
      restrictedUntil: null,
      violationCount: 0,
    },
  });

  return result.count;
}

// `Prisma` is imported solely to satisfy the type narrowing of $executeRaw template literals.
void Prisma;
