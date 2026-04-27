/**
 * Set / read mock bank info for the default tenant.
 *
 * Usage:
 *   npx tsx scripts/check-tenant-bank.ts          # read only
 *   npx tsx scripts/check-tenant-bank.ts --set    # write mock values
 */
import "dotenv/config";
import { prisma } from "../src/lib/prisma";

const MOCK = {
  bankInfo: "中國信託商業銀行 (822)",
  bankAccountName: "1008 Hair Studio",
  bankAccountNumber: "1234567890123456",
};

async function main() {
  const tenantId = process.env.DEFAULT_TENANT_ID!;
  const shouldSet = process.argv.includes("--set");

  if (shouldSet) {
    const updated = await prisma.tenant.update({
      where: { id: tenantId },
      data: MOCK,
      select: {
        businessName: true,
        bankInfo: true,
        bankAccountName: true,
        bankAccountNumber: true,
      },
    });
    console.log("Updated tenant bank info:");
    console.log(JSON.stringify(updated, null, 2));
  } else {
    const t = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        businessName: true,
        bankInfo: true,
        bankAccountName: true,
        bankAccountNumber: true,
      },
    });
    console.log(JSON.stringify(t, null, 2));
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
