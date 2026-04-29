"use client";

import { useEffect, useMemo, useRef, useState } from "react";

/**
 * V3.6 feedback Pass 2 — full-month swipeable date / month / year picker.
 *
 * Behaviour (matches user's iOS-native reference):
 * - Renders ALL days of the current month (not 7 fixed items).
 * - User can swipe through the strip freely.
 * - At the LEFT edge (day 1) → ← arrow pill that jumps to last day of prev month.
 * - At the RIGHT edge (last day of month) → → arrow pill that jumps to day 1 of next month.
 * - Header shows "M月D日" + downward chevron; tap opens a calendar-grid modal.
 * - Calendar grid: 7-col Mon-Sun layout; tapping a day picks it; ← → navigate months.
 *
 * For `kind="month"`: same pattern but items are 12 months of the current year,
 * arrows jump to prev/next year, calendar shows year selector.
 *
 * For `kind="year"`: items are 10 years centered on selected; no edge arrows.
 */

type StripKind = "day" | "month" | "year";

interface DateStripProps {
  kind: StripKind;
  /** ISO format: "YYYY-MM-DD" for day, "YYYY-MM" for month, "YYYY" for year */
  selected: string;
  onSelect: (next: string) => void;
  /** Disable items past this value (inclusive). For day: ISO date. */
  maxValue?: string;
}

interface StripItem {
  value: string;
  primary: string;
  secondary?: string;
  isSelected: boolean;
  isToday: boolean;
  isWeekend?: boolean;
  isDisabled: boolean;
}

const WEEKDAYS_SHORT = ["週日", "週一", "週二", "週三", "週四", "週五", "週六"];

function todayIso(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Taipei" });
}

export function DateStrip({ kind, selected, onSelect, maxValue }: DateStripProps) {
  const today = todayIso();
  const max = maxValue ?? today;

  const [calendarOpen, setCalendarOpen] = useState(false);

  const items = useMemo<StripItem[]>(() => {
    if (kind === "day") return generateMonthDays(selected, today, max);
    if (kind === "month") return generateYearMonths(selected, today, max);
    return generateYearRange(selected, today, max);
  }, [kind, selected, today, max]);

  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = containerRef.current?.querySelector(`[data-selected="true"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [selected]);

  const { prevValue, nextValue, isAtPrevEdge, isAtNextEdge } = useMemo(
    () => computeNeighbours(kind, selected),
    [kind, selected],
  );
  const nextDisabled = nextValue > max;

  const headerLabel = useMemo(() => formatHeader(kind, selected), [kind, selected]);
  const isAtToday =
    (kind === "day" && selected === today) ||
    (kind === "month" && selected === today.slice(0, 7)) ||
    (kind === "year" && selected === today.slice(0, 4));

  return (
    <div className="space-y-1.5">
      {/* Header — tap to open calendar modal */}
      <div className="flex items-center justify-between px-1">
        <button
          onClick={() => kind !== "year" && setCalendarOpen(true)}
          disabled={kind === "year"}
          className="inline-flex items-center gap-1 text-base font-bold text-[var(--color-text-primary)] tabular-nums hover:opacity-70 disabled:cursor-default"
        >
          <span>{headerLabel}</span>
          {kind !== "year" && <span className="text-xs opacity-60">▼</span>}
        </button>
        {!isAtToday && (
          <button
            onClick={() => onSelect(defaultForKind(kind))}
            className="text-xs px-3 py-1 rounded-full bg-[var(--color-surface)] text-[var(--color-text-body)] font-medium hover:bg-[var(--color-text-muted)]/10"
          >
            今{kind === "day" ? "天" : kind === "month" ? "月" : "年"}
          </button>
        )}
      </div>

      {/* Strip with edge arrows */}
      <div className="flex items-stretch gap-1">
        {isAtPrevEdge && (
          <button
            onClick={() => onSelect(prevValue)}
            className="shrink-0 flex items-center justify-center w-9 rounded-xl bg-[var(--color-surface)] text-[var(--color-text-body)] hover:bg-[var(--color-text-muted)]/10 self-stretch"
            aria-label="上一個月"
            title={prevHeaderTitle(kind, prevValue)}
          >
            ←
          </button>
        )}

        <div
          ref={containerRef}
          className="flex gap-1 overflow-x-auto pb-1 -mx-1 px-1 snap-x snap-proximity flex-1 scrollbar-hide"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {items.map((item) => (
            <button
              key={item.value}
              data-selected={item.isSelected}
              disabled={item.isDisabled}
              onClick={() => onSelect(item.value)}
              className={`shrink-0 snap-center flex flex-col items-center justify-center gap-0.5 min-w-[3rem] py-2 px-2 rounded-xl transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
                item.isSelected
                  ? "bg-[var(--color-brand)] text-[var(--color-bg)]"
                  : item.isToday
                    ? "bg-[var(--color-surface)] text-[var(--color-text-primary)]"
                    : "text-[var(--color-text-body)] hover:bg-[var(--color-surface)]/60"
              }`}
            >
              {item.secondary && (
                <span
                  className={`text-[10px] ${
                    item.isSelected
                      ? "text-[var(--color-bg)]/80"
                      : item.isWeekend
                        ? "text-[var(--color-danger)]/70"
                        : "text-[var(--color-text-muted)]"
                  }`}
                >
                  {item.secondary}
                </span>
              )}
              <span className="text-base font-bold tabular-nums leading-none">{item.primary}</span>
            </button>
          ))}
        </div>

        {isAtNextEdge && (
          <button
            onClick={() => !nextDisabled && onSelect(nextValue)}
            disabled={nextDisabled}
            className="shrink-0 flex items-center justify-center w-9 rounded-xl bg-[var(--color-surface)] text-[var(--color-text-body)] hover:bg-[var(--color-text-muted)]/10 disabled:opacity-30 disabled:cursor-not-allowed self-stretch"
            aria-label="下一個月"
            title={nextHeaderTitle(kind, nextValue)}
          >
            →
          </button>
        )}
      </div>

      {calendarOpen && (
        <CalendarModal
          kind={kind}
          selected={selected}
          maxValue={max}
          onSelect={(v) => {
            onSelect(v);
            setCalendarOpen(false);
          }}
          onClose={() => setCalendarOpen(false)}
        />
      )}
    </div>
  );
}

// ─── Calendar grid modal ─────────────────────────────────────────────────

function CalendarModal({
  kind,
  selected,
  maxValue,
  onSelect,
  onClose,
}: {
  kind: StripKind;
  selected: string;
  maxValue: string;
  onSelect: (v: string) => void;
  onClose: () => void;
}) {
  const [viewMonth, setViewMonth] = useState(() => {
    if (kind === "day") return selected.slice(0, 7);
    return selected;
  });

  const today = todayIso();

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-[var(--color-bg)] rounded-2xl p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {kind === "day" && (
          <DayGridContent
            viewMonth={viewMonth}
            setViewMonth={setViewMonth}
            selected={selected}
            today={today}
            maxValue={maxValue}
            onSelect={onSelect}
          />
        )}
        {kind === "month" && (
          <MonthGridContent
            viewYear={viewMonth.slice(0, 4)}
            setViewYear={(y) => setViewMonth(`${y}-01`)}
            selected={selected}
            today={today}
            maxValue={maxValue}
            onSelect={onSelect}
          />
        )}
      </div>
    </div>
  );
}

function DayGridContent({
  viewMonth,
  setViewMonth,
  selected,
  today,
  maxValue,
  onSelect,
}: {
  viewMonth: string;
  setViewMonth: (next: string) => void;
  selected: string;
  today: string;
  maxValue: string;
  onSelect: (v: string) => void;
}) {
  const [yStr, mStr] = viewMonth.split("-").map(Number);
  const firstOfMonth = new Date(Date.UTC(yStr, mStr - 1, 1));
  const firstDow = firstOfMonth.getUTCDay();
  const daysInMonth = new Date(Date.UTC(yStr, mStr, 0)).getUTCDate();

  const cells: Array<{ value: string; day: number; inMonth: boolean; isWeekend: boolean }> = [];
  const monAnchored = (firstDow + 6) % 7;
  for (let i = 0; i < monAnchored; i++) {
    const d = new Date(Date.UTC(yStr, mStr - 1, -monAnchored + i + 1));
    cells.push({
      value: d.toISOString().slice(0, 10),
      day: d.getUTCDate(),
      inMonth: false,
      isWeekend: d.getUTCDay() === 0 || d.getUTCDay() === 6,
    });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const dt = new Date(Date.UTC(yStr, mStr - 1, d));
    cells.push({
      value: dt.toISOString().slice(0, 10),
      day: d,
      inMonth: true,
      isWeekend: dt.getUTCDay() === 0 || dt.getUTCDay() === 6,
    });
  }
  while (cells.length % 7 !== 0 || cells.length < 35) {
    const last = cells[cells.length - 1];
    const lastD = new Date(last.value + "T00:00:00Z");
    const next = new Date(Date.UTC(lastD.getUTCFullYear(), lastD.getUTCMonth(), lastD.getUTCDate() + 1));
    cells.push({
      value: next.toISOString().slice(0, 10),
      day: next.getUTCDate(),
      inMonth: false,
      isWeekend: next.getUTCDay() === 0 || next.getUTCDay() === 6,
    });
  }

  const shiftMonth = (delta: number) => {
    const idx = yStr * 12 + (mStr - 1) + delta;
    const ny = Math.floor(idx / 12);
    const nm = (idx % 12) + 1;
    setViewMonth(`${ny}-${String(nm).padStart(2, "0")}`);
  };

  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <button onClick={() => shiftMonth(-1)} className="text-base px-3 py-1 rounded-md hover:bg-[var(--color-surface)]">
          ←
        </button>
        <p className="text-base font-bold tabular-nums">
          <span className="text-[var(--color-text-primary)]">{mStr}月</span>{" "}
          <span className="text-[var(--color-text-muted)] font-normal">{yStr}</span>
        </p>
        <button onClick={() => shiftMonth(+1)} className="text-base px-3 py-1 rounded-md hover:bg-[var(--color-surface)]">
          →
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center mb-1.5">
        {["一", "二", "三", "四", "五", "六", "日"].map((w) => (
          <div key={w} className="text-[10px] text-[var(--color-text-muted)]">
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((c, i) => {
          const disabled = c.value > maxValue;
          const sel = c.value === selected;
          const t = c.value === today;
          return (
            <button
              key={i}
              disabled={disabled}
              onClick={() => onSelect(c.value)}
              className={`aspect-square flex items-center justify-center text-base rounded-full tabular-nums transition-colors disabled:opacity-25 ${
                sel
                  ? "bg-[var(--color-brand)] text-[var(--color-bg)] font-bold"
                  : t
                    ? "bg-[var(--color-surface)] text-[var(--color-text-primary)] font-semibold"
                    : c.inMonth
                      ? c.isWeekend
                        ? "text-[var(--color-danger)]/70 hover:bg-[var(--color-surface)]"
                        : "text-[var(--color-text-primary)] hover:bg-[var(--color-surface)]"
                      : "text-[var(--color-text-muted)]/40 hover:bg-[var(--color-surface)]"
              }`}
            >
              {c.day}
            </button>
          );
        })}
      </div>
    </>
  );
}

function MonthGridContent({
  viewYear,
  setViewYear,
  selected,
  today,
  maxValue,
  onSelect,
}: {
  viewYear: string;
  setViewYear: (y: string) => void;
  selected: string;
  today: string;
  maxValue: string;
  onSelect: (v: string) => void;
}) {
  const yy = Number(viewYear);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <button onClick={() => setViewYear(String(yy - 1))} className="text-base px-3 py-1 rounded-md hover:bg-[var(--color-surface)]">
          ←
        </button>
        <p className="text-base font-bold tabular-nums text-[var(--color-text-primary)]">{yy} 年</p>
        <button onClick={() => setViewYear(String(yy + 1))} className="text-base px-3 py-1 rounded-md hover:bg-[var(--color-surface)]">
          →
        </button>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {months.map((m) => {
          const value = `${yy}-${String(m).padStart(2, "0")}`;
          const sel = value === selected;
          const t = value === today.slice(0, 7);
          const disabled = value > maxValue.slice(0, 7);
          return (
            <button
              key={m}
              disabled={disabled}
              onClick={() => onSelect(value)}
              className={`py-3 rounded-xl text-base tabular-nums font-semibold transition-colors disabled:opacity-25 ${
                sel
                  ? "bg-[var(--color-brand)] text-[var(--color-bg)]"
                  : t
                    ? "bg-[var(--color-surface)] text-[var(--color-text-primary)]"
                    : "text-[var(--color-text-body)] hover:bg-[var(--color-surface)]"
              }`}
            >
              {m} 月
            </button>
          );
        })}
      </div>
    </>
  );
}

// ─── helpers ─────────────────────────────────────────────────────────────

function defaultForKind(kind: StripKind): string {
  const t = todayIso();
  if (kind === "day") return t;
  if (kind === "month") return t.slice(0, 7);
  return t.slice(0, 4);
}

function generateMonthDays(selected: string, today: string, maxIso: string): StripItem[] {
  const [y, m] = selected.split("-").map(Number);
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const items: StripItem[] = [];
  for (let d = 1; d <= lastDay; d++) {
    const dt = new Date(Date.UTC(y, m - 1, d));
    const iso = dt.toISOString().slice(0, 10);
    const dow = dt.getUTCDay();
    items.push({
      value: iso,
      primary: String(d),
      secondary: WEEKDAYS_SHORT[dow],
      isSelected: iso === selected,
      isToday: iso === today,
      isWeekend: dow === 0 || dow === 6,
      isDisabled: iso > maxIso,
    });
  }
  return items;
}

function generateYearMonths(selected: string, today: string, maxKey: string): StripItem[] {
  const [y] = selected.split("-").map(Number);
  const items: StripItem[] = [];
  const todayMonthKey = today.slice(0, 7);
  for (let m = 1; m <= 12; m++) {
    const value = `${y}-${String(m).padStart(2, "0")}`;
    items.push({
      value,
      primary: `${m}月`,
      secondary: undefined,
      isSelected: value === selected,
      isToday: value === todayMonthKey,
      isDisabled: value > maxKey.slice(0, 7),
    });
  }
  return items;
}

function generateYearRange(selected: string, today: string, maxKey: string): StripItem[] {
  const yy = Number(selected);
  const items: StripItem[] = [];
  const todayYear = today.slice(0, 4);
  for (let i = -5; i <= 4; i++) {
    const value = String(yy + i);
    items.push({
      value,
      primary: value,
      isSelected: value === selected,
      isToday: value === todayYear,
      isDisabled: value > maxKey.slice(0, 4),
    });
  }
  return items;
}

function computeNeighbours(
  kind: StripKind,
  selected: string,
): { prevValue: string; nextValue: string; isAtPrevEdge: boolean; isAtNextEdge: boolean } {
  if (kind === "day") {
    const [y, m, d] = selected.split("-").map(Number);
    const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const prevDt = new Date(Date.UTC(y, m - 1, 0));
    const prevIso = prevDt.toISOString().slice(0, 10);
    const nextDt = new Date(Date.UTC(y, m, 1));
    const nextIso = nextDt.toISOString().slice(0, 10);
    return {
      prevValue: prevIso,
      nextValue: nextIso,
      isAtPrevEdge: d === 1,
      isAtNextEdge: d === lastDay,
    };
  }
  if (kind === "month") {
    const [y, m] = selected.split("-").map(Number);
    const prevValue = `${y - 1}-12`;
    const nextValue = `${y + 1}-01`;
    return {
      prevValue,
      nextValue,
      isAtPrevEdge: m === 1,
      isAtNextEdge: m === 12,
    };
  }
  const yy = Number(selected);
  return {
    prevValue: String(yy - 10),
    nextValue: String(yy + 10),
    isAtPrevEdge: false,
    isAtNextEdge: false,
  };
}

function formatHeader(kind: StripKind, value: string): string {
  if (kind === "day") {
    const [, m, d] = value.split("-").map(Number);
    return `${m}月${d}日`;
  }
  if (kind === "month") {
    const [y, m] = value.split("-").map(Number);
    return `${y}年${m}月`;
  }
  return `${value} 年度`;
}

function prevHeaderTitle(kind: StripKind, prevValue: string): string {
  if (kind === "day") {
    const [, m] = prevValue.split("-").map(Number);
    return `回到 ${m} 月`;
  }
  if (kind === "month") return `回到 ${prevValue.slice(0, 4)} 年`;
  return "上一段年份";
}

function nextHeaderTitle(kind: StripKind, nextValue: string): string {
  if (kind === "day") {
    const [, m] = nextValue.split("-").map(Number);
    return `前往 ${m} 月`;
  }
  if (kind === "month") return `前往 ${nextValue.slice(0, 4)} 年`;
  return "下一段年份";
}
