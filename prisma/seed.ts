/**
 * V3.7 P3 (5/19) — 1008 Hair Studio seed data.
 *
 * Aligns with Google Sheets price list:
 *   https://docs.google.com/spreadsheets/d/1Zp_syxF_-C2gSXdYTVD-7ZkpskFFNF8bgrBXXv7h14Y
 *
 * Service structure:
 *   - 14 services, 14 variants
 *   - Cut/perm/treatment with length-based pricing → ServiceVariant rows
 *   - Dye/bleach → bookingMode = "CONSULTATION" (LIFF 引導 LINE OA, 老闆後台手動排程)
 *
 * For prod data migration (fresh prod has no real bookings yet), use:
 *   npx tsx scripts/migrate-services-v3.7-p3.ts
 */

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DIRECT_URL or DATABASE_URL must be set");
}
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

function serviceImageUrl(filename: string): string {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "";
  return `${base}/service-images/${filename}`;
}

function slotsNeeded(durationMin: number): number {
  return Math.ceil(durationMin / 60);
}

interface VariantSpec {
  name: string;
  price: number;
  durationMin: number;
  sortOrder: number;
}

interface ServiceSpec {
  name: string;
  description: string;
  defaultDurationMin: number;
  defaultPrice: number;
  sortOrder: number;
  bookingMode: "NORMAL" | "CONSULTATION";
  imageFile?: string;
  variants: VariantSpec[];
}

const SERVICES: ServiceSpec[] = [
  {
    name: "剪髮",
    description: "洗 + 剪 + 吹整。男女學齡分價。",
    defaultDurationMin: 60,
    defaultPrice: 1100,
    sortOrder: 1,
    bookingMode: "NORMAL",
    imageFile: "mens-haircut.jpg",
    variants: [
      { name: "男", price: 1100, durationMin: 60, sortOrder: 1 },
      { name: "女", price: 1200, durationMin: 60, sortOrder: 2 },
      { name: "小學", price: 700, durationMin: 60, sortOrder: 3 },
      { name: "國中", price: 800, durationMin: 60, sortOrder: 4 },
      { name: "高中", price: 900, durationMin: 60, sortOrder: 5 },
    ],
  },
  {
    name: "補染",
    description: "髮根 4cm 內補色。諮詢制。",
    defaultDurationMin: 120,
    defaultPrice: 2200,
    sortOrder: 2,
    bookingMode: "CONSULTATION",
    imageFile: "root-touch-up.jpg",
    variants: [],
  },
  {
    name: "全頭染",
    description: "全頭染色（基本/過胸/過腰）。諮詢制。",
    defaultDurationMin: 120,
    defaultPrice: 2600,
    sortOrder: 3,
    bookingMode: "CONSULTATION",
    imageFile: "hair-color.jpg",
    variants: [],
  },
  {
    name: "挑染／刷染",
    description: "特殊呈現方式。諮詢制。",
    defaultDurationMin: 180,
    defaultPrice: 3500,
    sortOrder: 4,
    bookingMode: "CONSULTATION",
    variants: [],
  },
  {
    name: "漂髮",
    description: "純漂退色，常需 2-3 次。諮詢制。",
    defaultDurationMin: 180,
    defaultPrice: 1200,
    sortOrder: 5,
    bookingMode: "CONSULTATION",
    imageFile: "bleach.jpg",
    variants: [],
  },
  // 5/19 老闆：「漂+染」可多選達成，不獨立 service.
  {
    name: "溫塑燙",
    description: "溫感塑型。長度加價。",
    defaultDurationMin: 240,
    defaultPrice: 4200,
    sortOrder: 7,
    bookingMode: "NORMAL",
    imageFile: "digital-perm.jpg",
    variants: [
      { name: "基本", price: 4200, durationMin: 240, sortOrder: 1 },
      { name: "過胸", price: 4600, durationMin: 240, sortOrder: 2 },
      { name: "過腰", price: 4800, durationMin: 240, sortOrder: 3 },
    ],
  },
  {
    name: "縮毛矯正",
    description: "日式結構矯正。長度加價。",
    defaultDurationMin: 270,
    defaultPrice: 4600,
    sortOrder: 8,
    bookingMode: "NORMAL",
    imageFile: "straightening.jpg",
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
    description: "髮根燙讓頭髮蓬鬆。",
    defaultDurationMin: 120,
    defaultPrice: 2200,
    sortOrder: 11,
    bookingMode: "NORMAL",
    variants: [],
  },
  {
    name: "護髮（綁定）",
    description: "搭配染或燙的優惠價，不分長度。",
    defaultDurationMin: 60,
    defaultPrice: 1600,
    sortOrder: 12,
    bookingMode: "NORMAL",
    imageFile: "hair-treatment.jpg",
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

async function main() {
  // 1. Create demo tenant
  const tenant = await prisma.tenant.upsert({
    where: { id: "39662028-4caf-4149-9b2a-bc37087c0272" },
    update: {},
    create: {
      id: "39662028-4caf-4149-9b2a-bc37087c0272",
      name: "1008 Hair Studio",
      slug: "1008-hair-studio",
      businessName: "1008 Hair Studio",
      phone: "02-2396-2306",
      address: "台北市中正區新生南路一段144-10號",
      lineChannelId: "demo-channel-id",
      lineChannelSecret: "demo-secret",
      lineAccessToken: "demo-token",
      liffId: "demo-liff",
    },
  });
  console.log("✅ Tenant ready:", tenant.businessName);

  // 2. Business hours (Mon-Sun 11:00-20:00, all open by default)
  for (let dow = 0; dow < 7; dow++) {
    await prisma.businessHours.upsert({
      where: { tenantId_dayOfWeek: { tenantId: tenant.id, dayOfWeek: dow } },
      update: { startTime: "11:00", endTime: "20:00", isOpen: true },
      create: {
        tenantId: tenant.id,
        dayOfWeek: dow,
        startTime: "11:00",
        endTime: "20:00",
        isOpen: true,
      },
    });
  }
  console.log("✅ Business hours seeded (7 days, 11:00-20:00)");

  // 3. Create services + variants per Google Sheets.
  // Idempotent: re-running drops + recreates by name.
  for (const spec of SERVICES) {
    const existing = await prisma.service.findUnique({
      where: { tenantId_name: { tenantId: tenant.id, name: spec.name } },
    });
    if (existing) {
      await prisma.serviceVariant.deleteMany({ where: { serviceId: existing.id } });
      await prisma.service.delete({ where: { id: existing.id } });
    }
    const service = await prisma.service.create({
      data: {
        tenantId: tenant.id,
        name: spec.name,
        description: spec.description,
        duration: spec.defaultDurationMin,
        slotsNeeded: slotsNeeded(spec.defaultDurationMin),
        price: spec.defaultPrice,
        sortOrder: spec.sortOrder,
        isActive: true,
        hasVariants: spec.variants.length > 0,
        bookingMode: spec.bookingMode,
        imageUrl: spec.imageFile ? serviceImageUrl(spec.imageFile) : null,
      },
    });
    for (const v of spec.variants) {
      await prisma.serviceVariant.create({
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
  }
  console.log(`✅ Services seeded: ${SERVICES.length} services, ${SERVICES.reduce((n, s) => n + s.variants.length, 0)} variants`);

  console.log("\n🎉 Seed complete.");
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
