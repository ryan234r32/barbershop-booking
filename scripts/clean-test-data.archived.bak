/**
 * Test-data cleanup for V3.5 (PRD §3.1).
 *
 *   npm run cleanup:dryrun   # prints what would be deleted, no DB writes
 *   npm run cleanup:execute  # actually deletes
 *
 * What we KEEP:
 *   - Booking.id starting with `hist-` (1169 Excel real-history rows)
 *   - User.lineUserId starting with `legacy-` (348 Excel customers)
 *   - User.lineUserId in real LINE format `U[a-zA-Z0-9]{32}` (33-char total)
 *     → 老闆 Ryan VIP + 碩展 (interview customer) etc.
 *
 * What we DELETE:
 *   - Bookings whose id does NOT start with `hist-` (dev/manual test rows)
 *   - Users whose lineUserId is neither legacy- nor LINE-format
 *     (catches `manual-`, `verify-`, `test-`, `admi-`, `bo-`, `dup-`, `anon-`,
 *      `p-…`, `o-…`, `leak-`, etc — all non-real test prefixes)
 *   - Cascading dependents: Payment, CancellationRecord, Notification,
 *     ECPayOrder, Coupon, Message, ConsultationRequest
 *
 * Safety:
 *   - Defaults to DRY-RUN. Must pass `--commit` to actually mutate.
 *   - Wraps mutations in a single Prisma $transaction → all-or-nothing.
 *   - Prints a summary and asks for explicit confirmation when >1 real LINE
 *     user (U-format) is in the about-to-delete pool. (Should never happen.)
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const COMMIT = process.argv.includes("--commit");
const TENANT_ID = process.env.DEFAULT_TENANT_ID;
if (!TENANT_ID) {
  console.error("✗ DEFAULT_TENANT_ID env var required");
  process.exit(1);
}

/** Real LINE userId format: U + 32 hex/alpha chars = 33 chars total. */
const LINE_USER_ID_RE = /^U[a-zA-Z0-9]{32}$/;

function isKeeperUser(lineUserId: string): boolean {
  return lineUserId.startsWith("legacy-") || LINE_USER_ID_RE.test(lineUserId);
}

async function main() {
  console.log(`=== Test-data cleanup (${COMMIT ? "COMMIT" : "DRY-RUN"}) ===\n`);
  console.log(`Tenant: ${TENANT_ID}\n`);

  // 1. Find users to delete
  const allUsers = await prisma.user.findMany({
    where: { tenantId: TENANT_ID },
    select: { id: true, lineUserId: true, displayName: true, totalVisits: true },
  });
  const usersToDelete = allUsers.filter((u) => !isKeeperUser(u.lineUserId));
  const usersToKeep = allUsers.filter((u) => isKeeperUser(u.lineUserId));

  // 2. Find bookings to delete (non-hist OR owned by deleted users)
  const userIdsToDelete = new Set(usersToDelete.map((u) => u.id));
  const allBookings = await prisma.booking.findMany({
    where: { tenantId: TENANT_ID },
    select: { id: true, userId: true, status: true, date: true },
  });
  const bookingsToDelete = allBookings.filter(
    (b) => !b.id.startsWith("hist-") || userIdsToDelete.has(b.userId),
  );
  const bookingIdsToDelete = bookingsToDelete.map((b) => b.id);

  // 3. Stats
  const realLineToDelete = usersToDelete.filter((u) => LINE_USER_ID_RE.test(u.lineUserId));
  const realLineKept = usersToKeep.filter((u) => LINE_USER_ID_RE.test(u.lineUserId));

  console.log(`Users:`);
  console.log(`  KEEP: ${usersToKeep.length} (${usersToKeep.filter((u) => u.lineUserId.startsWith("legacy-")).length} legacy- + ${realLineKept.length} real LINE)`);
  console.log(`  DELETE: ${usersToDelete.length}`);
  if (usersToDelete.length > 0) {
    const byPrefix = new Map<string, number>();
    for (const u of usersToDelete) {
      const p = u.lineUserId.split("-")[0] || "(empty)";
      byPrefix.set(p, (byPrefix.get(p) ?? 0) + 1);
    }
    for (const [k, v] of byPrefix) console.log(`    - ${k}: ${v}`);
  }

  console.log(`\nBookings:`);
  console.log(`  KEEP: ${allBookings.length - bookingsToDelete.length} (all hist-)`);
  console.log(`  DELETE: ${bookingsToDelete.length}`);
  if (bookingsToDelete.length > 0) {
    const byStatus = new Map<string, number>();
    for (const b of bookingsToDelete) {
      byStatus.set(b.status, (byStatus.get(b.status) ?? 0) + 1);
    }
    for (const [k, v] of byStatus) console.log(`    - ${k}: ${v}`);
  }

  // 4. Find cascading rows. Some tables (consultation_requests, coupons,
  //    ecpay_orders) are in the Prisma schema but may not exist in this
  //    database yet (db push lagging). Tolerate `P2021 TableDoesNotExist` per
  //    table so the cleanup still works on partially-migrated DBs.
  const userIdsArr = Array.from(userIdsToDelete);
  const safeCount = async (label: string, fn: () => Promise<number>): Promise<number> => {
    try {
      return await fn();
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      if (code === "P2021") {
        console.log(`  ${label}: (table does not exist — skipped)`);
        return -1;
      }
      throw err;
    }
  };

  console.log(`\nCascading dependents (DELETE):`);
  const payCount = await safeCount("Payment", () =>
    prisma.payment.count({ where: { bookingId: { in: bookingIdsToDelete } } }),
  );
  if (payCount >= 0) console.log(`  Payment: ${payCount}`);
  const cancelCount = await safeCount("CancellationRecord", () =>
    prisma.cancellationRecord.count({
      where: {
        OR: [{ bookingId: { in: bookingIdsToDelete } }, { userId: { in: userIdsArr } }],
      },
    }),
  );
  if (cancelCount >= 0) console.log(`  CancellationRecord: ${cancelCount}`);
  const notifCount = await safeCount("Notification", () =>
    prisma.notification.count({ where: { bookingId: { in: bookingIdsToDelete } } }),
  );
  if (notifCount >= 0) console.log(`  Notification: ${notifCount}`);
  const ecpayCount = await safeCount("ECPayOrder", () =>
    prisma.eCPayOrder.count({ where: { bookingId: { in: bookingIdsToDelete } } }),
  );
  if (ecpayCount >= 0) console.log(`  ECPayOrder: ${ecpayCount}`);
  const couponCount = await safeCount("Coupon", () =>
    prisma.coupon.count({ where: { userId: { in: userIdsArr } } }),
  );
  if (couponCount >= 0) console.log(`  Coupon: ${couponCount}`);
  const msgCount = await safeCount("Message", () =>
    prisma.message.count({ where: { userId: { in: userIdsArr } } }),
  );
  if (msgCount >= 0) console.log(`  Message: ${msgCount}`);
  const consultCount = await safeCount("ConsultationRequest", () =>
    prisma.consultationRequest.count({ where: { userId: { in: userIdsArr } } }),
  );
  if (consultCount >= 0) console.log(`  ConsultationRequest: ${consultCount}`);

  // 5. Sanity guards
  if (realLineToDelete.length > 0) {
    console.error(`\n✗ ABORT: ${realLineToDelete.length} real LINE userId(s) marked for deletion:`);
    realLineToDelete.forEach((u) =>
      console.error(`  ${u.lineUserId.slice(0, 6)}…${u.lineUserId.slice(-4)} ${u.displayName ?? ""} visits=${u.totalVisits}`),
    );
    process.exit(1);
  }
  const histKeptCount = allBookings.length - bookingsToDelete.length;
  if (histKeptCount < 1100) {
    console.error(`\n✗ ABORT: would only keep ${histKeptCount} hist- bookings (expected ≥1100). Refusing.`);
    process.exit(1);
  }
  const legacyKept = usersToKeep.filter((u) => u.lineUserId.startsWith("legacy-")).length;
  if (legacyKept < 300) {
    console.error(`\n✗ ABORT: would only keep ${legacyKept} legacy- users (expected ≥300). Refusing.`);
    process.exit(1);
  }

  if (!COMMIT) {
    console.log(`\n✓ DRY-RUN complete. No DB writes. Re-run with --commit to delete.`);
    return;
  }

  // 6. Execute in transaction. Skip-on-P2021 lets us safely operate on DBs
  //    that don't have every model's table pushed yet.
  console.log(`\n--- Executing deletes in transaction ---`);
  await prisma.$transaction(async (tx) => {
    const safeDel = async (label: string, fn: () => Promise<{ count: number }>): Promise<number> => {
      try {
        const r = await fn();
        return r.count;
      } catch (err: unknown) {
        if ((err as { code?: string })?.code === "P2021") {
          console.log(`  ${label}: (table missing — skipped)`);
          return 0;
        }
        throw err;
      }
    };
    // Order matters — FK dependents go FIRST.
    // ECPayOrder.paymentId references Payment.id → must die before Payment.
    const dEcpay = await safeDel("ECPayOrder", () =>
      tx.eCPayOrder.deleteMany({ where: { bookingId: { in: bookingIdsToDelete } } }),
    );
    const dPay = await safeDel("Payment", () =>
      tx.payment.deleteMany({ where: { bookingId: { in: bookingIdsToDelete } } }),
    );
    const dNotif = await safeDel("Notification", () =>
      tx.notification.deleteMany({ where: { bookingId: { in: bookingIdsToDelete } } }),
    );
    const dCancel = await safeDel("CancellationRecord", () =>
      tx.cancellationRecord.deleteMany({
        where: { OR: [{ bookingId: { in: bookingIdsToDelete } }, { userId: { in: userIdsArr } }] },
      }),
    );
    const dBook = await safeDel("Booking", () =>
      tx.booking.deleteMany({ where: { id: { in: bookingIdsToDelete } } }),
    );
    const dCoup = await safeDel("Coupon", () =>
      tx.coupon.deleteMany({ where: { userId: { in: userIdsArr } } }),
    );
    const dMsg = await safeDel("Message", () =>
      tx.message.deleteMany({ where: { userId: { in: userIdsArr } } }),
    );
    const dCons = await safeDel("ConsultationRequest", () =>
      tx.consultationRequest.deleteMany({ where: { userId: { in: userIdsArr } } }),
    );
    const dUser = await safeDel("User", () =>
      tx.user.deleteMany({ where: { id: { in: userIdsArr } } }),
    );
    console.log(`  Payment ${dPay} · ECPayOrder ${dEcpay} · Notification ${dNotif} · Cancel ${dCancel}`);
    console.log(`  Booking ${dBook} · Coupon ${dCoup} · Message ${dMsg} · Consult ${dCons} · User ${dUser}`);
  });

  // 7. Post-flight audit
  const [histAfter, legacyAfter, otherBookingsAfter, otherUsersAfter] = await Promise.all([
    prisma.booking.count({ where: { tenantId: TENANT_ID, id: { startsWith: "hist-" } } }),
    prisma.user.count({ where: { tenantId: TENANT_ID, lineUserId: { startsWith: "legacy-" } } }),
    prisma.booking.count({ where: { tenantId: TENANT_ID, NOT: { id: { startsWith: "hist-" } } } }),
    prisma.user.count({ where: { tenantId: TENANT_ID, NOT: { lineUserId: { startsWith: "legacy-" } } } }),
  ]);
  console.log(`\nPost-state: hist-=${histAfter} legacy-=${legacyAfter} | non-hist=${otherBookingsAfter} non-legacy=${otherUsersAfter}`);
  console.log(`✓ COMMIT complete.`);
}

main()
  .catch((e) => {
    console.error("✗ Cleanup failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
