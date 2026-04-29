interface ThreeWayDecompositionProps {
  /** 客數 */
  customers: number;
  /** 客單價 */
  ticket: number;
  /** 月營收（= customers × ticket，display only） */
  revenue: number;
}

const fmt = (n: number) => `NT$${n.toLocaleString()}`;

export function ThreeWayDecomposition({
  customers,
  ticket,
  revenue,
}: ThreeWayDecompositionProps) {
  return (
    <div className="bg-[var(--color-surface)]/40 rounded-lg p-3 border border-[var(--color-brand)]/8">
      <div className="grid grid-cols-3 items-center gap-2">
        <Cell label="服務客數" value={customers.toLocaleString()} unit="人" />
        <Cell label="客單價" value={fmt(ticket)} unit="" />
        <Cell label="月營收" value={fmt(revenue)} unit="" highlight />
      </div>
      <p className="text-[10px] text-[var(--color-text-muted)] text-center mt-2 font-mono">
        {customers.toLocaleString()} × NT${ticket.toLocaleString()} = {fmt(revenue)}
      </p>
    </div>
  );
}

function Cell({
  label,
  value,
  unit,
  highlight,
}: {
  label: string;
  value: string;
  unit: string;
  highlight?: boolean;
}) {
  return (
    <div className="text-center">
      <p className="text-[10px] tracking-wider text-[var(--color-text-muted)] uppercase">
        {label}
      </p>
      <p
        className={`text-base font-bold tabular-nums mt-0.5 ${
          highlight ? "text-[var(--color-brand)]" : "text-[var(--color-text-primary)]"
        }`}
      >
        {value}
        {unit && <span className="text-xs font-normal text-[var(--color-text-muted)] ml-0.5">{unit}</span>}
      </p>
    </div>
  );
}
