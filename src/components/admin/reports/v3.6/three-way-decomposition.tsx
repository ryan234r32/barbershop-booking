interface ThreeWayDecompositionProps {
  /** 客數 */
  customers: number;
  /** 客單價 */
  ticket: number;
  /** 月營收（= customers × ticket，display only） */
  revenue: number;
}

const fmt = (n: number) => n.toLocaleString();

// V3.10 老闆 feedback：「月營收」cell 的 30,400 在窄手機被擠成「30,40 / 0」兩行。
// Hero 上方已經有大字「本月營收 30,400」，這裡再放一遍是冗余 → 改 2-col 只放
// 客數 + 客單價，月營收用底下的 equation footer 帶出（粗+brand 色強調）。
export function ThreeWayDecomposition({
  customers,
  ticket,
  revenue,
}: ThreeWayDecompositionProps) {
  return (
    <div className="bg-[var(--color-surface)]/40 rounded-xl p-4 sm:p-5 border border-[var(--color-brand)]/8">
      <div className="grid grid-cols-2 items-center gap-4 sm:gap-6">
        <Cell label="服務客數" value={customers.toLocaleString()} unit="人" />
        <Cell label="客單價" value={fmt(ticket)} unit="" />
      </div>
      <p className="text-xs sm:text-sm text-[var(--color-text-muted)] text-center mt-3 pt-3 border-t border-[var(--color-brand)]/8 font-mono tabular-nums">
        {customers.toLocaleString()} × {ticket.toLocaleString()} ={" "}
        <span className="font-bold text-[var(--color-brand)]">{fmt(revenue)}</span>
      </p>
    </div>
  );
}

function Cell({
  label,
  value,
  unit,
}: {
  label: string;
  value: string;
  unit: string;
}) {
  return (
    <div className="text-center min-w-0">
      <p className="text-xs sm:text-sm tracking-wider text-[var(--color-text-muted)] uppercase">
        {label}
      </p>
      <p className="text-2xl sm:text-3xl font-bold tabular-nums mt-1.5 leading-tight text-[var(--color-text-primary)] whitespace-nowrap">
        {value}
        {unit && (
          <span className="text-base font-normal text-[var(--color-text-muted)] ml-0.5">
            {unit}
          </span>
        )}
      </p>
    </div>
  );
}
