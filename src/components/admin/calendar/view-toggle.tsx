"use client";

/**
 * Day / Week / Month segmented toggle (PRD-v3 D-6).
 * Three equal buttons in a single rounded row, brand-bordered.
 * Extracted in Wave 3.A / A1.
 */

import type { CalendarView } from "./types";

interface Props {
  view: CalendarView;
  onChange: (v: CalendarView) => void;
}

const LABELS: Record<CalendarView, string> = { day: "日", week: "週", month: "月" };

export function ViewToggle({ view, onChange }: Props) {
  return (
    <div className="grid grid-cols-3 mb-2 border border-[var(--color-brand)] rounded-lg overflow-hidden w-full">
      {(["day", "week", "month"] as const).map((v) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          className={`py-2 text-sm font-medium transition-colors min-w-0 ${
            view === v
              ? "bg-[var(--color-brand)] text-[var(--color-bg)]"
              : "text-[var(--color-brand)] hover:bg-[var(--color-brand)]/5"
          }`}
        >
          {LABELS[v]}
        </button>
      ))}
    </div>
  );
}
