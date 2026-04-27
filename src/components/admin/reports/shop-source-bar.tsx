/**
 * Stacked horizontal bar — shopNew (新店面客) vs shopOld (舊店面客) per quarter.
 * Powers the "客戶來源（店面維度）" widget the owner explicitly asked for in
 * the second interview ("一季成長多少", "新客 / 舊客比例").
 */

interface ShopSourceQuarterEntry {
  label: string;
  fromIso: string;
  toIso: string;
  shopNew: number;
  shopOld: number;
}

export function ShopSourceBar({ quarters }: { quarters: ShopSourceQuarterEntry[] }) {
  if (quarters.length === 0) return null;
  const max = Math.max(...quarters.map((q) => q.shopNew + q.shopOld), 1);
  const totalNew = quarters.reduce((s, q) => s + q.shopNew, 0);
  const totalOld = quarters.reduce((s, q) => s + q.shopOld, 0);

  return (
    <div className="bg-[var(--color-surface)] rounded-2xl p-5 space-y-3">
      <div>
        <h3 className="text-sm font-bold text-[var(--color-text-primary)]">
          每季新進客戶（按店面身份分）
        </h3>
        <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
          🟦 新店面客 = 第一次來的新客 / 🟫 舊店面客 = 從舊店面跟過來
        </p>
      </div>

      <div className="space-y-2">
        {quarters.map((q) => {
          const total = q.shopNew + q.shopOld;
          const totalPct = (total / max) * 100;
          const newPctOfRow = total > 0 ? (q.shopNew / total) * 100 : 0;
          return (
            <div key={q.label} className="flex items-center gap-2">
              <span className="text-xs font-mono text-[var(--color-text-muted)] w-14 shrink-0">
                {q.label}
              </span>
              <div className="flex-1 bg-[var(--color-bg)] rounded h-6 relative overflow-hidden">
                <div
                  className="absolute inset-y-0 left-0 flex"
                  style={{ width: `${totalPct}%` }}
                >
                  <div
                    className="h-full bg-[var(--color-brand)]/85"
                    style={{ width: `${newPctOfRow}%` }}
                  />
                  <div className="h-full bg-[var(--color-service-perm)]/70 flex-1" />
                </div>
                <span className="absolute inset-0 flex items-center justify-end pr-2 text-[11px] font-semibold text-[var(--color-text-primary)] tabular-nums">
                  新{q.shopNew} · 舊{q.shopOld}
                </span>
              </div>
              <span className="text-xs font-bold text-[var(--color-text-body)] w-10 text-right tabular-nums">
                {total}
              </span>
            </div>
          );
        })}
      </div>

      <p className="text-[11px] text-[var(--color-text-muted)] pt-1 border-t border-[var(--color-text-muted)]/10">
        近 {quarters.length} 季合計：新店面客 {totalNew} / 舊店面客 {totalOld}
        {totalNew + totalOld > 0 &&
          ` (新客比例 ${Math.round((totalNew / (totalNew + totalOld)) * 100)}%)`}
      </p>
    </div>
  );
}
