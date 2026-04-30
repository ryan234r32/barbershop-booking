/**
 * One-off DB ops for V3.8 demo readiness:
 *   1. Recalculate all segments now (cron only ran weekly, 0 VIP/0 REGULAR)
 *   2. Prefix Ryan's own user displayName with "Test " so reports visually
 *      separate his dev/test bookings from the owner's real customers.
 *
 * Run with: npx tsx scripts/run-recalc-and-test-prefix.ts
 *
 * Idempotent: re-running adds nothing if Test prefix is already present
 * and segment recalc is naturally idempotent.
 */
import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { recalculateSegments } from "../src/lib/crm/segmentation";

async function main() {
  console.log("=== 1. Recalculating segments ===");
  const before = await prisma.user.groupBy({
    by: ["segment"],
    _count: true,
  });
  console.log("Before:", before);

  const result = await recalculateSegments();
  console.log("Tenants processed:", result.tenantsProcessed);

  const after = await prisma.user.groupBy({
    by: ["segment"],
    _count: true,
  });
  console.log("After:", after);

  console.log("\n=== 2. Tagging Ryan's user with 'Test ' prefix ===");
  // Find Ryan by his real LINE U-id (from audit)
  const ryan = await prisma.user.findFirst({
    where: {
      lineUserId: { startsWith: "U" },
      OR: [
        { displayName: { contains: "Ryan" } },
        { displayName: { contains: "陳昶龍" } },
      ],
    },
    select: { id: true, displayName: true, lineUserId: true, _count: { select: { bookings: true } } },
  });

  if (!ryan) {
    console.log("No Ryan user found, skipping prefix");
  } else if (ryan.displayName?.startsWith("Test ")) {
    console.log(`Already prefixed: ${ryan.displayName} — skipping`);
  } else {
    console.log(`Found: ${ryan.displayName} (${ryan._count.bookings} bookings)`);
    const updated = await prisma.user.update({
      where: { id: ryan.id },
      data: { displayName: `Test ${ryan.displayName}` },
      select: { displayName: true },
    });
    console.log(`Updated to: ${updated.displayName}`);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
