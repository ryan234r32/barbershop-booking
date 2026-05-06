/**
 * 把 BusinessHours 表動態組成客戶看到的字串。
 *
 * 例如：
 *   - 全部開放 11-20 → "每日 11:00-20:00"
 *   - 週一公休、其他 11-20 → "週二至週日 11:00-20:00（週一公休）"
 *   - 週三、週日公休、其他 11-20 → "週一、週二、週四至週六 11:00-20:00（週三、週日公休）"
 *
 * 為什麼存在：webhook (LINE bot 自動回覆) + admin keyword preview 原本寫死
 * 「週二至週日 11:00-20:00（週一公休）」，跟 admin /settings 改的設定脫鉤。
 * 老闆改公休後 LINE 還是說「週一公休」誤導客戶。
 */
import type { BusinessHours } from "@prisma/client";

const DAY_NAMES = ["日", "一", "二", "三", "四", "五", "六"];

interface OpenDay {
  dayOfWeek: number; // 0=Sun..6=Sat
  startTime: string;
  endTime: string;
}

/**
 * 把 0=Sun..6=Sat 轉成「週一優先」順序：Mon=0, Tue=1, ..., Sun=6
 * 用來判斷連續性（週一二三四五是連續，週日不該接在週一之前）。
 */
function toMonFirstIndex(dow: number): number {
  return dow === 0 ? 6 : dow - 1;
}

function fromMonFirstIndex(mfi: number): number {
  return mfi === 6 ? 0 : mfi + 1;
}

/**
 * 把開放日依時段分組（不同時段的日子分開），同時段內再判斷連續性。
 */
function groupConsecutiveOpenDays(open: OpenDay[]): Array<{
  days: number[]; // 原始 dayOfWeek (0=Sun)
  startTime: string;
  endTime: string;
}> {
  if (open.length === 0) return [];

  // 依 (startTime, endTime) 分組
  const byTime = new Map<string, OpenDay[]>();
  for (const d of open) {
    const key = `${d.startTime}-${d.endTime}`;
    const list = byTime.get(key) ?? [];
    list.push(d);
    byTime.set(key, list);
  }

  const result: Array<{ days: number[]; startTime: string; endTime: string }> = [];

  for (const [key, days] of byTime) {
    const [startTime, endTime] = key.split("-");
    // Sort by Mon-first index so consecutive grouping works
    const sorted = days.map((d) => toMonFirstIndex(d.dayOfWeek)).sort((a, b) => a - b);
    // Group consecutive runs
    const runs: number[][] = [];
    for (const mfi of sorted) {
      const last = runs[runs.length - 1];
      if (last && last[last.length - 1] === mfi - 1) {
        last.push(mfi);
      } else {
        runs.push([mfi]);
      }
    }
    for (const run of runs) {
      result.push({
        days: run.map(fromMonFirstIndex),
        startTime,
        endTime,
      });
    }
  }

  return result;
}

/**
 * 一段連續日子的標籤：
 *   [一] → "週一"
 *   [一,二,三] → "週一至週三"
 *   [一,三] → "週一、週三"  (理論上不會走到這裡，因為 group 已經切開)
 */
function labelDayRun(days: number[]): string {
  if (days.length === 1) return `週${DAY_NAMES[days[0]]}`;
  // Sort by Mon-first to print in natural order
  const sorted = [...days].sort((a, b) => toMonFirstIndex(a) - toMonFirstIndex(b));
  return `週${DAY_NAMES[sorted[0]]}至週${DAY_NAMES[sorted[sorted.length - 1]]}`;
}

/**
 * 主要 export：拿一個 tenant 的 BusinessHours rows，回傳人類可讀字串。
 *
 * Edge cases：
 *   - 沒有任何 row（DB 沒 seed） → "請洽店家"
 *   - 全部 isOpen=false → "目前暫不營業"
 *   - 全部 isOpen=true → "每日 HH:mm-HH:mm"
 *   - 部分公休 → "<開放> HH:mm-HH:mm（<公休>公休）"
 */
export function formatBusinessHoursLabel(rows: Pick<BusinessHours, "dayOfWeek" | "startTime" | "endTime" | "isOpen">[]): string {
  if (rows.length === 0) return "請洽店家";

  const open = rows.filter((r) => r.isOpen);
  const closed = rows.filter((r) => !r.isOpen);

  if (open.length === 0) return "目前暫不營業";

  // 全部開放（沒有公休）
  if (closed.length === 0) {
    const t = open[0];
    // 若所有 open 時段相同：每日 HH-HH
    const allSameTime = open.every((d) => d.startTime === t.startTime && d.endTime === t.endTime);
    if (allSameTime) return `每日 ${t.startTime}-${t.endTime}`;
  }

  // 一般情況：開放日分組（連續日合併成「週X至週Y」）
  const groups = groupConsecutiveOpenDays(
    open.map((d) => ({ dayOfWeek: d.dayOfWeek, startTime: d.startTime, endTime: d.endTime })),
  );

  // Sort groups by Mon-first start day 讓輸出順序自然
  groups.sort((a, b) => toMonFirstIndex(a.days[0]) - toMonFirstIndex(b.days[0]));

  // 若所有 group 同時段，簡化為「<日子A>、<日子B>... HH-HH」
  const firstTime = `${groups[0].startTime}-${groups[0].endTime}`;
  const allSameTime = groups.every((g) => `${g.startTime}-${g.endTime}` === firstTime);

  let openLabel: string;
  if (allSameTime) {
    openLabel = `${groups.map((g) => labelDayRun(g.days)).join("、")} ${firstTime}`;
  } else {
    // 罕見情況：不同日子有不同時段（例：週六只開到 18）
    openLabel = groups
      .map((g) => `${labelDayRun(g.days)} ${g.startTime}-${g.endTime}`)
      .join("、");
  }

  if (closed.length === 0) return openLabel;

  // 公休部分
  const closedSorted = closed.map((c) => c.dayOfWeek).sort((a, b) => toMonFirstIndex(a) - toMonFirstIndex(b));
  const closedLabel = closedSorted.map((d) => `週${DAY_NAMES[d]}`).join("、");
  return `${openLabel}（${closedLabel}公休）`;
}
