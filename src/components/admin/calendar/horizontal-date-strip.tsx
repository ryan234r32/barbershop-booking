"use client";

/**
 * Horizontal scrollable date strip used at top of day view.
 * Smooth scroll, tap to select. Centers the selected date in a 7-day window.
 * Extracted from calendar/page.tsx during Wave 3.A / A1 refactor.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { WEEKDAYS, formatDate, toTaipeiDate } from "./utils";

interface Props {
  currentDate: Date;
  onSelect: (d: Date) => void;
}

export function HorizontalDateStrip({ currentDate, onSelect }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const DAYS_BEFORE = 30;
  const DAYS_AFTER = 30;
  const VISIBLE_DAYS = 7;

  // Dynamic cell width — divide container width by 7 so exactly 7 days fit
  const [cellWidth, setCellWidth] = useState(52);
  useEffect(() => {
    const update = () => {
      const el = containerRef.current;
      if (!el || el.clientWidth <= 0) return;
      setCellWidth(Math.floor(el.clientWidth / VISIBLE_DAYS));
    };
    update();
    window.addEventListener("resize", update);
    const raf = requestAnimationFrame(update);
    return () => {
      window.removeEventListener("resize", update);
      cancelAnimationFrame(raf);
    };
  }, []);

  // Generate strip dates: 30 before + current + 30 after = 61 days
  const dates = useMemo(() => {
    const list: Date[] = [];
    for (let offset = -DAYS_BEFORE; offset <= DAYS_AFTER; offset++) {
      const d = new Date(currentDate);
      d.setDate(d.getDate() + offset);
      list.push(d);
    }
    return list;
  }, [currentDate]);

  // Center the selected date in the visible 7-day window
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const selectedIndex = DAYS_BEFORE;
    const targetScroll =
      selectedIndex * cellWidth - container.clientWidth / 2 + cellWidth / 2;
    container.scrollTo({ left: Math.max(0, targetScroll), behavior: "auto" });
  }, [currentDate, cellWidth]);

  const todayStr = formatDate(toTaipeiDate(new Date()));
  const currentStr = formatDate(currentDate);

  return (
    <div
      ref={containerRef}
      className="flex items-stretch mb-2 select-none overflow-x-auto scrollbar-hide pb-1 w-full"
      style={{ WebkitOverflowScrolling: "touch" }}
    >
      {dates.map((d) => {
        const dStr = formatDate(d);
        const selected = dStr === currentStr;
        const isToday = dStr === todayStr;
        const wdIndex = d.getDay();
        const isWeekend = wdIndex === 0 || wdIndex === 6;
        return (
          <button
            key={dStr}
            onClick={() => onSelect(d)}
            className={`shrink-0 flex flex-col items-center gap-0.5 py-2 rounded-lg transition-colors ${
              selected
                ? "bg-[var(--color-brand)]"
                : "hover:bg-[var(--color-surface)]"
            }`}
            style={{ width: cellWidth }}
          >
            <span
              className={`text-[11px] leading-none ${
                selected
                  ? "text-[var(--color-bg)]/80"
                  : isWeekend
                    ? "text-[var(--color-danger)]"
                    : "text-[var(--color-text-muted)]"
              }`}
            >
              {WEEKDAYS[wdIndex]}
            </span>
            <span
              className={`text-[15px] font-semibold leading-tight ${
                selected
                  ? "text-[var(--color-bg)]"
                  : isWeekend
                    ? "text-[var(--color-danger)]"
                    : "text-[var(--color-text-primary)]"
              }`}
            >
              {d.getDate()}
            </span>
            {isToday && !selected && (
              <span className="w-1 h-1 rounded-full bg-[var(--color-brand)]" />
            )}
          </button>
        );
      })}
    </div>
  );
}
