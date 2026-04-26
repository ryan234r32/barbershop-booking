/**
 * Service category × new/熟 customer split. Replaces the basic 服務分布
 * widget when the owner wants to see "染 客戶幾乎都是熟客 / 剪 才是新客主力"
 * (PRD §4.1 "服務組合 split 新熟").
 */

interface ServiceMixEntry {
  category: string;
  newCount: number;
  returningCount: number;
}

const COLOR: Record<string, { newBg: string; oldBg: string }> = {
  剪: { newBg: "bg-[var(--color-brand)]", oldBg: "bg-[var(--color-brand)]/40" },
  燙: { newBg: "bg-[var(--color-service-perm)]", oldBg: "bg-[var(--color-service-perm)]/40" },
  染: { newBg: "bg-[var(--color-service-color)]", oldBg: "bg-[var(--color-service-color)]/40" },
  漂: { newBg: "bg-[var(--color-warning)]", oldBg: "bg-[var(--color-warning)]/40" },
  護: { newBg: "bg-[var(--color-success)]", oldBg: "bg-[var(--color-success)]/40" },
  洗: { newBg: "bg-[var(--color-success)]/70", oldBg: "bg-[var(--color-success)]/30" },
  其他: { newBg: "bg-[var(--color-text-muted)]", oldBg: "bg-[var(--color-text-muted)]/40" },
};

export function ServiceMixByCustomerWidget({ mix }: { mix: ServiceMixEntry[] }) {
  if (mix.length === 0) return null;
  const totalAll = mix.reduce((s, m) => s + m.newCount + m.returningCount, 0);
  if (totalAll === 0) return null;
  const max = Math.max(...mix.map((m) => m.newCount + m.returningCount), 1);

  return (
    <div className="bg-[var(--color-surface)] rounded-2xl p-5 space-y-3">
      <div>
        <h3 className="text-sm font-bold text-[var(--color-text-primary)]">
          服務組合（新客 vs 熟客）
        </h3>
        <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
          深色 = 熟客（過去已來過）/ 淺色 = 新客（本期首訪）
        </p>
      </div>

      <div className="space-y-2.5">
        {mix.map((m) => {
          const total = m.newCount + m.returningCount;
          const totalPct = (total / max) * 100;
          const oldPctOfRow = total > 0 ? (m.returningCount / total) * 100 : 0;
          const palette = COLOR[m.category] ?? COLOR["其他"];
          return (
            <div key={m.category} className="flex items-center gap-3">
              <span className="text-sm font-semibold w-8 shrink-0 text-[var(--color-text-primary)]">
                {m.category}
              </span>
              <div className="flex-1 bg-[var(--color-bg)] rounded h-6 relative overflow-hidden">
                <div
                  className="absolute inset-y-0 left-0 flex"
                  style={{ width: `${totalPct}%` }}
                >
                  <div className={`h-full ${palette.newBg}`} style={{ width: `${oldPctOfRow}%` }} />
                  <div className={`h-full ${palette.oldBg} flex-1`} />
                </div>
                <span className="absolute inset-0 flex items-center justify-end pr-2 text-[11px] font-semibold text-[var(--color-text-primary)] tabular-nums">
                  熟 {m.returningCount} / 新 {m.newCount}
                </span>
              </div>
              <span className="text-xs text-[var(--color-text-body)] w-12 text-right tabular-nums">
                {total}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
