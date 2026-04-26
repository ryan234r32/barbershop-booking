/**
 * Auto-diagnosis banner for V3.5 reports redesign (PRD §4.2).
 *
 * Drops below a KPI / widget to render a one-line traffic-light verdict —
 * compares the current value to industry benchmark, picks the level, surfaces
 * an actionable recommendation when applicable. Demo-Ryan can read this aloud
 * and the owner gets the message in 2 seconds: "47% one-timer is bad, the
 * fix is auto-推播."
 */
export type DiagnosisLevel = "good" | "warn" | "alert";

export interface Diagnosis {
  level: DiagnosisLevel;
  current: string;
  benchmark: string;
  message: string;
  recommendation?: string;
}

const LEVEL_STYLES: Record<DiagnosisLevel, { dot: string; bg: string; ring: string }> = {
  good: {
    dot: "🟢",
    bg: "bg-[var(--color-success)]/8",
    ring: "ring-1 ring-[var(--color-success)]/30",
  },
  warn: {
    dot: "🟡",
    bg: "bg-[var(--color-warning)]/8",
    ring: "ring-1 ring-[var(--color-warning)]/30",
  },
  alert: {
    dot: "🔴",
    bg: "bg-[var(--color-danger)]/8",
    ring: "ring-1 ring-[var(--color-danger)]/30",
  },
};

export function DiagnosisBanner({ diagnosis }: { diagnosis: Diagnosis }) {
  const style = LEVEL_STYLES[diagnosis.level];
  return (
    <div className={`rounded-xl px-3 py-2.5 ${style.bg} ${style.ring}`}>
      <p className="text-sm leading-relaxed text-[var(--color-text-body)]">
        <span className="mr-1">{style.dot}</span>
        <span className="font-bold tabular-nums">{diagnosis.current}</span>
        <span className="mx-2 text-[var(--color-text-muted)]">vs {diagnosis.benchmark}</span>
        <span>— {diagnosis.message}</span>
      </p>
      {diagnosis.recommendation && (
        <p className="text-xs text-[var(--color-text-muted)] mt-1.5 pl-5">
          💡 建議：{diagnosis.recommendation}
        </p>
      )}
    </div>
  );
}

/* ── Domain-specific diagnosis builders ─────────────────────────────────
   Each takes the raw metric and the industry benchmark, returns a Diagnosis
   with level + message + recommendation. Numbers/levels track plan §0.3. */

export function diagnoseOneTimerRate(rate: number): Diagnosis {
  let level: DiagnosisLevel = "good";
  let message = "一次性客戶比例健康";
  if (rate > 40) {
    level = "alert";
    message = "一半客人來一次就沒再來，這是最大改進空間";
  } else if (rate > 30) {
    level = "warn";
    message = "高於業界平均，還有空間下降";
  }
  return {
    level,
    current: `${rate}%`,
    benchmark: "業界 30-40%",
    message,
    recommendation:
      level === "good" ? undefined : "啟用 30 天自動回訪推播 — 估計可降至 38%",
  };
}

export function diagnoseOccupancyRate(rate: number): Diagnosis {
  let level: DiagnosisLevel = "good";
  let message = "時段利用充分";
  if (rate < 60) {
    level = "alert";
    message = "還有近一半時段空著沒填";
  } else if (rate < 75) {
    level = "warn";
    message = "可再向健康水位 75% 推進";
  }
  return {
    level,
    current: `${rate}%`,
    benchmark: "業界健康 75%+",
    message,
    recommendation: level === "good" ? undefined : "Lapsed 客戶喚回券 + 空檔填充推播",
  };
}

export function diagnoseRetention90(rate: number): Diagnosis {
  let level: DiagnosisLevel = "good";
  let message = "90 天回訪率到達健康水位";
  if (rate < 30) {
    level = "alert";
    message = "回訪轉換低，前 90 天是最重要的留客窗口";
  } else if (rate < 50) {
    level = "warn";
    message = "略高於業界平均，但離健康 50% 還有距離";
  }
  return {
    level,
    current: `${rate}%`,
    benchmark: "業界 30-40% / 健康 50%+",
    message,
    recommendation: level === "good" ? undefined : "30 天自動推播 + 服務後立即 rebook",
  };
}

export function diagnoseGapDays(median: number): Diagnosis {
  // Lower gap = customers come back sooner = better.
  // 業界 73 天 / 頂尖 52 天
  let level: DiagnosisLevel = "warn";
  let message = "回訪間隔接近業界平均";
  if (median > 0 && median < 50) {
    level = "good";
    message = "回訪客回得很快，比業界明顯好";
  } else if (median >= 70) {
    level = "alert";
    message = "回訪客回得偏慢，可推 30 天提醒拉短";
  }
  return {
    level,
    current: `${median} 天`,
    benchmark: "業界 73 / 頂尖 52",
    message,
    recommendation: level === "alert" ? "30 天回訪推播 + 結帳時 rebook 下次預約" : undefined,
  };
}
