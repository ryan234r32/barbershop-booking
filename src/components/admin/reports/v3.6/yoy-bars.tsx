import type { YoYResult } from "@/lib/reports/v3.6/aggregates";

interface YoYBarsProps {
  data: YoYResult;
  /** When false → show "資料準備中" placeholder per V3.6 §10 Q6 */
  hasLastYearData: boolean;
}

export function YoYBars({ data, hasLastYearData }: YoYBarsProps) {
  if (!hasLastYearData) {
    return (
      <div className="bg-[var(--color-surface)]/40 rounded-lg p-6 text-center text-sm text-[var(--color-text-muted)] space-y-1.5">
        <div className="text-2xl opacity-40">📊</div>
        <p className="font-medium text-[var(--color-text-body)]">2024 年同期資料準備中</p>
        <p className="text-xs">
          老闆 Excel 匯入後此區塊自動啟用 — 屆時將顯示 12 月雙色 YoY 對比 + 累計 YoY%
        </p>
      </div>
    );
  }

  const max = Math.max(
    ...data.points.map((p) => Math.max(p.thisYear, p.lastYear)),
    1,
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-3">
          <Legend color="var(--color-text-muted)" label="去年" />
          <Legend color="var(--color-brand)" label="今年" />
        </div>
        {data.cumulativeYoyPct !== null && (
          <span
            className={`tabular-nums font-semibold ${
              data.cumulativeYoyPct > 0
                ? "text-[var(--color-success)]"
                : "text-[var(--color-danger)]"
            }`}
          >
            累計 YoY {data.cumulativeYoyPct > 0 ? "+" : ""}
            {data.cumulativeYoyPct.toFixed(1)}%
          </span>
        )}
      </div>

      <div className="space-y-1.5">
        {data.points.map((p) => (
          <div key={p.month} className="grid grid-cols-[2.5rem_1fr_3.5rem] items-center gap-2">
            <span className="text-xs text-[var(--color-text-muted)] font-mono">{p.monthLabel}</span>
            <div className="flex flex-col gap-0.5">
              <Bar value={p.lastYear} max={max} color="var(--color-text-muted)" opacity={0.5} />
              <Bar value={p.thisYear} max={max} color="var(--color-brand)" opacity={0.85} />
            </div>
            <span
              className={`text-[10px] tabular-nums text-right font-semibold ${
                p.yoyPct === null
                  ? "text-[var(--color-text-muted)]"
                  : p.yoyPct >= 0
                    ? "text-[var(--color-success)]"
                    : "text-[var(--color-danger)]"
              }`}
            >
              {p.yoyPct === null ? "—" : `${p.yoyPct >= 0 ? "+" : ""}${p.yoyPct.toFixed(0)}%`}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-[var(--color-text-muted)]">
      <span
        className="inline-block w-2.5 h-2.5 rounded-sm"
        style={{ backgroundColor: color }}
      />
      <span>{label}</span>
    </span>
  );
}

function Bar({
  value,
  max,
  color,
  opacity,
}: {
  value: number;
  max: number;
  color: string;
  opacity: number;
}) {
  const w = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="relative bg-[var(--color-surface)] h-3 rounded-sm overflow-hidden">
      <div
        className="h-full rounded-sm transition-all"
        style={{ width: `${w}%`, backgroundColor: color, opacity }}
      />
      <span className="absolute inset-0 flex items-center pl-2 text-[9px] font-mono text-[var(--color-text-primary)]">
        {value > 0 ? `NT$${Math.round(value / 1000)}k` : ""}
      </span>
    </div>
  );
}
