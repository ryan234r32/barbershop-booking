import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { computeDailyView } from "../src/lib/reports/v3.6/aggregates";

async function main() {
  const tenant = await prisma.tenant.findFirst();
  if (!tenant) return console.log("no tenant");
  console.log("Tenant:", tenant.id);
  console.log("Querying 2026-04-30...");
  const start = Date.now();
  try {
    const result = await computeDailyView(tenant.id, "2026-04-30");
    console.log(`Done in ${Date.now() - start}ms`);
    console.log("Rows:", result.rows.length);
    console.log("Revenue:", result.totalRevenue);
  } catch (e) {
    console.log(`Failed in ${Date.now() - start}ms`);
    console.error(e);
  }
  await prisma.$disconnect();
}
main();
