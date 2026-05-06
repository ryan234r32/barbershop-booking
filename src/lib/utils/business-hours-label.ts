/**
 * 把 BusinessHours 表動態組成客戶看到的字串。
 *
 * 例如：
 *   - 全部開放 11-20 → "每日 11:00-20:00"
 *   - 週一公休、其他 11-20 → "週二、週三、週四、週五、週六、週日 11:00-20:00（週一公休）"
 *   - 週三、週日公休 → "週一、週二、週四、週五、週六 11:00-20:00（週三、週日公休）"
 *
 * 為什麼存在：webhook (LINE bot 自動回覆) + admin keyword preview 原本寫死
 * 「週二至週日 11:00-20:00（週一公休）」，跟 admin /settings 改的設定脫鉤。
 *
 * 為什麼用「、」不用「至」：老闆 5/6 反映「週X至週Y」在台灣店家文宣很少見，
 * 一律改用逐日列出，讀起來最直觀。
 */
import type { BusinessHours } from "@prisma/client";

const DAY_NAMES = ["日", "一", "二", "三", "四", "五", "六"];

/**
 * 把 0=Sun..6=Sat 轉成「週一優先」順序：Mon=0, Tue=1, ..., Sun=6
 * 用來排序輸出，讓「週一、週二...週日」順序自然，不會週日跑到最前面。
 */
function toMonFirstIndex(dow: number): number {
  return dow === 0 ? 6 : dow - 1;
}

/**
 * 主要 export：拿一個 tenant 的 BusinessHours rows，回傳人類可讀字串。
 *
 * Format A（逐日列出，不用「至」範圍語法）。
 *
 * Edge cases：
 *   - 沒有任何 row（DB 沒 seed） → "請洽店家"
 *   - 全部 isOpen=false → "目前暫不營業"
 *   - 全部 isOpen=true 同時段 → "每日 HH:mm-HH:mm"
 *   - 部分公休 → "<開放日> HH:mm-HH:mm（<公休日>公休）"
 *   - 不同日有不同時段（罕見）→ 各自列出
 */
export function formatBusinessHoursLabel(
  rows: Pick<BusinessHours, "dayOfWeek" | "startTime" | "endTime" | "isOpen">[],
): string {
  if (rows.length === 0) return "請洽店家";

  const open = rows.filter((r) => r.isOpen);
  const closed = rows.filter((r) => !r.isOpen);

  if (open.length === 0) return "目前暫不營業";

  // 全部開放且時段相同 → "每日 HH-HH"
  if (closed.length === 0) {
    const t = open[0];
    const allSameTime = open.every(
      (d) => d.startTime === t.startTime && d.endTime === t.endTime,
    );
    if (allSameTime) return `每日 ${t.startTime}-${t.endTime}`;
  }

  // 把 open days 依 (startTime, endTime) 分組
  const byTime = new Map<string, number[]>();
  for (const d of open) {
    const key = `${d.startTime}-${d.endTime}`;
    const list = byTime.get(key) ?? [];
    list.push(d.dayOfWeek);
    byTime.set(key, list);
  }

  // 同時段的日子用「、」連接，依 Mon-first 排序
  const groups = Array.from(byTime.entries()).map(([timeKey, days]) => {
    const sorted = [...days].sort(
      (a, b) => toMonFirstIndex(a) - toMonFirstIndex(b),
    );
    const dayLabel = sorted.map((d) => `週${DAY_NAMES[d]}`).join("、");
    const [startTime, endTime] = timeKey.split("-");
    return { dayLabel, startTime, endTime, firstDay: toMonFirstIndex(sorted[0]) };
  });

  // 多 group 時依第一個出現的星期排序
  groups.sort((a, b) => a.firstDay - b.firstDay);

  let openLabel: string;
  if (groups.length === 1) {
    // 單一時段：例「週一、週二、週四、週五、週六 11:00-20:00」
    const g = groups[0];
    openLabel = `${g.dayLabel} ${g.startTime}-${g.endTime}`;
  } else {
    // 多時段（罕見）：例「週一、週二 11:00-20:00、週六 13:00-18:00」
    openLabel = groups
      .map((g) => `${g.dayLabel} ${g.startTime}-${g.endTime}`)
      .join("、");
  }

  if (closed.length === 0) return openLabel;

  // 公休日依 Mon-first 排序，「、」連接
  const closedLabel = closed
    .map((c) => c.dayOfWeek)
    .sort((a, b) => toMonFirstIndex(a) - toMonFirstIndex(b))
    .map((d) => `週${DAY_NAMES[d]}`)
    .join("、");

  return `${openLabel}（${closedLabel}公休）`;
}
