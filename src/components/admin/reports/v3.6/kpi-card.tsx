import type { ReactNode } from "react";
import { MCard } from "./m-card";
import { MTag } from "./m-tag";

type Status = "ok" | "warning" | "danger" | "neutral";

interface KpiCardProps {
  label: string;
  primary: string | ReactNode;
  secondary?: string | ReactNode;
  /** vs prev period delta in % (signed). Pass null to hide. */
  deltaPct?: number | null;
  /** comparison label: "上月" / "去年同月" */
  comparisonLabel?: string;
  /** Industry benchmark — renders as horizontal bar with target line */
  benchmark?: {
    /** label e.g. "業界 50%+" */
    label: string;
    /** position of marker on benchmark bar (0-100) */
    target: number;
    /** position of CURRENT value on benchmark bar (0-100) */
    current: number;
  };
  status?: Status;
}

const STATUS_BAND: Record<Status, string | undefined> = {
  ok: "var(--color-success)",
  warning: "var(--color-warning)",
  danger: "var(--color-danger)",
  neutral: undefined,
};

const STATUS_LABEL: Record<Status, string> = {
  ok: "🟢 達標",
  warning: "🟡 待加強",
  danger: "🔴 警戒",
  neutral: "",
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
        <p className="text-[10px] tracking-wider text-[var(--color-text-muted)] uppercase whitespace-nowrap">
          {label}
        </p>
        {status !== "neutral" && <MTag tone={status === "ok" ? "success" : status === "warning" ? "warning" : "danger"}>{STATUS_LABEL[status]}</MTag>}
      </div>

      <p className="text-2xl font-bold text-[var(--color-text-primary)] truncate tabular-nums leading-tight">
        {primary}
      </p>

      {secondary && (
        <p className="text-[11px] text-[var(--color-text-muted)] tabular-nums truncate mt-1">
          {secondary}
        </p>
      )}

      {deltaPct != null && comparisonLabel && (
        <p className={`text-[11px] mt-0.5 tabular-nums ${deltaClass(deltaPct)}`}>
          {deltaPct > 0 ? "↑" : deltaPct < 0 ? "↓" : "—"} {Math.abs(deltaPct).toFixed(1)}% vs {comparisonLabel}
        </p>
      )}

      {benchmark && (
        <div className="mt-3 pt-2 border-t border-[var(--color-brand)]/8">
          <p className="text-[10px] text-[var(--color-text-muted)] mb-1.5">{benchmark.label}</p>
          <div className="relative h-1.5 bg-[var(--color-surface)] rounded-full overflow-hidden">
            <div
              className="absolute top-0 left-0 h-full bg-[var(--color-brand)]/70 rounded-full"
              style={{ width: `${Math.min(100, Math.max(0, benchmark.current))}%` }}
            />
            <div
              className="absolute top-[-4px] bottom-[-4px] w-[2px] bg-[var(--color-text-primary)]"
              style={{ left: `${Math.min(100, Math.max(0, benchmark.target))}%` }}
              aria-label="benchmark target"
            />
          </div>
        </div>
      )}
    </MCard>
  );
}
