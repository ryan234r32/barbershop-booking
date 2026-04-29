"use client";

import { useMemo, useEffect, useRef } from "react";

/**
 * V3.6 feedback Pass 1 — horizontal swipeable date / month / year picker.
 *
 * Reference design: iOS-native date strip (週五 24, 週六 25, ... 週四 30)
 * with the selected day highlighted (filled circle).
 *
 * Renders a row of 7 items centered on the selected value, scrollable
 * horizontally. Tapping an item selects it. The component is purely
 * presentational — parent owns selected state.
 */

type StripKind = "day" | "month" | "year";

interface DateStripProps {
  kind: StripKind;
  /** ISO format: "YYYY-MM-DD" for day, "YYYY-MM" for month, "YYYY" for year */
  selected: string;
  onSelect: (next: string) => void;
  /** Disable items past this value (inclusive). For day: ISO date. */
  maxValue?: string;
  /** Number of items to render around selected. Default 7. */
  windowSize?: number;
}

interface StripItem {
  value: string;
  primary: string;   // big number
  secondary?: string; // small label above (週X for day, 季 for month, etc.)
  isSelected: boolean;
  isToday: boolean;
  isWeekend?: boolean;
  isDisabled: boolean;
}

const WEEKDAYS = ["週日", "週一", "週二", "週三", "週四", "週五", "週六"];

function todayIso(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Taipei" });
}

export function DateStrip({
  kind,
  selected,
  onSelect,
  maxValue,
  windowSize = 7,
}: DateStripProps) {
  const today = todayIso();
  const max = maxValue ?? today;

  const items = useMemo<StripItem[]>(() => {
    const half = Math.floor(windowSize / 2);
    if (kind === "day") {
      return generateDayItems(selected, today, max, half);
    }
    if (kind === "month") {
      return generateMonthItems(selected, today, max.slice(0, 7), half);
    }
    return generateYearItems(selected, today, max.slice(0, 4), half);
  }, [kind, selected, today, max, windowSize]);

  // Auto-scroll selected item into center after render
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = containerRef.current?.querySelector(`[data-selected="true"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [selected]);

  const headerLabel = useMemo(() => formatHeader(kind, selected), [kind, selected]);
  const isAtToday = (kind === "day" && selected === today)
    || (kind === "month" && selected === today.slice(0, 7))
    || (kind === "year" && selected === today.slice(0, 4));

  return (
    <div className="space-y-1.5">
      {/* Header — current selected formatted big + 今天 jump */}
      <div className="flex items-center justify-between px-1">
        <p className="text-base font-bold text-[var(--color-text-primary)] tabular-nums">
          {headerLabel}
        </p>
        {!isAtToday && (
          <button
            onClick={() => onSelect(defaultForKind(kind))}
            className="text-xs px-3 py-1 rounded-full bg-[var(--color-surface)] text-[var(--color-text-body)] font-medium hover:bg-[var(--color-text-muted)]/10"
          >
            今{kind === "day" ? "天" : kind === "month" ? "月" : "年"}
          </button>
        )}
      </div>

      {/* Strip */}
      <div
        ref={containerRef}
        className="flex gap-1 overflow-x-auto pb-1 -mx-1 px-1 snap-x snap-proximity scrollbar-hide"
        style={{ scrollbarWidth: "none" }}
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
    </div>
  );
}

// ─── helpers ─────────────────────────────────────────────────────────────

function defaultForKind(kind: StripKind): string {
  const t = todayIso();
  if (kind === "day") return t;
  if (kind === "month") return t.slice(0, 7);
  return t.slice(0, 4);
}

function generateDayItems(
  selected: string,
  today: string,
  maxIso: string,
  half: number,
): StripItem[] {
  const items: StripItem[] = [];
  const [y, m, d] = selected.split("-").map(Number);
  for (let i = -half; i <= half; i++) {
    const dt = new Date(Date.UTC(y, m - 1, d + i));
    const iso = dt.toISOString().slice(0, 10);
    const dow = dt.getUTCDay();
    items.push({
      value: iso,
      primary: String(dt.getUTCDate()),
      secondary: WEEKDAYS[dow],
      isSelected: iso === selected,
      isToday: iso === today,
      isWeekend: dow === 0 || dow === 6,
      isDisabled: iso > maxIso,
    });
  }
  return items;
}

function generateMonthItems(
  selected: string,
  today: string,
  maxKey: string,
  half: number,
): StripItem[] {
  const items: StripItem[] = [];
  const [yStr, mStr] = selected.split("-").map(Number);
  for (let i = -half; i <= half; i++) {
    const idx = yStr * 12 + (mStr - 1) + i;
    const yy = Math.floor(idx / 12);
    const mm = (idx % 12) + 1;
    const value = `${yy}-${String(mm).padStart(2, "0")}`;
    items.push({
      value,
      primary: `${mm}月`,
      secondary: yy !== Number(today.slice(0, 4)) ? String(yy) : undefined,
      isSelected: value === selected,
      isToday: value === today.slice(0, 7),
      isDisabled: value > maxKey,
    });
  }
  return items;
}

function generateYearItems(
  selected: string,
  today: string,
  maxKey: string,
  half: number,
): StripItem[] {
  const items: StripItem[] = [];
  const yy = Number(selected);
  for (let i = -half; i <= half; i++) {
    const value = String(yy + i);
    items.push({
      value,
      primary: value,
      isSelected: value === selected,
      isToday: value === today.slice(0, 4),
      isDisabled: value > maxKey,
    });
  }
  return items;
}

function formatHeader(kind: StripKind, value: string): string {
  if (kind === "day") {
    const [y, m, d] = value.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    const dow = dt.getUTCDay();
    return `${m}月${d}日, ${y}（${WEEKDAYS[dow]}）`;
  }
  if (kind === "month") {
    const [y, m] = value.split("-").map(Number);
    return `${y} 年 ${m} 月`;
  }
  return `${value} 年度`;
}
