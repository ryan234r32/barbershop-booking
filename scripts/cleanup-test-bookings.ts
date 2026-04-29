/**
 * One-shot cleanup script — remove confirmed test bookings.
 *
 * Targets (per user confirmation 2026-04-29):
 *   - 「陳昶龍 Ryan」LINE userId Ufb5e0c7d45371b2f5952615c4dc36279 全部 booking
 *   - manual- 開頭 user 的全部 booking（會留下 user record 但 booking 清光）
 *
 * Dry-run by default. Pass --confirm to actually delete.
 *
 * Usage:
 *   npx tsx scripts/cleanup-test-bookings.ts            # preview
 *   npx tsx scripts/cleanup-test-bookings.ts --confirm  # actually delete
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const RYAN_LINE_USER_ID = "Ufb5e0c7d45371b2f5952615c4dc36279";
const CONFIRM = process.argv.includes("--confirm");

async function main() {
  const TENANT_ID = process.env.DEFAULT_TENANT_ID!;

  console.log(`=== Cleanup test bookings (${CONFIRM ? "CONFIRM" : "DRY-RUN"}) ===\n`);

  // Collect target booking IDs
  const ryanBookings = await prisma.booking.findMany({
    where: { tenantId: TENANT_ID, user: { lineUserId: RYAN_LINE_USER_ID } },
    select: { id: true, date: true, startTime: true, service: { select: { name: true } } },
    orderBy: { date: "asc" },
  });
  const manualBookings = await prisma.booking.findMany({
    where: {
      tenantId: TENANT_ID,
      user: { lineUserId: { startsWith: "manual-" } },
    },
    select: {
      id: true,
      date: true,
      startTime: true,
      service: { select: { name: true } },
      user: { select: { realName: true, displayName: true, lineUserId: true } },
    },
    orderBy: { date: "asc" },
  });

  console.log(`📋 將刪除 ${ryanBookings.length} 筆「陳昶龍 Ryan」booking`);
  console.log(`📋 將刪除 ${manualBookings.length} 筆 manual- booking`);

  const allIds = [...ryanBookings.map((b) => b.id), ...manualBookings.map((b) => b.id)];
  if (allIds.length === 0) {
    console.log("✓ 沒有東西要刪");
    return;
  }

  if (!CONFIRM) {
    console.log("\n⚠️  Dry-run only. 要真的刪請加 --confirm flag。");
    return;
  }

  // Cascade delete: dependents first, then booking, then orphaned manual- users
  const result = await prisma.$transaction(async (tx) => {
    const delPay = await tx.payment.deleteMany({ where: { bookingId: { in: allIds } } });
    const delNotif = await tx.notification.deleteMany({ where: { bookingId: { in: allIds } } });
    const delCancel = await tx.cancellationRecord.deleteMany({
      where: { bookingId: { in: allIds } },
    });
    const delEcpay = await tx.eCPayOrder.deleteMany({ where: { bookingId: { in: allIds } } });
    const delBook = await tx.booking.deleteMany({ where: { id: { in: allIds } } });

    // Delete orphaned manual- users (those with 0 remaining bookings)
    const orphanManual = await tx.user.findMany({
      where: {
        tenantId: TENANT_ID,
        lineUserId: { startsWith: "manual-" },
        bookings: { none: {} },
      },
      select: { id: true, displayName: true, realName: true },
    });
    const delUsers = await tx.user.deleteMany({
      where: { id: { in: orphanManual.map((u) => u.id) } },
    });

    return {
      payments: delPay.count,
      notifications: delNotif.count,
      cancellations: delCancel.count,
      ecpay: delEcpay.count,
      bookings: delBook.count,
      orphanUsers: delUsers.count,
      orphanList: orphanManual.map((u) => u.realName ?? u.displayName ?? "—"),
    };
  });

  console.log(`\n✓ 刪除完成：`);
  console.log(`   bookings: ${result.bookings}`);
  console.log(`   payments: ${result.payments}`);
  console.log(`   notifications: ${result.notifications}`);
  console.log(`   cancellations: ${result.cancellations}`);
  console.log(`   ecpay orders: ${result.ecpay}`);
  console.log(`   orphan manual- users: ${result.orphanUsers} (${result.orphanList.join(", ")})`);
  console.log(`\n💡 「陳昶龍 Ryan」LINE user 帳號保留 — 之後還可以用這個 LINE 測試預約`);
  console.log(`   下次測試時系統會自動在 notes 加 [TEST] 前綴（待 follow-up commit 加上）`);
}

main()
  .catch(async (e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
