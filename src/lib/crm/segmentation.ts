import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AT_RISK_DAYS, LAPSED_DAYS } from "@/lib/utils/constants";

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
 * Single-SQL CRM segmentation (PRD-v3 §5 + E-10).
 *
 * Replaces the prior 4-step `updateMany` chain with one CTE-style UPDATE that:
 *   1. Computes COMPLETED visit count in the last 60 days per user
 *   2. Joins back via LEFT JOIN so users with zero visits still get evaluated
 *   3. Applies the segment CASE in priority order (BLACKLISTED > LAPSED > AT_RISK > VIP > REGULAR > NEW)
 *
 * Why a single SQL: prior 4 sequential updateMany would also OK, but the new
 * V3 rules require "visits in last 60 days" — totalVisits column alone can't
 * answer that. A naive impl would be N+1 (per-user query); CTE keeps it O(N+M)
 * with a single hash aggregate + hash join in Postgres.
 *
 * Segment rules (PRD-v3 §5):
 *   BLACKLISTED → no change (manual lockout)
 *   totalVisits = 0 → NEW
 *   lastVisitAt < (now - LAPSED_DAYS=180) → LAPSED
 *   lastVisitAt < (now - AT_RISK_DAYS=100) → AT_RISK
 *   visits_60d ≥ 12 AND lastVisitAt within 100 days → VIP (also flips is_vip)
 *   visits_60d ≥ 1 AND lastVisitAt within 100 days → REGULAR
 *   else → NEW
 */
async function recalculateSegmentsForTenant(tenantId: string) {
  const now = new Date();
  const atRiskDate = new Date(now.getTime() - AT_RISK_DAYS * 24 * 60 * 60 * 1000);
  const lapsedDate = new Date(now.getTime() - LAPSED_DAYS * 24 * 60 * 60 * 1000);
  const window60d = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

  // Single CTE-style UPDATE — replaces 4 sequential updateMany (E-10).
  // Postgres planner produces: aggregate (COMPLETED bookings in 60d window) →
  // LEFT JOIN to all tenant users → single bulk UPDATE. ~O(N+M) not N*M.
  await prisma.$executeRaw`
    UPDATE users
    SET
      segment = (CASE
        WHEN users.segment = 'BLACKLISTED' THEN users.segment
        WHEN users.total_visits = 0 THEN 'NEW'
        WHEN users.last_visit_at < ${lapsedDate} THEN 'LAPSED'
        WHEN users.last_visit_at < ${atRiskDate} THEN 'AT_RISK'
        WHEN COALESCE(sub.cnt_60d, 0) >= 12 THEN 'VIP'
        WHEN COALESCE(sub.cnt_60d, 0) >= 1 THEN 'REGULAR'
        ELSE 'NEW'
      END)::"CustomerSegment",
      is_vip = (CASE
        WHEN users.segment != 'BLACKLISTED' AND COALESCE(sub.cnt_60d, 0) >= 12 THEN true
        ELSE users.is_vip
      END)
    FROM (
      SELECT u.id, COALESCE(v.cnt, 0) AS cnt_60d
      FROM users u
      LEFT JOIN (
        SELECT user_id, COUNT(*)::int AS cnt
        FROM bookings
        WHERE tenant_id = ${tenantId}
          AND status = 'COMPLETED'
          AND date >= ${window60d}
        GROUP BY user_id
      ) v ON v.user_id = u.id
      WHERE u.tenant_id = ${tenantId}
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
