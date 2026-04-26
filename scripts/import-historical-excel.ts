/**
 * Historical Excel → DB import (PRD-v3 §10.1, Wave 3.B).
 *
 * Run:
 *   npx tsx scripts/import-historical-excel.ts          # dry-run, prints stats
 *   npx tsx scripts/import-historical-excel.ts --commit # actually writes DB
 *   npx tsx scripts/import-historical-excel.ts --commit --reset  # purge prior import then write
 *
 * Behaviour:
 *  - Writes to DEFAULT_TENANT_ID (production 1008 Hair Studio tenant).
 *  - Upserts customers by synthetic lineUserId `legacy-{slug}-{tenantSlug}`
 *    so re-runs don't create duplicates.
 *  - Booking.id is deterministic SHA-1 hash(tenantId+date+startTime+name) prefixed
 *    `hist-` so idempotent re-runs are safe (skip existing).
 *  - Booking.status = COMPLETED, source = WALK_IN, adminAcknowledgedAt = importTime.
 *  - Payment.status = RECEIVED, amount = Excel amount (preserves historical pricing
 *    variation), method = BANK_TRANSFER if cell font color is red, else CASH.
 *  - Booking.notes records the original Excel service name + monthSheet for traceability.
 *  - --reset deletes all bookings whose id starts with `hist-` plus their payments,
 *    plus customers whose lineUserId starts with `legacy-`.
 */

import "dotenv/config";
import * as path from "path";
import { createHash } from "node:crypto";
import ExcelJS from "exceljs";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const EXCEL_FILE = path.join(__dirname, "..", "docs", "2025預約表Ken老師.xlsx");
const MONTH_SHEET_PATTERN = /^2025\d{2}$/;

const DRY_RUN = !process.argv.includes("--commit");
const RESET = process.argv.includes("--reset");
const TENANT_ID = process.env.DEFAULT_TENANT_ID;
if (!TENANT_ID) {
  console.error("✗ DEFAULT_TENANT_ID env var required");
  process.exit(1);
}

interface WD { svc: number; cust: number; amt: number; }
const WEEKDAYS_LAYOUT: WD[] = [
  { svc: 2, cust: 3, amt: 4 },     // Mon
  { svc: 5, cust: 6, amt: 7 },     // Tue
  { svc: 9, cust: 10, amt: 11 },   // Thu
  { svc: 12, cust: 13, amt: 14 },  // Fri
  { svc: 15, cust: 16, amt: 17 },  // Sat
  { svc: 18, cust: 19, amt: 20 },  // Sun
];

const NON_BOOKING_PATTERN =
  /(休假|體檢|門診|請假|公休|漲價|回診|掛|法院|廠商|傢俱|傢具|診所)/;

function readStr(c: ExcelJS.Cell): string {
  const v = c.value;
  if (v == null) return "";
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "object" && "result" in v)
    return String((v as { result: unknown }).result ?? "").trim();
  if (typeof v === "object" && "richText" in v)
    return (v as { richText: { text: string }[] }).richText.map((r) => r.text).join("").trim();
  return String(v).trim();
}

function readDate(c: ExcelJS.Cell): Date | null {
  const v = c.value;
  if (v instanceof Date) return v;
  if (typeof v === "number") return new Date(v);
  return null;
}

/**
 * Detect red font on a cell. ARGB hex starts with FF for opacity.
 * Heuristic: high R + low G/B = red.
 */
function isRedFont(cell: ExcelJS.Cell): boolean {
  const font = cell.font;
  if (!font?.color) return false;
  const argb = (font.color as { argb?: string }).argb;
  if (!argb || argb.length !== 8) return false;
  const r = parseInt(argb.slice(2, 4), 16);
  const g = parseInt(argb.slice(4, 6), 16);
  const b = parseInt(argb.slice(6, 8), 16);
  return r >= 200 && g <= 80 && b <= 80;
}

interface RawBooking {
  monthSheet: string;
  date: Date;
  hour: number;
  serviceName: string;
  customerName: string;
  amount: number | null;
  isNewCustomer: boolean;
  isBankTransfer: boolean;
}

function parseSheet(ws: ExcelJS.Worksheet): RawBooking[] {
  const out: RawBooking[] = [];
  const blocks: number[] = [];
  for (let r = 1; r <= ws.rowCount; r++) {
    if (readStr(ws.getCell(r, 1)) === "時間") blocks.push(r);
  }
  for (const bs of blocks) {
    const dr = ws.getRow(bs + 1);
    const dates = WEEKDAYS_LAYOUT.map((w) => readDate(dr.getCell(w.svc)));
    for (let h = 0; h < 9; h++) {
      const hour = 11 + h;
      const rowNum = bs + 2 + h;
      if (rowNum > ws.rowCount) break;
      const row = ws.getRow(rowNum);
      WEEKDAYS_LAYOUT.forEach((w, idx) => {
        const date = dates[idx];
        if (!date) return;
        const svcCell = row.getCell(w.svc);
        const svc = readStr(svcCell);
        const cust = readStr(row.getCell(w.cust));
        if (!svc && !cust) return;
        if (NON_BOOKING_PATTERN.test(cust) || NON_BOOKING_PATTERN.test(svc)) return;

        const amtStr = readStr(row.getCell(w.amt));
        const amtMatch = /^(\d+)/.exec(amtStr);
        const amount = amtMatch ? parseInt(amtMatch[1], 10) : null;

        if (!svc && amount == null) return; // placeholder noise

        const amtCell = row.getCell(w.amt);
        const isBankTransfer = isRedFont(svcCell) || isRedFont(amtCell);

        out.push({
          monthSheet: ws.name,
          date,
          hour,
          serviceName: svc,
          customerName: cust || "未具名",
          amount,
          isNewCustomer: svc.startsWith("新"),
          isBankTransfer,
        });
      });
    }
  }
  return out;
}

interface ServiceRecord {
  id: string;
  name: string;
  slotsNeeded: number;
  price: number;
}

function buildServiceMapper(services: ServiceRecord[]) {
  const byName = new Map(services.map((s) => [s.name, s]));
  const find = (n: string) => byName.get(n);

  const FALLBACK_PRIORITY = ["男性剪髮", "女性剪髮"];
  let fallback: ServiceRecord | undefined;
  for (const name of FALLBACK_PRIORITY) {
    fallback = find(name);
    if (fallback) break;
  }
  if (!fallback) fallback = services[0];
  if (!fallback) throw new Error("Tenant has no services — cannot import.");

  return (raw: string): { service: ServiceRecord; matched: string } => {
    const found = (n: string, label: string) => {
      const s = find(n);
      return s ? { service: s, matched: label } : null;
    };
    if (raw.includes("男剪") || raw.includes("男性剪髮"))
      return found("男性剪髮", "男性剪髮") ?? { service: fallback!, matched: "男性剪髮 (fallback)" };
    if (raw.includes("女剪") || raw.includes("女性剪髮"))
      return found("女性剪髮", "女性剪髮") ?? { service: fallback!, matched: "女性剪髮 (fallback)" };
    if (raw.includes("學童剪") || raw.includes("學生剪"))
      return found("男性剪髮", "男性剪髮 (學童)") ?? { service: fallback!, matched: "學童剪 (fallback)" };
    if (raw.includes("瀏海") || raw.includes("修剪"))
      return found("男性剪髮", "男性剪髮 (修瀏海)") ?? { service: fallback!, matched: "修瀏海 (fallback)" };

    if (raw.includes("漂"))
      return found("漂髮", "漂髮") ?? { service: fallback!, matched: "漂髮 (fallback)" };
    if (raw.includes("補染"))
      return found("補染", "補染") ?? { service: fallback!, matched: "補染 (fallback)" };
    if (raw.includes("染"))
      return found("染髮", "染髮") ?? { service: fallback!, matched: "染髮 (fallback)" };
    if (raw.includes("矯正"))
      return found("縮毛矯正", "縮毛矯正") ?? { service: fallback!, matched: "縮毛矯正 (fallback)" };
    if (raw.includes("燙"))
      return found("溫塑燙", "溫塑燙") ?? { service: fallback!, matched: "溫塑燙 (fallback)" };
    if (raw.includes("護"))
      return found("結構式護髮", "結構式護髮") ?? { service: fallback!, matched: "結構式護髮 (fallback)" };
    if (raw.includes("頭皮"))
      return found("頭皮調理", "頭皮調理") ?? { service: fallback!, matched: "頭皮調理 (fallback)" };
    if (raw.includes("剪"))
      return found("男性剪髮", "男性剪髮 (其他剪)") ?? { service: fallback!, matched: "其他剪 (fallback)" };

    return { service: fallback!, matched: `未明 (raw: ${raw || "(空)"})` };
  };
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "anon";
}

function deterministicBookingId(
  tenantId: string,
  dateIso: string,
  startTime: string,
  customerSlug: string,
): string {
  const h = createHash("sha1")
    .update(`${tenantId}::${dateIso}::${startTime}::${customerSlug}`)
    .digest("hex")
    .slice(0, 24);
  return `hist-${h}`;
}

async function main() {
  console.log(`=== Historical Excel Import (${DRY_RUN ? "DRY-RUN" : "COMMIT"}) ===\n`);

  const tenant = await prisma.tenant.findUnique({
    where: { id: TENANT_ID },
    select: { id: true, slug: true, businessName: true },
  });
  if (!tenant) throw new Error(`Tenant ${TENANT_ID} not found.`);
  console.log(`Tenant: ${tenant.businessName} (${tenant.slug})\n`);

  const services: ServiceRecord[] = await prisma.service.findMany({
    where: { tenantId: tenant.id },
    select: { id: true, name: true, slotsNeeded: true, price: true },
    orderBy: { sortOrder: "asc" },
  });
  console.log(`Services in DB: ${services.length}`);
  services.forEach((s) => console.log(`  - ${s.name} (${s.slotsNeeded}h, NT$${s.price})`));
  console.log();

  if (RESET && !DRY_RUN) {
    console.log("--- RESET: purging prior import ---");
    const delPay = await prisma.payment.deleteMany({
      where: { booking: { tenantId: tenant.id, id: { startsWith: "hist-" } } },
    });
    const delBook = await prisma.booking.deleteMany({
      where: { tenantId: tenant.id, id: { startsWith: "hist-" } },
    });
    const delUser = await prisma.user.deleteMany({
      where: { tenantId: tenant.id, lineUserId: { startsWith: "legacy-" } },
    });
    console.log(`  deleted ${delPay.count} payments, ${delBook.count} bookings, ${delUser.count} users\n`);
  }

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(EXCEL_FILE);

  const allRaw: RawBooking[] = [];
  for (const ws of wb.worksheets) {
    if (!MONTH_SHEET_PATTERN.test(ws.name)) continue;
    allRaw.push(...parseSheet(ws));
  }
  console.log(`Parsed ${allRaw.length} bookings from Excel\n`);

  const mapService = buildServiceMapper(services);

  const customerProfiles = new Map<string, {
    displayName: string;
    firstVisitDate: Date;
    lastVisitDate: Date;
    visitCount: number;
  }>();
  for (const r of allRaw) {
    const slug = slugify(r.customerName);
    const acc = customerProfiles.get(slug) ?? {
      displayName: r.customerName,
      firstVisitDate: r.date,
      lastVisitDate: r.date,
      visitCount: 0,
    };
    acc.visitCount++;
    if (r.date < acc.firstVisitDate) acc.firstVisitDate = r.date;
    if (r.date > acc.lastVisitDate) acc.lastVisitDate = r.date;
    customerProfiles.set(slug, acc);
  }
  console.log(`Distinct customers: ${customerProfiles.size}\n`);

  const matchStats = new Map<string, number>();
  let bankCount = 0;
  let cashCount = 0;
  let totalRev = 0;
  for (const r of allRaw) {
    const m = mapService(r.serviceName);
    matchStats.set(m.matched, (matchStats.get(m.matched) ?? 0) + 1);
    if (r.isBankTransfer) bankCount++;
    else cashCount++;
    totalRev += r.amount ?? 0;
  }
  console.log("Service mapping breakdown:");
  Array.from(matchStats.entries())
    .sort((a, b) => b[1] - a[1])
    .forEach(([k, v]) => console.log(`  ${v.toString().padStart(4)} → ${k}`));
  console.log();
  console.log(`Payments: ${bankCount} BANK_TRANSFER (red font) / ${cashCount} CASH`);
  console.log(`Total revenue: NT$ ${totalRev.toLocaleString()}\n`);

  if (DRY_RUN) {
    console.log("✓ DRY-RUN complete. Re-run with --commit to write to DB.");
    return;
  }

  console.log("--- Writing to DB ---");

  const slugToUserId = new Map<string, string>();
  let userCreated = 0;
  let userUpdated = 0;
  for (const [slug, profile] of customerProfiles) {
    const lineUserId = `legacy-${slug}-${tenant.slug}`;
    const existing = await prisma.user.findUnique({
      where: { tenantId_lineUserId: { tenantId: tenant.id, lineUserId } },
      select: { id: true },
    });
    if (existing) {
      await prisma.user.update({
        where: { id: existing.id },
        data: {
          displayName: profile.displayName,
          firstVisitAt: profile.firstVisitDate,
          lastVisitAt: profile.lastVisitDate,
          totalVisits: profile.visitCount,
        },
      });
      slugToUserId.set(slug, existing.id);
      userUpdated++;
    } else {
      const u = await prisma.user.create({
        data: {
          tenantId: tenant.id,
          lineUserId,
          displayName: profile.displayName,
          firstVisitAt: profile.firstVisitDate,
          lastVisitAt: profile.lastVisitDate,
          totalVisits: profile.visitCount,
        },
        select: { id: true },
      });
      slugToUserId.set(slug, u.id);
      userCreated++;
    }
  }
  console.log(`Users: ${userCreated} created, ${userUpdated} updated`);

  const importTime = new Date();
  let bookingCreated = 0;
  let bookingSkipped = 0;
  let paymentCreated = 0;
  const errors: string[] = [];

  for (const r of allRaw) {
    const slug = slugify(r.customerName);
    const userId = slugToUserId.get(slug);
    if (!userId) continue;

    const m = mapService(r.serviceName);
    const dateIso = r.date.toISOString().slice(0, 10);
    const startTime = `${String(r.hour).padStart(2, "0")}:00`;
    const id = deterministicBookingId(tenant.id, dateIso, startTime, slug);

    const exists = await prisma.booking.findUnique({ where: { id }, select: { id: true } });
    if (exists) {
      bookingSkipped++;
      continue;
    }

    const slots = m.service.slotsNeeded;
    const endHour = Math.min(r.hour + slots, 20);
    const endTime = `${String(endHour).padStart(2, "0")}:00`;

    const noteParts = [`原始 Excel: ${r.serviceName || "(空)"} @ ${r.monthSheet}`];
    if (r.amount != null && r.amount !== m.service.price) {
      noteParts.push(`Excel 金額 NT$${r.amount} (現價 NT$${m.service.price})`);
    }

    try {
      await prisma.$transaction(async (tx) => {
        await tx.booking.create({
          data: {
            id,
            tenantId: tenant.id,
            userId,
            serviceId: m.service.id,
            date: new Date(dateIso + "T00:00:00+08:00"),
            startTime,
            endTime,
            slotsOccupied: slots,
            status: "COMPLETED",
            source: "WALK_IN",
            adminAcknowledgedAt: importTime,
            notes: noteParts.join(" · "),
          },
        });
        if (r.amount != null) {
          await tx.payment.create({
            data: {
              bookingId: id,
              amount: r.amount,
              method: r.isBankTransfer ? "BANK_TRANSFER" : "CASH",
              status: "RECEIVED",
              receivedAt: importTime,
            },
          });
          paymentCreated++;
        }
        bookingCreated++;
      });
    } catch (err) {
      errors.push(`${dateIso} ${startTime} ${r.customerName}: ${err}`);
    }
  }

  console.log(`Bookings: ${bookingCreated} created, ${bookingSkipped} skipped (idempotent)`);
  console.log(`Payments: ${paymentCreated} created`);
  if (errors.length > 0) {
    console.log(`\n⚠ ${errors.length} errors:`);
    errors.slice(0, 10).forEach((e) => console.log(`  ${e}`));
  }
  console.log("\n✓ COMMIT complete.");
}

main()
  .catch((e) => {
    console.error("✗ Import failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
