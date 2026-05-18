import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const appBaseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://barbershop-booking-swart.vercel.app";
const serviceImageUrl = (filename: string) =>
  new URL(`/service-images/${filename}`, appBaseUrl).toString();

async function main() {
  console.log("🌱 Seeding database...");

  // Clean existing data (re-seed safe)
  await prisma.notification.deleteMany();
  await prisma.cancellationRecord.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.businessHours.deleteMany();
  await prisma.holiday.deleteMany();
  await prisma.service.deleteMany();
  await prisma.user.deleteMany();
  await prisma.adminUser.deleteMany();
  await prisma.tenant.deleteMany();
  console.log("🧹 Cleaned existing data");

  // 1. Create tenant — 1008 Hair Studio
  const tenant = await prisma.tenant.create({
    data: {
      name: "1008 Hair Studio",
      slug: "1008-hair-studio",
      lineChannelId: process.env.LINE_CHANNEL_ID || "placeholder",
      lineChannelSecret: process.env.LINE_CHANNEL_SECRET || "placeholder",
      lineAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || "placeholder",
      liffId: process.env.NEXT_PUBLIC_LIFF_ID || "placeholder",
      businessName: "1008 Hair Studio",
      phone: "02-2396-2306",
      address: "台北市中正區新生南路一段144-10號",
      bankInfo: "待設定",
      bankAccountName: "待設定",
      bankAccountNumber: "待設定",
    },
  });
  console.log("✅ Tenant created:", tenant.id);

  // 2. Create admin user
  const hashedPassword = await bcrypt.hash("admin123", 10);
  const admin = await prisma.adminUser.create({
    data: {
      tenantId: tenant.id,
      email: "admin@1008hair.com",
      password: hashedPassword,
      name: "店長",
      role: "OWNER",
    },
  });
  console.log("✅ Admin created:", admin.email);

  // 3. Create services — 對齊 1008 Hair Studio Google Sheets 價目表
  //    Source of truth: https://docs.google.com/spreadsheets/d/1Zp_syxF_-C2gSXdYTVD-7ZkpskFFNF8bgrBXXv7h14Y
  //    5/18 老闆 audit：男 1100、女 1200、護髮（不要寫「結構式」）綁定 1600。
  //    Slot model 仍 1hr = 1 slot（V3.7 Tier 1.4 admin 0.5hr 是 start-time offset，
  //    不動 slot model），所以 2.5hr 冷燙等需走 admin 後台手動排程。
  const services = [
    // 剪髮（含洗）
    { name: "男性剪髮", description: "洗髮 · 精修剪裁 · 造型完成", duration: 60, slotsNeeded: 1, price: 1100, sortOrder: 1, imageUrl: serviceImageUrl("mens-haircut.jpg") },
    { name: "女性剪髮", description: "洗髮 · 剪裁設計 · 吹整造型", duration: 60, slotsNeeded: 1, price: 1200, sortOrder: 2, imageUrl: serviceImageUrl("womens-haircut.jpg") },
    // 染髮
    { name: "補染", description: "髮根 4cm 內補色", duration: 120, slotsNeeded: 2, price: 2200, sortOrder: 3, imageUrl: serviceImageUrl("root-touch-up.jpg") },
    { name: "染髮", description: "全頭染色（過胸 / 過腰加價，現場確認）", duration: 120, slotsNeeded: 2, price: 2600, sortOrder: 4, imageUrl: serviceImageUrl("hair-color.jpg") },
    // 燙髮
    { name: "溫塑燙", description: "溫感塑型（過胸 / 過腰加價，現場確認）", duration: 240, slotsNeeded: 4, price: 4200, sortOrder: 5, imageUrl: serviceImageUrl("digital-perm.jpg") },
    { name: "縮毛矯正", description: "日式結構矯正，根除毛躁", duration: 270, slotsNeeded: 4, price: 4600, sortOrder: 6, imageUrl: serviceImageUrl("straightening.jpg") },
    // 漂髮（諮詢制，價目用單次起跳）
    { name: "漂髮", description: "單次起跳，染漂組合需先諮詢", duration: 180, slotsNeeded: 3, price: 1200, sortOrder: 7, imageUrl: serviceImageUrl("bleach.jpg") },
    // 護髮（綁定優惠：染或燙搭配只要 1600，獨立 2200 起）
    { name: "護髮", description: "綁定染或燙的優惠價（獨立護髮 2200 起）", duration: 60, slotsNeeded: 1, price: 1600, sortOrder: 8, imageUrl: serviceImageUrl("hair-treatment.jpg") },
    // 修瀏海
    { name: "修瀏海", description: "30 分快速修剪", duration: 30, slotsNeeded: 1, price: 300, sortOrder: 9 },
  ];

  for (const s of services) {
    await prisma.service.create({
      data: { tenantId: tenant.id, ...s },
    });
  }
  console.log("✅ Services created:", services.length);

  // 4. Create business hours (週一公休，週二到週日 11:00-20:00)
  const days = [
    { dayOfWeek: 0, isOpen: true, startTime: "11:00", endTime: "20:00" },  // 週日
    { dayOfWeek: 1, isOpen: false, startTime: "11:00", endTime: "20:00" }, // 週一公休
    { dayOfWeek: 2, isOpen: true, startTime: "11:00", endTime: "20:00" },  // 週二
    { dayOfWeek: 3, isOpen: true, startTime: "11:00", endTime: "20:00" },  // 週三
    { dayOfWeek: 4, isOpen: true, startTime: "11:00", endTime: "20:00" },  // 週四
    { dayOfWeek: 5, isOpen: true, startTime: "11:00", endTime: "20:00" },  // 週五
    { dayOfWeek: 6, isOpen: true, startTime: "11:00", endTime: "20:00" },  // 週六
  ];

  for (const d of days) {
    await prisma.businessHours.create({
      data: { tenantId: tenant.id, ...d },
    });
  }
  console.log("✅ Business hours created");

  console.log("\n🎉 Seed complete!");
  console.log(`\n📋 Important IDs:`);
  console.log(`  Tenant ID: ${tenant.id}`);
  console.log(`  Admin: ${admin.email} / admin123`);
  console.log(`\n⚠️  請將 Tenant ID 填入 .env 的 DEFAULT_TENANT_ID`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
