/**
 * V3.7 Tier 0.2 §0a F3 — Backfill BookingService rows for all existing bookings.
 *
 * Why this exists:
 *   v3.7 adds multi-service support via BookingService[] table. The 1169 existing
 *   bookings (per MEMORY.md V3) all have a single Booking.serviceId. After
 *   `prisma db push` adds the new BookingService table, those rows would be
 *   EMPTY → reports showing service-mix would compute "0 services" for all
 *   historical data, destroying retention KPIs.
 *
 *   This script creates one BookingService row per existing booking (order=0,
 *   mirroring the legacy Booking.serviceId + Service.price + Service.duration).
 *
 * Idempotent:
 *   - Skips bookings that already have ANY BookingService row.
 *   - Safe to re-run mid-failure.
 *
 * Audit trail:
 *   - Final summary row inserted into AuditLog with model="BookingService",
 *     action="backfill", count=created, executor=$EXECUTED_BY.
 *
 * Usage:
 *   1. Run `prisma db push` to create the BookingService table (see §0a F3).
 *   2. Set EXECUTED_BY=<your-name>.
 *   3. Run `npx tsx scripts/backfill-booking-services.ts`.
 *   4. Re-run with `--dry-run` first to preview.
 *
 * Rollback:
 *   - `DELETE FROM booking_services WHERE created_at >= '<timestamp>'`
 *   - (or use AuditLog timestamp to scope)
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const DRY_RUN = process.argv.includes("--dry-run");
const EXECUTED_BY = process.env.EXECUTED_BY ?? "unknown";

// Prisma 7 needs the adapter explicitly (matches src/lib/prisma.ts pattern).
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("[backfill] DATABASE_URL missing in env");
  process.exit(1);
}
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

interface BackfillResult {
  totalBookings: number;
  alreadyHadServices: number;
  created: number;
  errors: Array<{ bookingId: string; error: string }>;
  durationMs: number;
}

async function main(): Promise<void> {
  const t0 = Date.now();
  console.log(`[backfill] DRY_RUN=${DRY_RUN} EXECUTED_BY=${EXECUTED_BY}`);

  // Stream bookings with their Service info. Page in batches of 200 to keep
  // memory predictable and let mid-run failures resume cleanly.
  const result: BackfillResult = {
    totalBookings: 0,
    alreadyHadServices: 0,
    created: 0,
    errors: [],
    durationMs: 0,
  };

  const PAGE_SIZE = 200;
  let cursor: string | undefined = undefined;
  let done = false;
  while (!done) {
    const bookings: Array<{
      id: string;
      serviceId: string;
      service: { price: number; duration: number };
      _count: { services: number };
    }> = await prisma.booking.findMany({
      take: PAGE_SIZE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: "asc" },
      select: {
        id: true,
        serviceId: true,
        service: { select: { price: true, duration: true } },
        _count: { select: { services: true } },
      },
    });
    if (bookings.length === 0) break;
    result.totalBookings += bookings.length;

    for (const b of bookings) {
      if (b._count.services > 0) {
        result.alreadyHadServices += 1;
        continue;
      }
      if (DRY_RUN) {
        result.created += 1;
        continue;
      }
      try {
        // Mirror legacy: order=0 (primary), price = service current price snapshot,
        // durationMin = service.duration. Wrap in transaction with parent updatedAt
        // bump per §0a E-B (child writes must bump parent for OCC integrity).
        await prisma.$transaction(async (tx) => {
          await tx.bookingService.create({
            data: {
              bookingId: b.id,
              serviceId: b.serviceId,
              order: 0,
              price: b.service.price,
              durationMin: b.service.duration,
            },
          });
          await tx.booking.update({
            where: { id: b.id },
            data: { updatedAt: new Date() },
          });
        });
        result.created += 1;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        result.errors.push({ bookingId: b.id, error: msg });
        console.error(`[backfill] FAILED booking=${b.id}: ${msg}`);
      }
    }

    cursor = bookings[bookings.length - 1]?.id;
    if (bookings.length < PAGE_SIZE) {
      done = true;
    } else {
      console.log(
        `[backfill] progress total=${result.totalBookings} created=${result.created} skipped=${result.alreadyHadServices} errors=${result.errors.length}`,
      );
    }
  }

  result.durationMs = Date.now() - t0;

  // Final audit log (skip in dry-run to keep audit clean).
  if (!DRY_RUN) {
    await prisma.auditLog.create({
      data: {
        model: "BookingService",
        action: "backfill",
        count: result.created,
        executor: EXECUTED_BY,
        args: {
          totalBookings: result.totalBookings,
          alreadyHadServices: result.alreadyHadServices,
          errors: result.errors.length,
        },
        durationMs: result.durationMs,
        status: result.errors.length === 0 ? "success" : `error: ${result.errors.length} failed`,
      },
    });
  }

  console.log("\n=== BACKFILL SUMMARY ===");
  console.log(`Total bookings scanned : ${result.totalBookings}`);
  console.log(`Already had services   : ${result.alreadyHadServices}`);
  console.log(`Created                : ${result.created}`);
  console.log(`Errors                 : ${result.errors.length}`);
  console.log(`Duration               : ${result.durationMs} ms`);
  if (DRY_RUN) console.log("(DRY RUN — no DB writes)");
  if (result.errors.length > 0) {
    console.log("\nFirst 5 errors:");
    for (const e of result.errors.slice(0, 5)) console.log(`  ${e.bookingId}: ${e.error}`);
    process.exit(1);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error("[backfill] fatal:", err);
    await prisma.$disconnect();
    process.exit(1);
  });
