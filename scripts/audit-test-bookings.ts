/**
 * Audit script — find test/fake bookings vs real imported / LINE bookings.
 *
 * Classification:
 *   - 真實匯入（2024/2025/2026 預約表）：booking.id starts with "hist-"
 *   - 真 LINE 客戶下單：lineUserId starts with "U" (LINE 真實 user ID)
 *   - 老闆手建（admin manual）：lineUserId starts with "manual-" → 可能是 walk-in 也可能是測試
 *   - Legacy stub：lineUserId starts with "legacy-" → import script 造的，跟 hist- 配對
 *
 * Usage:
 *   npx tsx scripts/audit-test-bookings.ts                    # all dates
 *   npx tsx scripts/audit-test-bookings.ts --from=2026-01-01  # filter by date
 *   npx tsx scripts/audit-test-bookings.ts --recent           # only bookings created in last 7 days
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const TENANT_ID = process.env.DEFAULT_TENANT_ID!;

function getArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const found = process.argv.find((a) => a.startsWith(prefix));
  return found?.slice(prefix.length);
}

async function main() {
  const fromIso = getArg("from") ?? "2026-01-01";
  const toIso = getArg("to") ?? "2026-12-31";
  const recentOnly = process.argv.includes("--recent");

  const recentCutoff = new Date(Date.now() - 7 * 24 * 3600 * 1000);

  console.log(`=== Booking Audit (${fromIso} ~ ${toIso}) ===\n`);

  const bookings = await prisma.booking.findMany({
    where: {
      tenantId: TENANT_ID,
      date: {
        gte: new Date(fromIso + "T00:00:00+08:00"),
        lte: new Date(toIso + "T23:59:59+08:00"),
      },
      ...(recentOnly ? { createdAt: { gte: recentCutoff } } : {}),
    },
    select: {
      id: true,
      date: true,
      startTime: true,
      status: true,
      source: true,
      notes: true,
      createdAt: true,
      user: { select: { lineUserId: true, displayName: true, realName: true } },
    },
    orderBy: { date: "asc" },
  });

  // Classify
  let histImport = 0;
  let realLine = 0;
  let adminManual = 0;
  let other = 0;
  const sampleAdminManual: typeof bookings = [];

  for (const b of bookings) {
    if (b.id.startsWith("hist-")) {
      histImport++;
    } else if (b.user?.lineUserId?.startsWith("U")) {
      realLine++;
    } else if (b.user?.lineUserId?.startsWith("manual-")) {
      adminManual++;
      if (sampleAdminManual.length < 30) sampleAdminManual.push(b);
    } else {
      other++;
    }
  }

  console.log(`📊 統計（共 ${bookings.length} 筆）`);
  console.log(`   ✅ hist- 真實匯入（2024/2025/2026 預約表）：${histImport} 筆`);
  console.log(`   ✅ 真 LINE 客戶下單（lineUserId 開頭 U）：${realLine} 筆`);
  console.log(`   ⚠️  老闆手建 / 可能是測試（manual-）：${adminManual} 筆`);
  console.log(`   ❓ 其他（legacy- 或無 user）：${other} 筆`);
  console.log();

  if (sampleAdminManual.length > 0) {
    console.log(`📋 老闆手建 booking 樣本（前 ${sampleAdminManual.length} 筆，按日期排序）：`);
    console.log(`   ${"日期".padEnd(11)} ${"時段".padEnd(7)} ${"狀態".padEnd(11)} ${"客戶".padEnd(20)} 建立時間`);
    console.log(`   ${"─".repeat(80)}`);
    for (const b of sampleAdminManual) {
      const date = b.date.toISOString().slice(0, 10);
      const name = (b.user?.realName ?? b.user?.displayName ?? "—").padEnd(20);
      const status = b.status.padEnd(11);
      const created = b.createdAt.toISOString().slice(0, 16).replace("T", " ");
      console.log(`   ${date}  ${b.startTime.padEnd(7)} ${status} ${name} ${created}`);
    }
    console.log();
    console.log(`💡 要看更多 / 按日期 filter 可加 --from=YYYY-MM-DD 參數`);
    console.log(`💡 要刪除這些手建 booking 用：npx tsx scripts/audit-test-bookings.ts --delete-manual --confirm`);
  }

  // Detection: time slots where REAL hist- + ADMIN-manual collide
  const slotKey = (b: { date: Date; startTime: string }) =>
    `${b.date.toISOString().slice(0, 10)} ${b.startTime}`;
  const histSlots = new Set(bookings.filter((b) => b.id.startsWith("hist-")).map(slotKey));
  const collisions = sampleAdminManual.filter((b) => histSlots.has(slotKey(b)));
  if (collisions.length > 0) {
    console.log(`🚨 衝突檢查：${collisions.length} 筆手建 booking 跟真實匯入是 SAME 日期+時段`);
    console.log(`   這些手建 booking 可能擋住了 (但不會, 因為 import script 沒做 availability check)`);
    console.log();
  }

  if (process.argv.includes("--delete-manual")) {
    if (!process.argv.includes("--confirm")) {
      console.log("⚠️  需要 --confirm flag 才會真的刪除");
      console.log(`   會刪 ${adminManual} 筆 manual- booking`);
      process.exit(0);
    }

    console.log(`\n--- DELETING ${adminManual} manual bookings ---`);
    const result = await prisma.$transaction(async (tx) => {
      const idsToDelete = bookings
        .filter((b) => b.user?.lineUserId?.startsWith("manual-"))
        .map((b) => b.id);

      // Delete dependents first
      const delPay = await tx.payment.deleteMany({ where: { bookingId: { in: idsToDelete } } });
      const delNotif = await tx.notification.deleteMany({ where: { bookingId: { in: idsToDelete } } });
      const delCancel = await tx.cancellationRecord.deleteMany({
        where: { bookingId: { in: idsToDelete } },
      });
      const delEcpay = await tx.eCPayOrder.deleteMany({ where: { bookingId: { in: idsToDelete } } });
      const delBook = await tx.booking.deleteMany({ where: { id: { in: idsToDelete } } });

      return {
        payments: delPay.count,
        notifications: delNotif.count,
        cancellations: delCancel.count,
        ecpay: delEcpay.count,
        bookings: delBook.count,
      };
    });

    console.log(`✓ 已刪除：`);
    console.log(`   bookings: ${result.bookings}`);
    console.log(`   payments: ${result.payments}`);
    console.log(`   notifications: ${result.notifications}`);
    console.log(`   cancellations: ${result.cancellations}`);
    console.log(`   ecpay orders: ${result.ecpay}`);
    console.log(`\n💡 對應的 manual- user 還在（沒有 booking 也沒關係，下次清 user 可獨立做）`);
  }

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error("Audit failed:", e);
  await prisma.$disconnect();
  process.exit(1);
});
