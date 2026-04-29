import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const TENANT_ID = process.env.DEFAULT_TENANT_ID!;

  // 1) Search for Chen Chang-Long / Chen Chang-Rong test names
  const suspects = await prisma.user.findMany({
    where: {
      tenantId: TENANT_ID,
      OR: [
        { displayName: { contains: "陳昶龍" } },
        { realName: { contains: "陳昶龍" } },
        { displayName: { contains: "陳長榮" } },
        { realName: { contains: "陳長榮" } },
        { displayName: { contains: "ryan", mode: "insensitive" } },
        { displayName: { contains: "Ryan", mode: "insensitive" } },
        { realName: { contains: "Ryan", mode: "insensitive" } },
        { displayName: { contains: "test", mode: "insensitive" } },
      ],
    },
    select: {
      id: true,
      lineUserId: true,
      displayName: true,
      realName: true,
      createdAt: true,
      _count: { select: { bookings: true } },
    },
    take: 50,
  });

  console.log(`\n🔎 搜尋可能的測試客戶（名字含 陳昶龍 / 陳長榮 / ryan / test）：${suspects.length} 位\n`);
  for (const u of suspects) {
    const idType = u.lineUserId.startsWith("U")
      ? "🟦 真 LINE"
      : u.lineUserId.startsWith("manual-")
        ? "🟧 老闆手建"
        : "⬜ 其他";
    console.log(`   ${idType}  ${(u.realName ?? u.displayName ?? "—").padEnd(15)} ${u._count.bookings} 筆 booking · 建立 ${u.createdAt.toISOString().slice(0, 10)}`);
    console.log(`      lineUserId: ${u.lineUserId.slice(0, 35)}`);
  }

  // 2) List all U-prefix users with booking history (real LINE customers might include test ones)
  console.log(`\n🟦 所有真 LINE 客戶（U 開頭）的 booking 統計：\n`);
  const lineUsers = await prisma.user.findMany({
    where: { tenantId: TENANT_ID, lineUserId: { startsWith: "U" } },
    select: {
      id: true,
      lineUserId: true,
      displayName: true,
      realName: true,
      createdAt: true,
      _count: { select: { bookings: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  for (const u of lineUsers) {
    console.log(`   ${(u.realName ?? u.displayName ?? "—").padEnd(15)} ${String(u._count.bookings).padStart(3)} 筆 · ${u.createdAt.toISOString().slice(0, 10)} · ${u.lineUserId.slice(0, 12)}...`);
  }

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
