import { memo } from "react";

interface CohortSegment {
  key: string;
  label: string;
  pct: number;
  color: string;
  count: number;
  revenue?: number;
}

interface CohortStackedBarProps {
  segments: CohortSegment[];
  /** title for top label */
  title?: string;
}

/**
 * 7-color horizontal stacked bar (V3.6 §7.1 ②). Used in annual view to show
 * customer cohort revenue contribution. Must add to ~100% to look right.
 */
// V3.8 perf (Wave 2): memo'd — segments.map × 2 (bar + legend)，annual view 重渲時免費省。
function CohortStackedBarImpl({ segments }: CohortStackedBarProps) {
  const total = segments.reduce((s, x) => s + x.pct, 0) || 1;
  return (
    <div>
      <div className="flex h-8 rounded-md overflow-hidden border border-[var(--color-brand)]/12">
        {segments.map((s) => (
          <div
            key={s.key}
            className="relative flex items-center justify-center text-[10px] font-bold text-white tabular-nums"
            style={{
              width: `${(s.pct / total) * 100}%`,
              backgroundColor: s.color,
              minWidth: s.pct < 2 ? "0" : "1.5rem",
            }}
          >
            {s.pct >= 8 && `${s.pct.toFixed(1)}%`}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-1 mt-3">
        {segments.map((s) => (
          <div key={s.key} className="flex items-center text-[11px]">
            <span
              className="inline-block w-2.5 h-2.5 rounded-sm mr-1.5 shrink-0"
              style={{ backgroundColor: s.color }}
            />
            <span className="flex-1 text-[var(--color-text-body)] truncate">{s.label}</span>
            <span className="font-mono text-[var(--color-text-muted)] tabular-nums ml-1">
              {s.pct.toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export const CohortStackedBar = memo(CohortStackedBarImpl);
