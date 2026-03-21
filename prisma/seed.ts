import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Seeding database...");

  // 1. Create tenant
  const tenant = await prisma.tenant.upsert({
    where: { slug: "demo-barbershop" },
    update: {},
    create: {
      name: "Demo Barbershop",
      slug: "demo-barbershop",
      lineChannelId: process.env.LINE_CHANNEL_ID || "placeholder",
      lineChannelSecret: process.env.LINE_CHANNEL_SECRET || "placeholder",
      lineAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || "placeholder",
      liffId: process.env.NEXT_PUBLIC_LIFF_ID || "placeholder",
      businessName: "示範理髮廳",
      phone: "0912-345-678",
      address: "台北市中山區南京東路一段1號",
      bankInfo: "國泰世華銀行 013",
      bankAccountName: "王小明",
      bankAccountNumber: "012-34-567890-1",
    },
  });
  console.log("✅ Tenant created:", tenant.id);

  // 2. Create admin user
  const hashedPassword = await bcrypt.hash("admin123", 10);
  const admin = await prisma.adminUser.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: "admin@barbershop.com" } },
    update: {},
    create: {
      tenantId: tenant.id,
      email: "admin@barbershop.com",
      password: hashedPassword,
      name: "店長",
      role: "OWNER",
    },
  });
  console.log("✅ Admin created:", admin.email);

  // 3. Create services
  const services = [
    { name: "男生剪髮", description: "洗+剪+造型", duration: 60, slotsNeeded: 1, price: 500, sortOrder: 1 },
    { name: "女生剪髮", description: "洗+剪+造型", duration: 60, slotsNeeded: 1, price: 600, sortOrder: 2 },
    { name: "燙髮", description: "洗+剪+燙+造型", duration: 180, slotsNeeded: 3, price: 2500, sortOrder: 3 },
    { name: "染髮", description: "洗+染+護", duration: 180, slotsNeeded: 3, price: 2000, sortOrder: 4 },
    { name: "燙+染", description: "洗+剪+燙+染+護", duration: 240, slotsNeeded: 4, price: 4000, sortOrder: 5 },
  ];

  for (const s of services) {
    await prisma.service.upsert({
      where: { tenantId_name: { tenantId: tenant.id, name: s.name } },
      update: { ...s },
      create: { tenantId: tenant.id, ...s },
    });
  }
  console.log("✅ Services created:", services.length);

  // 4. Create business hours (Mon-Sat: 11:00-20:00, Sun: closed)
  const days = [
    { dayOfWeek: 0, isOpen: false, startTime: "11:00", endTime: "20:00" }, // Sunday
    { dayOfWeek: 1, isOpen: true, startTime: "11:00", endTime: "20:00" },
    { dayOfWeek: 2, isOpen: true, startTime: "11:00", endTime: "20:00" },
    { dayOfWeek: 3, isOpen: true, startTime: "11:00", endTime: "20:00" },
    { dayOfWeek: 4, isOpen: true, startTime: "11:00", endTime: "20:00" },
    { dayOfWeek: 5, isOpen: true, startTime: "11:00", endTime: "20:00" },
    { dayOfWeek: 6, isOpen: true, startTime: "11:00", endTime: "20:00" }, // Saturday
  ];

  for (const d of days) {
    await prisma.businessHours.upsert({
      where: { tenantId_dayOfWeek: { tenantId: tenant.id, dayOfWeek: d.dayOfWeek } },
      update: d,
      create: { tenantId: tenant.id, ...d },
    });
  }
  console.log("✅ Business hours created");

  console.log("\n🎉 Seed complete!");
  console.log(`\n📋 Important IDs:\n  Tenant ID: ${tenant.id}\n  Admin: ${admin.email} / admin123`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
