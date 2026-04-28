interface ProgressBarProps {
  /** 0-100, can exceed if > target */
  value: number;
  /** position of benchmark marker on bar (0-100) — optional */
  benchmark?: number;
  /** label to show on the right */
  rightLabel?: string;
  /** color band — defaults to brand */
  tone?: "brand" | "success" | "warning" | "danger";
}

const TONE_CLASS: Record<NonNullable<ProgressBarProps["tone"]>, string> = {
  brand: "bg-[var(--color-brand)]",
  success: "bg-[var(--color-success)]",
  warning: "bg-[var(--color-warning)]",
  danger: "bg-[var(--color-danger)]",
};

export function ProgressBar({
  value,
  benchmark,
  rightLabel,
  tone = "brand",
}: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <div>
      <div className="relative h-2.5 bg-[var(--color-surface)] rounded-full overflow-hidden">
        <div
          className={`absolute top-0 left-0 h-full ${TONE_CLASS[tone]} rounded-full transition-all`}
          style={{ width: `${clamped}%` }}
        />
        {benchmark != null && (
          <div
            className="absolute top-[-4px] bottom-[-4px] w-[2px] bg-[var(--color-text-primary)]"
            style={{ left: `${Math.min(100, Math.max(0, benchmark))}%` }}
            aria-label="benchmark"
          />
        )}
      </div>
      {rightLabel && (
        <p className="text-[11px] text-[var(--color-text-muted)] tabular-nums mt-1 text-right">
          {rightLabel}
        </p>
      )}
    </div>
  );
}
