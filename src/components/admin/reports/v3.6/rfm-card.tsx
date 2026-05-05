import { memo, type ComponentType } from "react";
import type { LucideProps } from "lucide-react";
import { Trophy, Gem, Sprout, AlertTriangle, DoorOpen, Lightbulb } from "lucide-react";
import type { RfmGrid, RfmSegment } from "@/lib/reports/v3.6/aggregates";
import { MCard } from "./m-card";

const META: Record<RfmSegment, { Icon: ComponentType<LucideProps>; label: string; color: string; description: string }> = {
  champion: {
    Icon: Trophy,
    label: "冠軍",
    color: "var(--color-success)",
    description: "30 天內 + 年訪 5+ + 年消費 6000+",
  },
  loyal: {
    Icon: Gem,
    label: "忠實老客",
    color: "var(--color-brand)",
    description: "60 天內 + 年訪 4+ + 年消費 3000+",
  },
  newCustomer: {
    Icon: Sprout,
    label: "新客觀察期",
    color: "var(--color-warning)",
    description: "90 天內 + 年訪 1-3",
  },
  atRisk: {
    Icon: AlertTriangle,
    label: "流失中",
    color: "var(--color-service-perm)",
    description: "60-180 天 + 年訪 2+",
  },
  lost: {
    Icon: DoorOpen,
    label: "已流失",
    color: "var(--color-danger)",
    description: "180+ 天未到訪",
  },
};

interface RfmCardsProps {
  grid: RfmGrid;
}

// V3.8 perf (Wave 2): memo'd — 5 段 grid 卡片，父層 SWR 多重 fetch 觸發 re-render
// 時不該重新走 segments.map。`grid` reference 只在 SWR refetch 時改變。
function RfmCardsImpl({ grid }: RfmCardsProps) {
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
              <meta.Icon size={14} aria-hidden style={{ color: meta.color }} />
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

export const RfmCards = memo(RfmCardsImpl);

function RfmSummaryImpl({ grid }: { grid: RfmGrid }) {
  const champPct = grid.pct.champion;
  const lostPct = grid.pct.lost;
  if (grid.total === 0) return null;
  return (
    <p className="text-xs text-[var(--color-text-muted)] mt-2 inline-flex items-start gap-1">
      <Lightbulb size={12} aria-hidden className="mt-0.5 shrink-0" />
      <span>
        冠軍 + 忠實 = {(grid.pct.champion + grid.pct.loyal).toFixed(1)}%（共 {grid.champion + grid.loyal} 位）撐起主要營收；
        流失中 + 已流失 = {(grid.pct.atRisk + grid.pct.lost).toFixed(1)}%（共 {grid.atRisk + grid.lost} 位）是最大喚回池
        {champPct > 30 && "；冠軍密度健康"}
        {lostPct > 20 && "；已流失偏高，建議召回券優先發送"}
      </span>
    </p>
  );
}

export const RfmSummary = memo(RfmSummaryImpl);
