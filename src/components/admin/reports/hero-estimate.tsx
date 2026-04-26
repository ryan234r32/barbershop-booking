/**
 * Hero estimate banner — V3.5 demo wow-moment (PRD §4.3).
 *
 * Plops the headline "你還有 NT$XX-YY 萬潛力沒挖" right at the top so the
 * owner sees the upside before they scroll into the diagnosis. Conservative
 * formula uses two levers from plan §1.2:
 *   - lift one-timer rate toward 35% → recover ~40% of the gap × baseline
 *   - lift occupancy toward 65% → recover ~60% of the gap × baseline
 */

interface HeroEstimateInput {
  revenue: number;
  oneTimerRate: number;
  occupancyRate: number;
}

function estimateRevenueIncrease({ revenue, oneTimerRate, occupancyRate }: HeroEstimateInput): {
  lower: number;
  upper: number;
} {
  const oneTimerGapPp = Math.max(0, oneTimerRate - 35);
  const retentionLever = revenue * (oneTimerGapPp / 100) * 0.4;
  const occupancyGapPp = Math.max(0, 75 - occupancyRate);
  const occupancyLever = revenue * (occupancyGapPp / 100) * 0.6;
  return {
    lower: Math.round(retentionLever),
    upper: Math.round(retentionLever + occupancyLever),
  };
}

function fmtMan(n: number): string {
  if (n >= 10000) return `${Math.round(n / 10000)}萬`;
  return `${n.toLocaleString()}`;
}

export function HeroEstimate({
  revenue,
  oneTimerRate,
  occupancyRate,
  rangeLabel,
}: HeroEstimateInput & { rangeLabel: string }) {
  const { lower, upper } = estimateRevenueIncrease({ revenue, oneTimerRate, occupancyRate });
  const baselineMan = fmtMan(revenue);
  const lowerMan = fmtMan(lower);
  const upperMan = fmtMan(upper);
  const liftPctLower = revenue > 0 ? Math.round((lower / revenue) * 100) : 0;
  const liftPctUpper = revenue > 0 ? Math.round((upper / revenue) * 100) : 0;

  // No upside to surface → render quieter "達標" version
  if (upper <= 0 || revenue === 0) {
    return (
      <div className="bg-[var(--color-success)]/10 ring-1 ring-[var(--color-success)]/30 rounded-2xl p-5">
        <p className="text-sm font-bold text-[var(--color-text-primary)]">
          📊 {rangeLabel} 你做了 NT${baselineMan}
        </p>
        <p className="text-sm text-[var(--color-text-body)] mt-1.5">
          🟢 一次性客戶 + 佔用率均在健康水位，營收已接近產能上限。
        </p>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-[var(--color-brand)]/10 to-[var(--color-warning)]/10 ring-1 ring-[var(--color-brand)]/20 rounded-2xl p-5 space-y-3">
      <p className="text-sm font-medium text-[var(--color-text-muted)]">
        📊 {rangeLabel} 你做了
      </p>
      <p className="text-3xl font-bold text-[var(--color-text-primary)] tabular-nums">
        NT${baselineMan}
      </p>
      <div className="border-t border-[var(--color-text-muted)]/15 pt-3">
        <p className="text-sm font-semibold text-[var(--color-text-primary)]">
          ⚠️ 啟用回訪推播 + 喚回流失客
        </p>
        <p className="text-2xl font-bold text-[var(--color-brand)] tabular-nums mt-1">
          估算可多賺 NT${lowerMan}-{upperMan}
          <span className="text-sm font-medium text-[var(--color-text-muted)] ml-2">
            (+{liftPctLower}~{liftPctUpper}%)
          </span>
        </p>
        <p className="text-xs text-[var(--color-text-muted)] mt-1.5">
          保守估算 — 把一次性客戶降到 35%、佔用率拉到 65% 的 leverage 線
        </p>
      </div>
    </div>
  );
}
