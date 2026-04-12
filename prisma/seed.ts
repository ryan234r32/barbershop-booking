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
    { name: "男性剪髮", description: "洗髮 · 精修剪裁 · 造型完成", duration: 60, slotsNeeded: 1, price: 1000, sortOrder: 1, imageUrl: "https://lh3.googleusercontent.com/aida-public/AB6AXuCSe5e9V_7P52xeGYH5d9tVZsQmOOGdgXMx27NT_Gf1U3awXzjOyC9Ykkml4e2uCP3uEhZ3MWQpfq-5dJI1Rvwe_XwPae_tPSeqia9pzZY-0DB5CYnasDSvSUu07-ch_QBH7s4x3YgU6b-4vmw6NhLzrogrlcZcMP6Kl6LePVK4sTdC1npEjNI2NXmezVfdpbJ6JY4JHvuq37-O4b9y_SeI5FV56qFegxmREHQMLGWFNMh4aiaQygQ55F-OyFog_Q6D07kL64_IMA" },
    { name: "女性剪髮", description: "洗髮 · 剪裁設計 · 吹整造型", duration: 60, slotsNeeded: 1, price: 1100, sortOrder: 2, imageUrl: "https://lh3.googleusercontent.com/aida-public/AB6AXuB0o0kP1XoPVH99B0cLp_JnGA1qwoORO029Ee3PMzJ0R9MM2Ud4SQMvpxkL5aPXqwoOazPYJeY3Q8JkTfb8GmFfTjoL2-b48HDwN8DrCAl8_QHrTCObeND8GD3194QSRq-x5eNlj05DG_UFfCtUSZxTPcKEKGWpyhm7QiVUkql_8gXchUE0VZ4E-qSGpfUkqxNseB7xUtQ_IdeQe36H83zsk6R7fIBiix7G5dLkk8MYMac-YkBpB_5ytpIZhC1i4CCFSU-0KhlDBw" },
    // 染髮
    { name: "補染", description: "髮根補色，維持整體色澤一致", duration: 120, slotsNeeded: 2, price: 2200, sortOrder: 3, imageUrl: "https://lh3.googleusercontent.com/aida-public/AB6AXuA15VoHn9oqZpv4gF-GCxCLvoj6dVNdgavshCc3ybuFYNCGIjXV6vCg5zXu6kEHUhiJ4sduA7jHZ3gKU-l4OohitMT2Bk7NyYcLPrCN_NivYEkq8136dDwEfqVDnZyuc5a2cIQY8dM4k_6-cPxRzhieKo5wdgeqkWJyGdLrONsROOdUs0wgDCInVHe7g_5WKWVteZp0tRkbAL9mVjdwH0Nr9tPBo1ZS8J2vZarJdOHSAWqMnVjfe195aCwmypVJOTSpgkPETosXMQ" },
    { name: "漂髮", description: "專業漂色處理，依髮長定價", duration: 180, slotsNeeded: 3, price: 2600, sortOrder: 4, imageUrl: "https://lh3.googleusercontent.com/aida-public/AB6AXuDGO-my3Q_gYcNT8XvtwBWa1RqZjupQPJeWgGvuDwZSXztb1vIU-V__63yuZt7aFOCM6G3aT6ykymYqdqIL-KcZrrjsz8j2vkjvpsM9Y1U497CneZfdi2zlmDjOJVBEHplQTLvkauCUKchUbPLaGkmmyM_KoH1yHrG2mRMy_jqnmoqwFDiR81Y5MBWH7Y7dalHGdnCiuUakjqF2CRNebEWOVXb5NsnkVFqSydlE7gCxOgcPfCsDvYKQ2kl_TGqS-EBHZEDIjbamCA" },
    { name: "染髮", description: "全頭染色，打造專屬髮色", duration: 180, slotsNeeded: 3, price: 2600, sortOrder: 5, imageUrl: "https://lh3.googleusercontent.com/aida-public/AB6AXuCSyayKzq7GS3vgnM_nIJYVIl2ny325nsQqPWPxhFVnPgEcSmRT0g_KDcnnCd5yAhn_8QNj8MyLG5F4NYvMnuAtPVwOE11VKjbjHaQlSXPnIGzb8BeLlGpsk3Qw6y9kIPcpmEMk5tJCW7qAooAGU5YshdPJU8OrS7pCiryH6dxeUw6zf1VgFN1KGuYbQagrJGkGBOdoLOMnXzsZMJeaWkhtJ37O7g_av66nuPEunKw1ZzzH7Im5DZNGTEcxLsfX7aINF51Jk_GPyA" },
    // 燙髮
    { name: "溫塑燙", description: "溫感塑型，打造自然捲度", duration: 180, slotsNeeded: 3, price: 4000, sortOrder: 6, imageUrl: "https://lh3.googleusercontent.com/aida-public/AB6AXuB7uC6f6r0fuWO8CHTrSQAi6BEsllbQ4rZKQ-4FJUUX6Ybnsyr5SkWNVqkWvWZCnRML5dfm2WAqvswEXYlkPrpzgcIaNtAr4yFFZ9s9pKLqD38RESdlMc7PKg40YP9qhCzDCmuNnCQpV9DX2OUuaXO9hGZvRxQEkFRSYj5xKCNhsyx4l0KQATEpNAtisLrseeCLYCy0S1__sP0hs3ktNLbXAu5sPiAjXMprFIAItVitRpgfR9HHkjw08B_K1aqMWxAjMMwcsElxAQ" },
    { name: "縮毛矯正", description: "日式結構矯正，根除毛躁", duration: 240, slotsNeeded: 4, price: 4600, sortOrder: 7, imageUrl: "https://lh3.googleusercontent.com/aida-public/AB6AXuAwzMVMwegEnbDvvRSKvsoW6zD2ouj4HDAOszPS20HzkDLlLJ4EqnRuyBYMQ_SjASiovUaFqj-fXLyu6fQ9s8s2bdFbJpNR5pL6xJxafY54Y2BopCM32riKPtfmAtx0-4CeJyDZzTY6E3jaNILmvgoO988l-XAHejMMuk7etSaTQUmRRfMMAwIKt2UVqPi_625DNqrL1qPJ9___acmgieyzBRmfuf53EvZUzJGKmCo9TdA7OyfHCqslvPrJkY984RzXr9Xz-acCXA" },
    // 護髮
    { name: "結構式護髮", description: "深層修護，重建髮絲結構", duration: 60, slotsNeeded: 1, price: 2200, sortOrder: 8, imageUrl: "https://lh3.googleusercontent.com/aida-public/AB6AXuA14fFGQC4zEyUTT7f_oeYTZrB8MAgu4xsDpRvBxOsMGE9NHCyOLNkaosFIBl-ZCSe5As6KOiDKLryH8upBHhvjUA8EibAvDstKQTmLlhijLJW15fkFooAEMWNUGfXcRy0m69Sn2SuAzNtg5RfbdbvZqdALkm-dcsooTptpk1rCoyuk1is6HiP14Z8ln4IlqCMoQbTlhmVrW47VGiCREf1-S8DggNpIyiosBcO4dj10JXUpN5EXE3f4byFGSpGouaYm7WVi6ndafA" },
    // 頭皮調理
    { name: "頭皮調理", description: "義大利專業頭皮健康管理", duration: 60, slotsNeeded: 1, price: 2200, sortOrder: 9, imageUrl: "https://lh3.googleusercontent.com/aida-public/AB6AXuBRZsgpvwCc2EZxJLtblZ1iuuXReCX-WB8VmTnHAdKLUoX-LW4V-Po0MiKADJ_01-QvBKF1yEFzwX_we0KFKjHVijYeC-HzmKsORVo090i5IqosZ4oXsM6Gfwn-ZvubGCvl5K7a_gAbEOOx1b74AnbBB2CTx1W_mCGlfJXZ0RWbQwB23qwWQvy_tn4xPorh6Ib_mbcldZEJ03jEwURG2ZMoFzBSiVkg8evkQdfBwbB4CLg0i0aKE9lXRMLYk8UE397QwiE26Vi-bg" },
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
