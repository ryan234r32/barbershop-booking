import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

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

  // 3. Create services — 根據 1008 Hair Studio 真實價目表
  const services = [
    // 剪髮
    { name: "男性剪髮", description: "洗+剪+造型", duration: 60, slotsNeeded: 1, price: 1000, sortOrder: 1 },
    { name: "女性剪髮", description: "洗+剪+造型", duration: 60, slotsNeeded: 1, price: 1100, sortOrder: 2 },
    // 染髮
    { name: "補染", description: "補染髮根", duration: 120, slotsNeeded: 2, price: 2200, sortOrder: 3 },
    { name: "漂髮", description: "漂髮（價格依長度調整）", duration: 180, slotsNeeded: 3, price: 2600, sortOrder: 4 },
    { name: "染髮", description: "全染（價格依長度調整）", duration: 180, slotsNeeded: 3, price: 2600, sortOrder: 5 },
    // 燙髮
    { name: "溫塑燙", description: "溫塑燙（價格依長度調整）", duration: 180, slotsNeeded: 3, price: 4000, sortOrder: 6 },
    { name: "縮毛矯正", description: "縮毛矯正（價格依長度調整）", duration: 240, slotsNeeded: 4, price: 4600, sortOrder: 7 },
    // 護髮
    { name: "結構式護髮", description: "深層結構式護髮", duration: 60, slotsNeeded: 1, price: 2200, sortOrder: 8 },
    // 頭皮調理
    { name: "頭皮調理", description: "義大利頭皮健康調理系統（價格依狀況調整）", duration: 60, slotsNeeded: 1, price: 2200, sortOrder: 9 },
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
