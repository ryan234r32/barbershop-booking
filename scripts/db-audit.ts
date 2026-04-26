/**
 * One-shot DB audit — prints counts of hist-/legacy-/manual-/verify-/test-/real users + bookings,
 * then samples the new V3.5 totals (visit freq, oneTimerRate, gap, retention, shop-source split)
 * for a year-2025 range so we can sanity-check the numbers before shipping.
 *
 * Run: `npx tsx scripts/db-audit.ts`
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { computeTotals, computeRetention } from "../src/lib/reports/aggregate";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const tenantId = process.env.DEFAULT_TENANT_ID!;
  const [histB, otherB, totalB, legacyU, manualU, verifyU, testU, totalU] = await Promise.all([
    prisma.booking.count({ where: { tenantId, id: { startsWith: "hist-" } } }),
    prisma.booking.count({ where: { tenantId, NOT: { id: { startsWith: "hist-" } } } }),
    prisma.booking.count({ where: { tenantId } }),
    prisma.user.count({ where: { tenantId, lineUserId: { startsWith: "legacy-" } } }),
    prisma.user.count({ where: { tenantId, lineUserId: { startsWith: "manual-" } } }),
    prisma.user.count({ where: { tenantId, lineUserId: { startsWith: "verify-" } } }),
    prisma.user.count({ where: { tenantId, lineUserId: { startsWith: "test-" } } }),
    prisma.user.count({ where: { tenantId } }),
  ]);
  const realU = totalU - legacyU - manualU - verifyU - testU;
  console.log(`=== DB Audit (tenant=${tenantId}) ===`);
  console.log(`Bookings: hist-=${histB} other=${otherB} total=${totalB}`);
  console.log(`Users: legacy-=${legacyU} manual-=${manualU} verify-=${verifyU} test-=${testU} real=${realU} total=${totalU}`);

  // Year-2025 range: Jan 1 → Dec 31 in Asia/Taipei
  const from = new Date("2024-12-31T16:00:00.000Z"); // 2025-01-01 00:00 Taipei
  const to = new Date("2025-12-31T15:59:59.999Z");   // 2025-12-31 23:59 Taipei
  const range = { type: "year" as const, offset: -1, from, to, label: "2025", fromIso: "2025-01-01", toIso: "2025-12-31" };

  console.log(`\n=== V3.5 Metrics (${range.label}) ===`);
  const totals = await computeTotals(tenantId, range);
  console.log(`預約數          ${totals.bookings}`);
  console.log(`營收            NT$${totals.revenue.toLocaleString()}`);
  console.log(`客單價          NT$${totals.arpu.toLocaleString()}`);
  console.log(`唯一客戶        ${totals.uniqueCustomers}`);
  console.log(`年訪頻率        ${totals.visitFrequency} 次/客戶`);
  console.log(`一次性客戶比例   ${totals.oneTimerRate}%`);
  console.log(`平均回訪間隔     ${totals.avgGapDays} 天 (中位 ${totals.medianGapDays} 天)`);
  console.log(`佔用率          ${totals.occupancyRate}%`);
  console.log(`新店面客 (新到此期內首訪)  ${totals.shopNewCustomers}`);
  console.log(`舊店面客 (從舊店搬過來)    ${totals.shopOldCustomers}`);

  const ret = await computeRetention(tenantId);
  console.log(`30 天留存率      ${ret.retention30Days}%`);
  console.log(`60 天留存率      ${ret.retention60Days}%`);
  console.log(`90 天留存率      ${ret.retention90Days}%`);
}
main().finally(() => prisma.$disconnect());
