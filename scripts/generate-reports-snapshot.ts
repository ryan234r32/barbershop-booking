/**
 * Generate reports JSON snapshot from 2025 Excel historical data (PRD-v3 §10.2, Wave 5).
 *
 * Run manually: `npm run reports:snapshot`
 * Output: data/reports-snapshot.json (committed, served via /api/reports)
 *
 * Why snapshot not live: parser takes 1-2s per call; reports page must be instant.
 * Live V3 system stats will be added in a separate API later (Wave 5 full).
 */

import "dotenv/config";
import * as fs from "fs";
import * as path from "path";
import ExcelJS from "exceljs";

const EXCEL_FILE = path.join(__dirname, "..", "docs", "2025預約表Ken老師.xlsx");
const OUTPUT = path.join(__dirname, "..", "data", "reports-snapshot.json");

const MONTH_SHEET_PATTERN = /^2025\d{2}$/;

interface WeekdayDef { name: string; svc: number; cust: number; amt: number; }
const WEEKDAYS_LAYOUT: WeekdayDef[] = [
  { name: "Mon", svc: 2, cust: 3, amt: 4 },
  { name: "Tue", svc: 5, cust: 6, amt: 7 },
  { name: "Thu", svc: 9, cust: 10, amt: 11 },
  { name: "Fri", svc: 12, cust: 13, amt: 14 },
  { name: "Sat", svc: 15, cust: 16, amt: 17 },
  { name: "Sun", svc: 18, cust: 19, amt: 20 },
];

function readCellString(cell: ExcelJS.Cell): string {
  const v = cell.value;
  if (v == null) return "";
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "object" && "result" in v) return String((v as { result: unknown }).result ?? "").trim();
  if (typeof v === "object" && "richText" in v) {
    return (v as { richText: { text: string }[] }).richText.map((r) => r.text).join("").trim();
  }
  return String(v).trim();
}

function readCellDate(cell: ExcelJS.Cell): Date | null {
  const v = cell.value;
  if (v instanceof Date) return v;
  if (typeof v === "number") return new Date(v);
  return null;
}

interface BookingRow {
  monthSheet: string;
  date: Date;
  weekdayIdx: number; // 0=Mon..5=Sun (Wed skipped)
  hour: number;
  serviceName: string;
  customerName: string;
  amount: number | null;
  isNewCustomer: boolean;
}

function parseSheet(ws: ExcelJS.Worksheet): BookingRow[] {
  const out: BookingRow[] = [];
  const blockStarts: number[] = [];
  for (let r = 1; r <= ws.rowCount; r++) {
    if (readCellString(ws.getCell(r, 1)) === "時間") blockStarts.push(r);
  }
  for (const blockStart of blockStarts) {
    const dateRow = ws.getRow(blockStart + 1);
    const dates = WEEKDAYS_LAYOUT.map((wd) => readCellDate(dateRow.getCell(wd.svc)));
    for (let h = 0; h < 9; h++) {
      const hour = 11 + h;
      const rowNum = blockStart + 2 + h;
      if (rowNum > ws.rowCount) break;
      const row = ws.getRow(rowNum);
      WEEKDAYS_LAYOUT.forEach((wd, idx) => {
        const date = dates[idx];
        if (!date) return;
        const svc = readCellString(row.getCell(wd.svc));
        const cust = readCellString(row.getCell(wd.cust));
        if (!svc && !cust) return;
        const amtStr = readCellString(row.getCell(wd.amt));
        const amtMatch = /^(\d+)/.exec(amtStr);
        const amount = amtMatch ? parseInt(amtMatch[1], 10) : null;
        const isNew = svc.startsWith("新");
        // Skip notes-only rows
        if (/(休假|體檢|門診|請假|公休|漲價)/.test(cust) || /(休假|體檢|門診|請假|公休|漲價)/.test(svc)) return;
        out.push({
          monthSheet: ws.name,
          date,
          weekdayIdx: idx,
          hour,
          serviceName: svc,
          customerName: cust,
          amount,
          isNewCustomer: isNew,
        });
      });
    }
  }
  return out;
}

function categorizeService(name: string): "剪" | "燙" | "染" | "漂" | "護" | "洗" | "其他" {
  if (name.includes("剪")) return "剪";
  if (name.includes("漂")) return "漂"; // check before 染 (漂染合併也歸漂)
  if (name.includes("染")) return "染";
  if (name.includes("燙")) return "燙";
  if (name.includes("護")) return "護";
  if (name.includes("洗")) return "洗";
  return "其他";
}

async function main() {
  console.log("=== Generating reports snapshot from 2025 Excel ===\n");

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(EXCEL_FILE);

  const allBookings: BookingRow[] = [];
  for (const ws of wb.worksheets) {
    if (!MONTH_SHEET_PATTERN.test(ws.name)) continue;
    allBookings.push(...parseSheet(ws));
  }

  console.log(`Parsed ${allBookings.length} bookings from ${wb.worksheets.length - 1} monthly sheets\n`);

  // ─── Aggregations ───

  // 1. Monthly revenue + count
  const monthlyAgg = new Map<string, { count: number; revenue: number; newCustomers: number }>();
  for (const b of allBookings) {
    const key = b.monthSheet;
    const acc = monthlyAgg.get(key) ?? { count: 0, revenue: 0, newCustomers: 0 };
    acc.count++;
    acc.revenue += b.amount ?? 0;
    if (b.isNewCustomer) acc.newCustomers++;
    monthlyAgg.set(key, acc);
  }
  const monthlyRevenue = Array.from(monthlyAgg.entries())
    .sort()
    .map(([month, v]) => ({
      month: `${month.slice(0, 4)}-${month.slice(4)}`,
      count: v.count,
      revenue: v.revenue,
      newCustomers: v.newCustomers,
    }));

  // 2. Service distribution
  const serviceCat = new Map<string, { count: number; revenue: number }>();
  for (const b of allBookings) {
    const cat = categorizeService(b.serviceName);
    const acc = serviceCat.get(cat) ?? { count: 0, revenue: 0 };
    acc.count++;
    acc.revenue += b.amount ?? 0;
    serviceCat.set(cat, acc);
  }
  const servicePie = Array.from(serviceCat.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .map(([category, v]) => ({ category, count: v.count, revenue: v.revenue }));

  // 3. Hour heatmap (weekday × hour)
  const heatmap: number[][] = Array.from({ length: 6 }, () => Array(9).fill(0));
  // 6 weekdays (Mon/Tue/Thu/Fri/Sat/Sun, Wed skipped) × 9 hours (11-19)
  for (const b of allBookings) {
    if (b.weekdayIdx >= 0 && b.weekdayIdx < 6 && b.hour >= 11 && b.hour <= 19) {
      heatmap[b.weekdayIdx][b.hour - 11]++;
    }
  }

  // 4. Top services (raw names, not categorized)
  const serviceMap = new Map<string, { count: number; revenue: number }>();
  for (const b of allBookings) {
    const acc = serviceMap.get(b.serviceName) ?? { count: 0, revenue: 0 };
    acc.count++;
    acc.revenue += b.amount ?? 0;
    serviceMap.set(b.serviceName, acc);
  }
  const topServices = Array.from(serviceMap.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10)
    .map(([name, v]) => ({ name, count: v.count, revenue: v.revenue, avg: Math.round(v.revenue / v.count) }));

  // 5. Customer stats
  const customers = new Map<string, { visits: number; revenue: number; firstNew: boolean }>();
  for (const b of allBookings) {
    const acc = customers.get(b.customerName) ?? { visits: 0, revenue: 0, firstNew: false };
    acc.visits++;
    acc.revenue += b.amount ?? 0;
    if (b.isNewCustomer) acc.firstNew = true;
    customers.set(b.customerName, acc);
  }
  const repeatCustomers = Array.from(customers.values()).filter((c) => c.visits >= 2).length;
  const totalCustomers = customers.size;

  // ─── Final snapshot ───

  const snapshot = {
    generatedAt: new Date().toISOString(),
    source: "docs/2025預約表Ken老師.xlsx",
    period: { from: "2025-01", to: "2025-12" },
    totals: {
      bookings: allBookings.length,
      revenue: allBookings.reduce((s, b) => s + (b.amount ?? 0), 0),
      uniqueCustomers: totalCustomers,
      repeatCustomers,
      newCustomers: Array.from(customers.values()).filter((c) => c.firstNew).length,
      repeatRate: totalCustomers > 0 ? Math.round((repeatCustomers / totalCustomers) * 1000) / 10 : 0,
    },
    monthlyRevenue,
    servicePie,
    heatmap: {
      weekdays: ["週一", "週二", "週四", "週五", "週六", "週日"],
      hours: ["11", "12", "13", "14", "15", "16", "17", "18", "19"],
      data: heatmap,
    },
    topServices,
  };

  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, JSON.stringify(snapshot, null, 2));

  console.log("=== Summary ===");
  console.log(`  Total bookings: ${snapshot.totals.bookings.toLocaleString()}`);
  console.log(`  Total revenue:  NT$${snapshot.totals.revenue.toLocaleString()}`);
  console.log(`  Customers:      ${snapshot.totals.uniqueCustomers} (${snapshot.totals.repeatCustomers} 回頭, ${snapshot.totals.repeatRate}% 回訪率)`);
  console.log(`  New customers:  ${snapshot.totals.newCustomers}`);
  console.log("");
  console.log(`Saved: ${OUTPUT}`);
}

main().catch((err) => {
  console.error("Snapshot generation failed:", err);
  process.exit(1);
});
