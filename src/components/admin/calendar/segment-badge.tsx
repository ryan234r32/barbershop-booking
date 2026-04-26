/**
 * Customer segment pill (NEW / REGULAR / VIP / AT_RISK / LAPSED).
 * Extracted from calendar/page.tsx in Wave 3.A / A1.
 */

export function SegmentBadge({ segment }: { segment: string }) {
  const styles: Record<string, string> = {
    VIP: "bg-[var(--color-warning)]/15 text-[var(--color-warning)]",
    REGULAR: "bg-[var(--color-success)]/15 text-[var(--color-success)]",
    NEW: "bg-[var(--color-brand)]/10 text-[var(--color-brand)]",
    AT_RISK: "bg-[var(--color-warning)]/15 text-[var(--color-warning)]",
    LAPSED: "bg-[var(--color-danger)]/15 text-[var(--color-danger)]",
  };
  const labels: Record<string, string> = {
    VIP: "VIP",
    REGULAR: "常客",
    NEW: "新客",
    AT_RISK: "流失中",
    LAPSED: "已流失",
  };
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium tracking-wider ${styles[segment] || styles.NEW}`}
    >
      {labels[segment] || segment}
    </span>
  );
}
