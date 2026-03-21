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

async function recalculateSegmentsForTenant(tenantId: string) {
  const now = new Date();
  const atRiskDate = new Date(now.getTime() - AT_RISK_DAYS * 24 * 60 * 60 * 1000);
  const lapsedDate = new Date(now.getTime() - LAPSED_DAYS * 24 * 60 * 60 * 1000);

  await prisma.user.updateMany({
    where: {
      tenantId,
      segment: { notIn: ["BLACKLISTED", "VIP"] },
      lastVisitAt: { lt: lapsedDate },
      totalVisits: { gt: 0 },
    },
    data: { segment: "LAPSED" },
  });

  await prisma.user.updateMany({
    where: {
      tenantId,
      segment: { notIn: ["BLACKLISTED", "VIP", "LAPSED"] },
      lastVisitAt: { lt: atRiskDate, gte: lapsedDate },
      totalVisits: { gt: 0 },
    },
    data: { segment: "AT_RISK" },
  });

  await prisma.user.updateMany({
    where: {
      tenantId,
      segment: { notIn: ["BLACKLISTED"] },
      totalVisits: { gte: 6 },
      lastVisitAt: { gte: atRiskDate },
    },
    data: { segment: "VIP", isVip: true },
  });

  await prisma.user.updateMany({
    where: {
      tenantId,
      segment: { notIn: ["BLACKLISTED", "VIP"] },
      totalVisits: { gte: 1, lt: 6 },
      lastVisitAt: { gte: atRiskDate },
    },
    data: { segment: "REGULAR" },
  });
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
