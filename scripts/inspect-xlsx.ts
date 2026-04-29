import ExcelJS from "exceljs";

async function check(file: string) {
  console.log(`\n=== ${file} ===`);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);
  console.log("Sheets:", wb.worksheets.map((w) => w.name).join(", "));
  for (const ws of wb.worksheets.slice(0, 2)) {
    console.log(`  [${ws.name}] first 4 rows:`);
    let count = 0;
    ws.eachRow({ includeEmpty: false }, (row, rowNum) => {
      if (count >= 4) return;
      const cells: string[] = [];
      row.eachCell((cell, col) => {
        const v = cell.value;
        const s = v instanceof Date ? v.toISOString().slice(0, 10) : String(v ?? "").slice(0, 14);
        cells.push(`c${col}=${s}`);
      });
      console.log(`    row${rowNum}: ${cells.slice(0, 8).join(" | ")}`);
      count++;
    });
  }
}

async function main() {
  await check("docs/2024預約表.xlsx");
  await check("docs/2026預約表.xlsx");
}
main();
