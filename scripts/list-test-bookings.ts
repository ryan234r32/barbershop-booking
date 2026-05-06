import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

// Reference list — kept inline for clarity, used only via the queries below.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const TARGET_LINE_USER_IDS = [
  "Ufb5e0c7d45371b2f5952615c4dc36279", // 陳昶龍 Ryan — 你的測試 LINE
  "U671fe71bc32", // 碩展 partial — list any U... that matches
];

async function main() {
  const TENANT_ID = process.env.DEFAULT_TENANT_ID!;

  // 找你的 LINE 測試帳號的 booking
  const ryanBookings = await prisma.booking.findMany({
    where: {
      tenantId: TENANT_ID,
      user: { lineUserId: "Ufb5e0c7d45371b2f5952615c4dc36279" },
    },
    select: {
      id: true,
      date: true,
      startTime: true,
      status: true,
      source: true,
      service: { select: { name: true } },
      user: { select: { displayName: true } },
    },
    orderBy: { date: "asc" },
  });

  console.log(`\n=== 「陳昶龍 Ryan」(你的 LINE 測試帳號) 的 ${ryanBookings.length} 筆 booking ===\n`);
  for (const b of ryanBookings) {
    console.log(
      `   ${b.date.toISOString().slice(0, 10)} ${b.startTime}  ${b.service.name.padEnd(12)} ${b.status.padEnd(11)} (${b.source})`,
    );
  }

  // 找 manual- 開頭的所有 booking
  const manualBookings = await prisma.booking.findMany({
    where: {
      tenantId: TENANT_ID,
      user: { lineUserId: { startsWith: "manual-" } },
    },
    select: {
      id: true,
      date: true,
      startTime: true,
      status: true,
      source: true,
      service: { select: { name: true } },
      user: { select: { displayName: true, realName: true, lineUserId: true } },
    },
    orderBy: { date: "asc" },
  });

  console.log(`\n=== 老闆手建 (manual-) 的 ${manualBookings.length} 筆 booking ===\n`);
  for (const b of manualBookings) {
    const name = (b.user?.realName ?? b.user?.displayName ?? "—").padEnd(15);
    console.log(
      `   ${b.date.toISOString().slice(0, 10)} ${b.startTime}  ${name} ${b.service.name.padEnd(12)} ${b.status.padEnd(11)}`,
    );
  }

  // 看其他 U-prefix 帳號（不只 Ryan + 碩展）
  const otherLine = await prisma.user.findMany({
    where: {
      tenantId: TENANT_ID,
      lineUserId: { startsWith: "U" },
      NOT: { lineUserId: "Ufb5e0c7d45371b2f5952615c4dc36279" },
    },
    select: {
      lineUserId: true,
      displayName: true,
      realName: true,
      _count: { select: { bookings: true } },
    },
  });

  console.log(`\n=== 其他真 LINE 帳號 (除了 Ryan)：${otherLine.length} 位 ===\n`);
  for (const u of otherLine) {
    console.log(
      `   ${(u.realName ?? u.displayName ?? "—").padEnd(15)} ${u._count.bookings} 筆 · ${u.lineUserId.slice(0, 18)}...`,
    );
  }

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
