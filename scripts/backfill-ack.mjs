// One-shot: mark every existing CONFIRMED booking as already-acked so admin
// doesn't get queued on a backlog of historical bookings (Q1 = A1).
import { PrismaClient } from "@prisma/client";
import "dotenv/config";

// Prisma 7 wants a driver adapter; easiest path is using pg adapter.
import { PrismaPg } from "@prisma/adapter-pg";
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
const result = await prisma.booking.updateMany({
  where: { adminAcknowledgedAt: null },
  data: { adminAcknowledgedAt: new Date() },
});
console.log(`backfilled ${result.count} bookings as acknowledged`);
await prisma.$disconnect();
