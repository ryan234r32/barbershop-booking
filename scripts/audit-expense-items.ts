/**
 * Scan 2024/2025/2026 Excel files for expense-like items in cells
 * (non-booking entries that look like 廠商 / 傢俱 / 修繕 / 房租 / etc).
 *
 * Used once to inform the V3.7 expense category list.
 */
import "dotenv/config";
import * as path from "path";
import ExcelJS from "exceljs";

async function scan(file: string) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);
  const counts = new Map<string, number>();
  for (const ws of wb.worksheets) {
    for (let r = 1; r <= ws.rowCount; r++) {
      for (let c = 1; c <= Math.min(22, ws.columnCount); c++) {
        const v = ws.getCell(r, c).value;
        if (v == null) continue;
        let s = "";
        if (typeof v === "string") s = v;
        else if (typeof v === "object" && "richText" in v)
          s = (v as { richText: { text: string }[] }).richText.map((x) => x.text).join("");
        else continue;
        s = s.trim();
        // 排除預約字（剪/染/燙/漂/護/洗/客戶名）+ 純數字。
        if (
          s.length > 0 &&
          s.length < 12 &&
          /[休體門請公漲回掛法廠傢診修壞買訂租電瓦保稅維清行銷補進冷暖網訊軟費薪保險銀儲蓄水油]/.test(s)
        ) {
          counts.set(s, (counts.get(s) ?? 0) + 1);
        }
      }
    }
  }
  console.log(`\n=== ${path.basename(file)} ===`);
  for (const [k, v] of [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30)) {
    console.log(`  ${v.toString().padStart(3)} ${k}`);
  }
}

(async () => {
  await scan("docs/2024預約表.xlsx");
  await scan("docs/2025預約表Ken老師.xlsx");
  await scan("docs/2026預約表.xlsx");
})();
