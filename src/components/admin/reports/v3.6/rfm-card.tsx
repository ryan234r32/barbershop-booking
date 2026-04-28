import type { RfmGrid, RfmSegment } from "@/lib/reports/v3.6/aggregates";
import { MCard } from "./m-card";

const META: Record<RfmSegment, { emoji: string; label: string; color: string; description: string }> = {
  champion: {
    emoji: "🏆",
    label: "冠軍",
    color: "var(--color-success)",
    description: "30 天內 + 年訪 5+ + 年消費 6000+",
  },
  loyal: {
    emoji: "💎",
    label: "忠實老客",
    color: "var(--color-brand)",
    description: "60 天內 + 年訪 4+ + 年消費 3000+",
  },
  newCustomer: {
    emoji: "🌱",
    label: "新客觀察期",
    color: "var(--color-warning)",
    description: "90 天內 + 年訪 1-3",
  },
  atRisk: {
    emoji: "⚠️",
    label: "流失中",
    color: "var(--color-service-perm)",
    description: "60-180 天 + 年訪 2+",
  },
  lost: {
    emoji: "🚪",
    label: "已流失",
    color: "var(--color-danger)",
    description: "180+ 天未到訪",
  },
};

interface RfmCardsProps {
  grid: RfmGrid;
}

export function RfmCards({ grid }: RfmCardsProps) {
  const segments: RfmSegment[] = ["champion", "loyal", "newCustomer", "atRisk", "lost"];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
      {segments.map((s) => {
        const meta = META[s];
        return (
          <MCard
            key={s}
            leftBand={meta.color}
            padding="sm"
          >
            <div className="flex items-center gap-1 mb-0.5">
              <span className="text-base leading-none">{meta.emoji}</span>
              <span className="text-xs font-semibold text-[var(--color-text-primary)]">
                {meta.label}
              </span>
            </div>
            <p className="text-xl font-bold tabular-nums text-[var(--color-text-primary)]">
              {grid[s]}
            </p>
            <p className="text-[10px] text-[var(--color-text-muted)] tabular-nums">
              {grid.pct[s].toFixed(1)}%
            </p>
            <p className="text-[9px] text-[var(--color-text-muted)] mt-1 leading-tight">
              {meta.description}
            </p>
          </MCard>
        );
      })}
    </div>
  );
}

export function RfmSummary({ grid }: { grid: RfmGrid }) {
  const champPct = grid.pct.champion;
  const lostPct = grid.pct.lost;
  if (grid.total === 0) return null;
  return (
    <p className="text-xs text-[var(--color-text-muted)] mt-2">
      💡 冠軍 + 忠實 = {(grid.pct.champion + grid.pct.loyal).toFixed(1)}%（共 {grid.champion + grid.loyal} 位）撐起主要營收；
      流失中 + 已流失 = {(grid.pct.atRisk + grid.pct.lost).toFixed(1)}%（共 {grid.atRisk + grid.lost} 位）是最大喚回池
      {champPct > 30 && "；冠軍密度健康"}
      {lostPct > 20 && "；已流失偏高，建議召回券優先發送"}
    </p>
  );
}
