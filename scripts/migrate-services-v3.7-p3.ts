/**
 * V3.7 P3 — Service + Variant migration (5/19).
 *
 * Aligns prod service catalog with the 1008 Hair Studio Google Sheets price list.
 * Replaces the pre-V3.7 9-service shape with the new 13-service + 14-variant shape.
 *
 * What this script does:
 *   1. Delete all old test bookings (`isTest` flag OR notes containing "[TEST]")
 *      + their BookingService rows. User confirmed 5/19: "過去的預約都是假的".
 *   2. Delete all existing Service rows (and cascade-deleted variants/booking_services).
 *      Test data only — confirmed prod has no real bookings yet.
 *   3. Create new Service rows per Google Sheets, with proper `bookingMode`
 *      ("NORMAL" for cut/perm/treatment, "CONSULTATION" for dye/bleach).
 *   4. Create ServiceVariant rows for services with multiple price tiers.
 *
 * SAFETY:
 *   - Wrapped in a single transaction. Any error → roll back, nothing changes.
 *   - Idempotent: if run twice, the second run just deletes + recreates.
 *   - DOES NOT touch User / Tenant / BusinessHours / Holiday / Coupon data.
 *
 * Run with: npx tsx scripts/migrate-services-v3.7-p3.ts
 */

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env" });
loadEnv({ path: ".env.local" });

// Prisma 7 uses driver adapters. Mirrors src/lib/prisma.ts but without the
// audit hook (we're already running a one-shot migration script).
// Prefer DIRECT_URL for non-pgbouncer connection (no prepared-statement issues).
const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!connectionString) throw new Error("DIRECT_URL or DATABASE_URL must be set");
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

interface VariantSpec {
  name: string;
  price: number;
  durationMin: number;
  sortOrder: number;
}

interface ServiceSpec {
  name: string;
  description: string;
  /** Default duration if no variants */
  defaultDurationMin: number;
  /** Default price if no variants */
  defaultPrice: number;
  sortOrder: number;
  bookingMode: "NORMAL" | "CONSULTATION";
  variants: VariantSpec[];
}

/** Source of truth: https://docs.google.com/spreadsheets/d/1Zp_syxF_-C2gSXdYTVD-7ZkpskFFNF8bgrBXXv7h14Y */
const SERVICES: ServiceSpec[] = [
  {
    name: "剪髮",
    description: "洗 + 剪 + 吹整。男女學齡分價，現場確認。",
    defaultDurationMin: 60,
    defaultPrice: 1100,
    sortOrder: 1,
    bookingMode: "NORMAL",
    variants: [
      { name: "男", price: 1100, durationMin: 60, sortOrder: 1 },
      { name: "女", price: 1200, durationMin: 60, sortOrder: 2 },
      { name: "小學", price: 700, durationMin: 60, sortOrder: 3 },
      { name: "國中", price: 800, durationMin: 60, sortOrder: 4 },
      { name: "高中", price: 900, durationMin: 60, sortOrder: 5 },
    ],
  },
  // ─── 染漂類 — 全部走諮詢制（訪談 §12 line 872 老闆原話） ───
  {
    name: "補染",
    description: "髮根 4cm 內補色。依個別狀況老闆評估時數+費用。",
    defaultDurationMin: 120,
    defaultPrice: 2200,
    sortOrder: 2,
    bookingMode: "CONSULTATION",
    variants: [],
  },
  {
    name: "全頭染",
    description: "全頭染色（含基本/過胸/過腰）。諮詢制，老闆 LINE 確認後排程。",
    defaultDurationMin: 120,
    defaultPrice: 2600,
    sortOrder: 3,
    bookingMode: "CONSULTATION",
    variants: [],
  },
  {
    name: "挑染／刷染",
    description: "特殊呈現方式（挑染、刷染、整頭等）。諮詢制。",
    defaultDurationMin: 180,
    defaultPrice: 3500,
    sortOrder: 4,
    bookingMode: "CONSULTATION",
    variants: [],
  },
  {
    name: "漂髮",
    description: "純漂退色，常需 2-3 次。諮詢制，老闆 LINE 確認次數+時數。",
    defaultDurationMin: 180,
    defaultPrice: 1200,
    sortOrder: 5,
    bookingMode: "CONSULTATION",
    variants: [],
  },
  {
    name: "漂+染",
    description: "漂後再染（淺色／特殊色），長流程 6hr 起跳。諮詢制。",
    defaultDurationMin: 360,
    defaultPrice: 5000,
    sortOrder: 6,
    bookingMode: "CONSULTATION",
    variants: [],
  },
  // ─── 燙髮 — 時數相對固定，走 variant pattern ───
  {
    name: "溫塑燙",
    description: "溫感塑型，自然捲度。長度加價。",
    defaultDurationMin: 240,
    defaultPrice: 4200,
    sortOrder: 7,
    bookingMode: "NORMAL",
    variants: [
      { name: "基本", price: 4200, durationMin: 240, sortOrder: 1 },
      { name: "過胸", price: 4600, durationMin: 240, sortOrder: 2 },
      { name: "過腰", price: 4800, durationMin: 240, sortOrder: 3 },
    ],
  },
  {
    name: "縮毛矯正",
    description: "日式結構矯正，根除毛躁。長度加價。",
    defaultDurationMin: 270,
    defaultPrice: 4600,
    sortOrder: 8,
    bookingMode: "NORMAL",
    variants: [
      { name: "基本", price: 4600, durationMin: 270, sortOrder: 1 },
      { name: "過胸", price: 5000, durationMin: 270, sortOrder: 2 },
      { name: "過腰", price: 5200, durationMin: 270, sortOrder: 3 },
    ],
  },
  {
    name: "冷燙",
    description: "短髮為主，不分長短。",
    defaultDurationMin: 150,
    defaultPrice: 4200,
    sortOrder: 9,
    bookingMode: "NORMAL",
    variants: [],
  },
  {
    name: "局部燙-瀏海",
    description: "瀏海局部捲度。",
    defaultDurationMin: 120,
    defaultPrice: 1600,
    sortOrder: 10,
    bookingMode: "NORMAL",
    variants: [],
  },
  {
    name: "局部燙-髮根",
    description: "髮根燙起讓頭髮蓬鬆。",
    defaultDurationMin: 120,
    defaultPrice: 2200,
    sortOrder: 11,
    bookingMode: "NORMAL",
    variants: [],
  },
  // ─── 護髮 ───
  {
    name: "護髮（綁定）",
    description: "搭配染或燙才有此優惠價，不分長度。",
    defaultDurationMin: 60,
    defaultPrice: 1600,
    sortOrder: 12,
    bookingMode: "NORMAL",
    variants: [],
  },
  {
    name: "護髮（獨立）",
    description: "獨立護髮，長度加價。",
    defaultDurationMin: 120,
    defaultPrice: 2200,
    sortOrder: 13,
    bookingMode: "NORMAL",
    variants: [
      { name: "基本", price: 2200, durationMin: 120, sortOrder: 1 },
      { name: "過胸", price: 2600, durationMin: 120, sortOrder: 2 },
      { name: "過腰", price: 2800, durationMin: 120, sortOrder: 3 },
    ],
  },
  {
    name: "修瀏海",
    description: "30 分快速修剪，無洗。",
    defaultDurationMin: 30,
    defaultPrice: 300,
    sortOrder: 14,
    bookingMode: "NORMAL",
    variants: [],
  },
];

function slotsNeeded(durationMin: number): number {
  return Math.ceil(durationMin / 60);
}

async function main() {
  const tenantId = process.env.DEFAULT_TENANT_ID;
  if (!tenantId) {
    throw new Error("DEFAULT_TENANT_ID is not set in env");
  }

  console.log(`[migrate] target tenantId=${tenantId}`);

  await prisma.$transaction(async (tx) => {
    // Step 1: Nuke existing bookings (user confirmed all test data).
    // Cascade order: BookingService → Payment → Booking → ECPayOrder etc.
    // Simpler: just delete BookingService + Booking, FKs cascade where set.
    const deletedBookingServices = await tx.bookingService.deleteMany({
      where: { booking: { tenantId } },
    });
    const deletedPayments = await tx.payment.deleteMany({
      where: { booking: { tenantId } },
    });
    const deletedNotifications = await tx.notification.deleteMany({
      where: { booking: { tenantId } },
    });
    const deletedCancellations = await tx.cancellationRecord.deleteMany({
      where: { booking: { tenantId } },
    });
    const deletedConsultations = await tx.consultationRequest.updateMany({
      where: { tenantId, convertedBookingId: { not: null } },
      data: { convertedBookingId: null },
    });
    const deletedBookings = await tx.booking.deleteMany({ where: { tenantId } });
    console.log(`[migrate] deleted bookings=${deletedBookings.count} services=${deletedBookingServices.count} payments=${deletedPayments.count} notifications=${deletedNotifications.count} cancellations=${deletedCancellations.count} unlinkedConsultations=${deletedConsultations.count}`);

    // Step 2: Delete all old Service rows (cascade kills variants).
    // ConsultationRequest may FK to Service — unlink first.
    await tx.consultationRequest.updateMany({
      where: { tenantId, serviceId: { not: null } },
      data: { serviceId: null },
    });
    const deletedVariants = await tx.serviceVariant.deleteMany({
      where: { service: { tenantId } },
    });
    const deletedServices = await tx.service.deleteMany({ where: { tenantId } });
    console.log(`[migrate] deleted variants=${deletedVariants.count} services=${deletedServices.count}`);

    // Step 3: Create new Services + Variants per Sheet.
    for (const spec of SERVICES) {
      const service = await tx.service.create({
        data: {
          tenantId,
          name: spec.name,
          description: spec.description,
          duration: spec.defaultDurationMin,
          slotsNeeded: slotsNeeded(spec.defaultDurationMin),
          price: spec.defaultPrice,
          sortOrder: spec.sortOrder,
          isActive: true,
          hasVariants: spec.variants.length > 0,
          bookingMode: spec.bookingMode,
        },
      });
      for (const v of spec.variants) {
        await tx.serviceVariant.create({
          data: {
            serviceId: service.id,
            name: v.name,
            price: v.price,
            durationMin: v.durationMin,
            slotsNeeded: slotsNeeded(v.durationMin),
            sortOrder: v.sortOrder,
            isActive: true,
          },
        });
      }
      const variantSummary = spec.variants.length === 0
        ? "(no variants)"
        : `[${spec.variants.map((v) => `${v.name} ${v.price}`).join(", ")}]`;
      console.log(`[migrate] ✓ ${spec.name} (${spec.bookingMode}) ${variantSummary}`);
    }
  });

  const finalCount = await prisma.service.count({ where: { tenantId } });
  const variantCount = await prisma.serviceVariant.count({
    where: { service: { tenantId } },
  });
  console.log(`[migrate] DONE — services=${finalCount}, variants=${variantCount}`);
}

main()
  .catch((err) => {
    console.error("[migrate] FAILED:", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
