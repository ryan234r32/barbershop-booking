/**
 * Import historical bookings from Excel (PRD-v3 §10.1, Wave 3.B).
 *
 * Source: docs/2025預約表Ken老師.xlsx (12 monthly worksheets + template)
 *
 * STATUS: skeleton — dry-run statistics only. Full DB import logic
 * (service-name mapping, customer upsert, payment red-text detection,
 * deterministic id) is INCOMPLETE — see TODO list at bottom.
 *
 * Usage:
 *   npm run import:excel:dryrun                    # print stats only, no DB writes
 *   npm run import:excel:dryrun -- --file path.xlsx
 *   npm run import:excel -- --tenant <id> --confirm  # actual DB writes (requires E-18 guard)
 *
 * Why exceljs not xlsx (E-16):
 *   exceljs reads cell.font.color so we can detect 紅字 = BANK_TRANSFER payment.
 *   xlsx loses font information.
 */

import "dotenv/config";
import * as path from "path";
import ExcelJS from "exceljs";

const DEFAULT_FILE = path.join(__dirname, "..", "docs", "2025預約表Ken老師.xlsx");

// ─── CLI args ──────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const isDryRun = args.includes("--dry-run");
const isConfirmed = args.includes("--confirm");
const fileIdx = args.indexOf("--file");
const filePath = fileIdx !== -1 && args[fileIdx + 1] ? args[fileIdx + 1] : DEFAULT_FILE;
const tenantIdx = args.indexOf("--tenant");
const tenantId = tenantIdx !== -1 ? args[tenantIdx + 1] : null;

// ─── Types ─────────────────────────────────────────────────────────────────

interface ParsedBooking {
  monthSheet: string; // "202501" .. "202512"
  date: Date | null;
  weekday: number; // 1=Mon .. 7=Sun
  startTime: string; // "HH:00"
  serviceName: string;
  customerName: string;
  amount: number | null;
  isNewCustomer: boolean; // service name prefixed with "新"
  notes: string | null; // 休假 / 體檢 etc.
  rawCells: { service: string; customer: string; amount: string };
}

interface MonthStats {
  sheetName: string;
  bookingCount: number;
  customerCount: number;
  totalRevenue: number;
  newCustomerCount: number;
  servicesBreakdown: Map<string, { count: number; revenue: number }>;
  warnings: string[];
}

// ─── Worksheet parsing ─────────────────────────────────────────────────────

const MONTH_SHEET_PATTERN = /^2025\d{2}$/; // 202501–202512
const HOUR_ROW_REGEX = /^(\d{1,2})[:：](\d{2})$/;

/**
 * Each month worksheet layout (per PRD §10.1):
 *   Row 1: 時間 | 星期一 (3 cols: 服務/客名/金額) | 星期二 | ... | 星期日
 *   Row 2: 日期 | <date for Mon> | <date for Tue> | ...
 *   Row 3+: <hour like 11:00> | service/customer/amount per weekday slot
 */
function parseMonthSheet(ws: ExcelJS.Worksheet): {
  bookings: ParsedBooking[];
  warnings: string[];
} {
  const bookings: ParsedBooking[] = [];
  const warnings: string[] = [];

  // Step 1: Read row 2 (日期) → build column → date map
  const dateRow = ws.getRow(2);
  const colDates = new Map<number, Date | null>();
  // Cols 2-22 are 7 weekdays × 3 sub-cols. Each weekday's first col is the day.
  for (let weekdayIdx = 0; weekdayIdx < 7; weekdayIdx++) {
    const firstColForDay = 2 + weekdayIdx * 3;
    const cell = dateRow.getCell(firstColForDay);
    const v = cell.value;
    let date: Date | null = null;
    if (v instanceof Date) date = v;
    else if (typeof v === "number") date = new Date(v); // Excel serial date — exceljs sometimes returns raw number
    // The 3 sub-cols all map to the same date
    for (let sub = 0; sub < 3; sub++) {
      colDates.set(firstColForDay + sub, date);
    }
  }

  // Step 2: Walk each hour row (row 3 onwards)
  for (let rowNum = 3; rowNum <= ws.rowCount; rowNum++) {
    const row = ws.getRow(rowNum);
    const hourCell = row.getCell(1).value;
    if (!hourCell) continue;
    const hourStr = String(hourCell).trim();
    const hourMatch = HOUR_ROW_REGEX.exec(hourStr);
    if (!hourMatch) continue;
    const hour = parseInt(hourMatch[1], 10);
    const startTime = `${String(hour).padStart(2, "0")}:00`;

    for (let weekdayIdx = 0; weekdayIdx < 7; weekdayIdx++) {
      const baseCol = 2 + weekdayIdx * 3;
      const serviceCell = row.getCell(baseCol).value;
      const customerCell = row.getCell(baseCol + 1).value;
      const amountCell = row.getCell(baseCol + 2).value;

      const serviceRaw = serviceCell ? String(serviceCell).trim() : "";
      const customerRaw = customerCell ? String(customerCell).trim() : "";
      const amountRaw = amountCell != null ? String(amountCell).trim() : "";

      if (!serviceRaw && !customerRaw) continue; // empty slot

      // Parse amount
      let amount: number | null = null;
      const amountMatch = /^\d+/.exec(amountRaw);
      if (amountMatch) amount = parseInt(amountMatch[0], 10);

      // Detect 「新」 prefix → new customer
      const isNewCustomer = serviceRaw.startsWith("新");

      // Notes: special markers like 休假 / 體檢 / 掛X門診
      const notesRegex = /(休假|體檢|門診|請假|公休)/;
      const notes = notesRegex.test(customerRaw) || notesRegex.test(serviceRaw)
        ? customerRaw || serviceRaw
        : null;

      // Time override e.g. "16：30 許俊宏"
      let actualStartTime = startTime;
      const timeOverrideMatch = /^(\d{1,2})[:：](\d{2})\s*(.+)$/.exec(customerRaw);
      let customerName = customerRaw;
      if (timeOverrideMatch) {
        actualStartTime = `${String(parseInt(timeOverrideMatch[1], 10)).padStart(2, "0")}:${timeOverrideMatch[2]}`;
        customerName = timeOverrideMatch[3].trim();
      }

      const date = colDates.get(baseCol) || null;
      const weekday = weekdayIdx + 1;

      bookings.push({
        monthSheet: ws.name,
        date,
        weekday,
        startTime: actualStartTime,
        serviceName: serviceRaw,
        customerName,
        amount,
        isNewCustomer,
        notes,
        rawCells: { service: serviceRaw, customer: customerRaw, amount: amountRaw },
      });

      if (!amount && !notes) {
        warnings.push(
          `[${ws.name}] row ${rowNum} col ${baseCol}: missing amount for ${serviceRaw} / ${customerName}`,
        );
      }
    }
  }

  return { bookings, warnings };
}

function summarize(bookings: ParsedBooking[], warnings: string[], sheetName: string): MonthStats {
  const customers = new Set<string>();
  const newCustomers = new Set<string>();
  const services = new Map<string, { count: number; revenue: number }>();
  let totalRevenue = 0;

  for (const b of bookings) {
    if (b.notes) continue; // skip 休假/體檢
    customers.add(b.customerName);
    if (b.isNewCustomer) newCustomers.add(b.customerName);
    if (b.amount) totalRevenue += b.amount;
    const svc = services.get(b.serviceName) ?? { count: 0, revenue: 0 };
    svc.count++;
    svc.revenue += b.amount ?? 0;
    services.set(b.serviceName, svc);
  }

  return {
    sheetName,
    bookingCount: bookings.filter((b) => !b.notes).length,
    customerCount: customers.size,
    totalRevenue,
    newCustomerCount: newCustomers.size,
    servicesBreakdown: services,
    warnings,
  };
}

// ─── Main ──────────────────────────────────────────────────────────────────

async function main() {
  console.log("=== Historical Excel Import (PRD-v3 §10.1, Wave 3.B) ===\n");
  console.log(`File:    ${filePath}`);
  console.log(`Mode:    ${isDryRun ? "DRY-RUN (no DB writes)" : "LIVE"}`);
  console.log(`Tenant:  ${tenantId ?? "<not specified>"}`);
  console.log("");

  if (!isDryRun) {
    // E-18 demo-tenant guard
    if (!tenantId) {
      console.error("ERROR: --tenant <id> required for non-dry-run mode");
      process.exit(1);
    }
    if (!isConfirmed) {
      console.error("ERROR: --confirm required to actually write to DB");
      console.error("       Run dry-run first, review stats, then add --confirm.");
      process.exit(1);
    }
    console.error("ERROR: live import not yet implemented — TODOs below");
    console.error("       Use --dry-run to read + summarize the Excel file.");
    process.exit(1);
  }

  // ─── Load workbook ───
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  console.log(`Loaded workbook with ${workbook.worksheets.length} sheets:`);
  for (const ws of workbook.worksheets) {
    const flag = MONTH_SHEET_PATTERN.test(ws.name) ? "✓" : "skip";
    console.log(`  [${flag}] ${ws.name} (${ws.rowCount} rows × ${ws.columnCount} cols)`);
  }
  console.log("");

  // ─── Parse monthly sheets ───
  const allStats: MonthStats[] = [];
  const allBookings: ParsedBooking[] = [];

  for (const ws of workbook.worksheets) {
    if (!MONTH_SHEET_PATTERN.test(ws.name)) continue;
    const { bookings, warnings } = parseMonthSheet(ws);
    const stats = summarize(bookings, warnings, ws.name);
    allStats.push(stats);
    allBookings.push(...bookings);
  }

  // ─── Print summary ───
  console.log("=== Per-Month Summary ===");
  console.log("Sheet    Bookings  Customers  NewCust  Revenue       Warnings");
  console.log("------   --------  ---------  -------  -----------   --------");
  for (const s of allStats) {
    console.log(
      `${s.sheetName.padEnd(8)} ${String(s.bookingCount).padStart(8)}  ${String(s.customerCount).padStart(9)}  ${String(s.newCustomerCount).padStart(7)}  NT$${s.totalRevenue.toLocaleString().padStart(8)}   ${s.warnings.length}`,
    );
  }
  console.log("");

  const totalBookings = allStats.reduce((sum, s) => sum + s.bookingCount, 0);
  const totalRevenue = allStats.reduce((sum, s) => sum + s.totalRevenue, 0);
  const totalWarnings = allStats.reduce((sum, s) => sum + s.warnings.length, 0);

  console.log("=== Yearly Total ===");
  console.log(`  Bookings: ${totalBookings.toLocaleString()}`);
  console.log(`  Revenue:  NT$${totalRevenue.toLocaleString()}`);
  console.log(`  Warnings: ${totalWarnings}`);
  console.log("");

  // ─── Top services across all months ───
  const allServices = new Map<string, { count: number; revenue: number }>();
  for (const s of allStats) {
    for (const [name, data] of s.servicesBreakdown) {
      const acc = allServices.get(name) ?? { count: 0, revenue: 0 };
      acc.count += data.count;
      acc.revenue += data.revenue;
      allServices.set(name, acc);
    }
  }

  const topServices = Array.from(allServices.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 15);

  console.log("=== Top 15 Services (by count) ===");
  console.log("Service                 Count    Revenue       Avg");
  console.log("-------                 -----    -----------   -----");
  for (const [name, data] of topServices) {
    const avg = data.count > 0 ? Math.round(data.revenue / data.count) : 0;
    console.log(
      `${name.padEnd(20)}  ${String(data.count).padStart(5)}    NT$${data.revenue.toLocaleString().padStart(8)}   NT$${String(avg).padStart(5)}`,
    );
  }
  console.log("");

  // ─── First 10 warnings ───
  if (totalWarnings > 0) {
    console.log("=== First 10 Warnings ===");
    let shown = 0;
    for (const s of allStats) {
      for (const w of s.warnings) {
        if (shown >= 10) break;
        console.log(`  ${w}`);
        shown++;
      }
      if (shown >= 10) break;
    }
    console.log("");
  }

  console.log("=== TODO (not yet implemented) ===");
  console.log("  [ ] E-16 red-text detection: cell.font.color → method=BANK_TRANSFER");
  console.log("  [ ] Service name mapping: build data/service-name-map.json against V3 Service table");
  console.log("  [ ] Customer upsert with synthetic lineUserId (legacy-{slugify(name)}-{idx})");
  console.log("  [ ] firstVisitAt = first 「新」-prefixed booking per customer");
  console.log("  [ ] E-17 deterministic Booking.id via hash(tenantId+date+startTime+normalizedName)");
  console.log("  [ ] Booking + Payment write (status=COMPLETED, source=WALK_IN, payment.method=CASH default)");
  console.log("  [ ] E-18 production-tenant guard (default deny; --force-prod to allow)");
  console.log("  [ ] Tests: red-text detection, time override parser, customer normalize");
  console.log("");

  console.log("Done. Dry-run completed successfully.");
}

main().catch((err) => {
  console.error("Import failed:", err);
  process.exit(1);
});
