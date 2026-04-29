import type { ReactNode } from "react";
import { MCard } from "./m-card";
import { MTag } from "./m-tag";

type Status = "ok" | "warning" | "danger" | "neutral";

/**
 * Multi-tier benchmark bar (V3.6 feedback Pass 1):
 * Shows a 0-100 bar with 2-3 tier markers and the current value as a colored fill.
 *
 * Example: { current: 36.6, tiers: [
 *   { at: 0, label: "0%" },
 *   { at: 40, label: "業界平均 40%" },
 *   { at: 65, label: "頂尖 65%" },
 * ]}
 */
export interface BenchmarkBar {
  /** Current value 0-100 (% scale assumed by default; pass scaled values otherwise) */
  current: number;
  /** Tier markers from low to high. Each anchored on a 0-100 scale. */
  tiers: Array<{ at: number; label: string }>;
}

interface KpiCardProps {
  label: string;
  primary: string | ReactNode;
  secondary?: string | ReactNode;
  /** vs prev period delta in % (signed). Pass null to hide. */
  deltaPct?: number | null;
  /** comparison label: "上月" / "去年同月" */
  comparisonLabel?: string;
  /** Multi-tier benchmark bar */
  benchmark?: BenchmarkBar;
  status?: Status;
}

const STATUS_BAND: Record<Status, string | undefined> = {
  ok: "var(--color-success)",
  warning: "var(--color-warning)",
  danger: "var(--color-danger)",
  neutral: undefined,
};

const STATUS_LABEL: Record<Status, string> = {
  ok: "綠燈",
  warning: "黃燈",
  danger: "紅燈",
  neutral: "",
};

const STATUS_FILL: Record<Status, string> = {
  ok: "var(--color-success)",
  warning: "var(--color-warning)",
  danger: "var(--color-danger)",
  neutral: "var(--color-brand)",
};

function deltaClass(delta: number | null | undefined): string {
  if (delta == null) return "text-[var(--color-text-muted)]";
  if (delta > 0) return "text-[var(--color-success)]";
  if (delta < 0) return "text-[var(--color-danger)]";
  return "text-[var(--color-text-muted)]";
}

export function KpiCard({
  label,
  primary,
  secondary,
  deltaPct,
  comparisonLabel,
  benchmark,
  status = "neutral",
}: KpiCardProps) {
  return (
    <MCard leftBand={STATUS_BAND[status]} padding="md">
      <div className="flex items-start justify-between gap-2 mb-1">
        <p className="text-xs font-medium text-[var(--color-text-body)]">{label}</p>
        {status !== "neutral" && (
          <MTag tone={status === "ok" ? "success" : status === "warning" ? "warning" : "danger"}>
            {STATUS_LABEL[status]}
          </MTag>
        )}
      </div>

      <p className="text-3xl font-bold text-[var(--color-text-primary)] truncate tabular-nums leading-tight">
        {primary}
      </p>

      {(deltaPct != null && comparisonLabel) || secondary ? (
        <div className="mt-1 space-y-0.5">
          {deltaPct != null && comparisonLabel && (
            <p className={`text-[11px] tabular-nums ${deltaClass(deltaPct)}`}>
              {deltaPct > 0 ? "↑" : deltaPct < 0 ? "↓" : "—"} {Math.abs(deltaPct).toFixed(1)}
              {String(primary).includes("%") ? "pp" : "%"} vs {comparisonLabel}
            </p>
          )}
          {secondary && (
            <p className="text-[11px] text-[var(--color-text-muted)] tabular-nums truncate">
              {secondary}
            </p>
          )}
        </div>
      ) : null}

      {benchmark && <BenchmarkRail benchmark={benchmark} status={status} />}
    </MCard>
  );
}

function BenchmarkRail({
  benchmark,
  status,
}: {
  benchmark: BenchmarkBar;
  status: Status;
}) {
  const fill = STATUS_FILL[status];
  const clamped = Math.min(100, Math.max(0, benchmark.current));
  return (
    <div className="mt-3 pt-2 border-t border-[var(--color-brand)]/8 select-none">
      {/* Tier labels above the bar */}
      <div className="relative h-3 mb-1">
        {benchmark.tiers.map((t, i) => {
          const left = Math.min(100, Math.max(0, t.at));
          const isFirst = i === 0;
          const isLast = i === benchmark.tiers.length - 1;
          return (
            <span
              key={i}
              className="absolute text-[9px] text-[var(--color-text-muted)] whitespace-nowrap"
              style={{
                left: `${left}%`,
                transform: isFirst
                  ? "translateX(0)"
                  : isLast
                    ? "translateX(-100%)"
                    : "translateX(-50%)",
                top: 0,
              }}
            >
              {t.label}
            </span>
          );
        })}
      </div>
      {/* Bar with thermometer fill + tier ticks */}
      <div className="relative h-1.5 bg-[var(--color-surface)] rounded-full overflow-visible">
        <div
          className="absolute top-0 left-0 h-full rounded-full"
          style={{ width: `${clamped}%`, backgroundColor: fill, opacity: 0.85 }}
        />
        {benchmark.tiers.slice(1).map((t, i) => (
          <div
            key={i}
            className="absolute top-[-2px] bottom-[-2px] w-px bg-[var(--color-text-primary)]/40"
            style={{ left: `${Math.min(100, Math.max(0, t.at))}%` }}
            aria-hidden
          />
        ))}
      </div>
    </div>
  );
}
