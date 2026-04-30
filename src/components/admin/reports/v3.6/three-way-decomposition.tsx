interface ThreeWayDecompositionProps {
  /** 客數 */
  customers: number;
  /** 客單價 */
  ticket: number;
  /** 月營收（= customers × ticket，display only） */
  revenue: number;
}

// V3.8 老闆反映：「不用寫 NT 哦，就直接寫多少，大家都會知道是台幣」
// 直接 toLocaleString() 不加前綴。
const fmt = (n: number) => n.toLocaleString();

export function ThreeWayDecomposition({
  customers,
  ticket,
  revenue,
}: ThreeWayDecompositionProps) {
  return (
    <div className="bg-[var(--color-surface)]/40 rounded-xl p-4 sm:p-5 border border-[var(--color-brand)]/8">
      <div className="grid grid-cols-3 items-center gap-3 sm:gap-4">
        <Cell label="服務客數" value={customers.toLocaleString()} unit="人" />
        <Cell label="客單價" value={fmt(ticket)} unit="" />
        <Cell label="月營收" value={fmt(revenue)} unit="" highlight />
      </div>
      <p className="text-xs text-[var(--color-text-muted)] text-center mt-3 font-mono tabular-nums break-all">
        {customers.toLocaleString()} × {ticket.toLocaleString()} = {fmt(revenue)}
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
    <div className="text-center min-w-0">
      <p className="text-[11px] tracking-wider text-[var(--color-text-muted)] uppercase truncate">
        {label}
      </p>
      <p
        className={`text-lg sm:text-2xl font-bold tabular-nums mt-1 break-all leading-tight ${
          highlight ? "text-[var(--color-brand)]" : "text-[var(--color-text-primary)]"
        }`}
      >
        {value}
        {unit && <span className="text-sm font-normal text-[var(--color-text-muted)] ml-0.5">{unit}</span>}
      </p>
    </div>
  );
}
