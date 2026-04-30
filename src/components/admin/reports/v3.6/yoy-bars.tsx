"use client";

import { useState } from "react";
import type { YoYResult } from "@/lib/reports/v3.6/aggregates";

interface YoYBarsProps {
  data: YoYResult;
  /** When false → show "資料準備中" placeholder */
  hasLastYearData: boolean;
  /** anchor year (for legend labels) */
  anchorYear: number;
}

/**
 * V3.6 feedback Pass 1 §7 — side-by-side dual bars per month.
 *
 * Reference: 「過去 12 個月 vs 去年同期」grouped bar chart.
 * - 12 months on x-axis
 * - Each month: 2 bars side by side (gray = last year, brand = this year)
 * - Hover tooltip showing both values + delta
 * - Subtitle showing accumulated YoY%
 */
export function YoYBars({ data, hasLastYearData, anchorYear }: YoYBarsProps) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  if (!hasLastYearData) {
    return (
      <div className="bg-[var(--color-surface)]/40 rounded-lg p-6 text-center text-sm text-[var(--color-text-muted)] space-y-1.5">
        <div className="text-2xl opacity-40">📊</div>
        <p className="font-medium text-[var(--color-text-body)]">
          {anchorYear - 1} 年同期資料準備中
        </p>
        <p className="text-xs">
          等老闆把舊年資料匯入後，這裡會顯示 12 月雙色對比 + 累計同期比
        </p>
      </div>
    );
  }

  const max = Math.max(
    ...data.points.map((p) => Math.max(p.thisYear, p.lastYear)),
    1,
  );
  // Round max up to nearest 20k for clean axis
  const yMax = Math.ceil(max / 20000) * 20000;
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(yMax * f));

  // SVG dimensions (viewBox)
  const W = 600;
  const H = 220;
  const padL = 50;
  const padR = 12;
  const padT = 12;
  const padB = 30;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const groupW = innerW / 12;
  const barW = (groupW - 4) / 2;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs">
        <p className="text-[var(--color-text-muted)] tabular-nums">
          {anchorYear} 年累計 {(data.thisYearTotal / 10000).toFixed(1)}萬，
          {anchorYear - 1} 年累計 {(data.lastYearTotal / 10000).toFixed(1)}萬
          {data.cumulativeYoyPct !== null && (
            <span
              className={`ml-1 font-semibold ${
                data.cumulativeYoyPct >= 0
                  ? "text-[var(--color-success)]"
                  : "text-[var(--color-danger)]"
              }`}
            >
              {data.cumulativeYoyPct >= 0 ? "成長" : "衰退"}{" "}
              {Math.abs(data.cumulativeYoyPct).toFixed(1)}%
            </span>
          )}
        </p>
        <div className="flex items-center gap-3 shrink-0">
          <Legend color="var(--color-text-muted)" label={String(anchorYear - 1)} />
          <Legend color="var(--color-brand)" label={String(anchorYear)} />
        </div>
      </div>

      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ touchAction: "manipulation" }}>
          {/* Y axis ticks + labels */}
          {yTicks.map((v, i) => {
            const y = padT + innerH - (v / yMax) * innerH;
            return (
              <g key={i}>
                <line
                  x1={padL}
                  y1={y}
                  x2={W - padR}
                  y2={y}
                  stroke="var(--color-text-muted)"
                  strokeWidth="0.5"
                  opacity="0.2"
                />
                <text
                  x={padL - 4}
                  y={y + 3}
                  textAnchor="end"
                  fontSize="9"
                  fill="var(--color-text-muted)"
                >
                  {(v / 1000).toFixed(0)}k
                </text>
              </g>
            );
          })}

          {/* Bars */}
          {data.points.map((p, i) => {
            const groupX = padL + i * groupW;
            const lastH = (p.lastYear / yMax) * innerH;
            const thisH = (p.thisYear / yMax) * innerH;
            const isHover = hoverIdx === i;
            return (
              <g
                key={p.month}
                onMouseEnter={() => setHoverIdx(i)}
                onMouseLeave={() => setHoverIdx(null)}
                onClick={() => setHoverIdx(isHover ? null : i)}
                style={{ cursor: "pointer" }}
              >
                {/* invisible hit area */}
                <rect
                  x={groupX}
                  y={padT}
                  width={groupW}
                  height={innerH}
                  fill="transparent"
                />
                <rect
                  x={groupX + 2}
                  y={padT + innerH - lastH}
                  width={barW}
                  height={lastH}
                  fill="var(--color-text-muted)"
                  opacity={isHover ? 0.85 : 0.55}
                  rx={1.5}
                />
                <rect
                  x={groupX + 2 + barW + 2}
                  y={padT + innerH - thisH}
                  width={barW}
                  height={thisH}
                  fill="var(--color-brand)"
                  opacity={isHover ? 1 : 0.85}
                  rx={1.5}
                />
                <text
                  x={groupX + groupW / 2}
                  y={H - 10}
                  textAnchor="middle"
                  fontSize="10"
                  fill="var(--color-text-muted)"
                >
                  {p.monthLabel}
                </text>
              </g>
            );
          })}

          {/* Tooltip */}
          {hoverIdx != null && (() => {
            const p = data.points[hoverIdx];
            const groupX = padL + hoverIdx * groupW;
            const tipX = Math.min(W - 130, Math.max(padL, groupX + groupW / 2 - 60));
            const tipY = padT + 4;
            return (
              <g pointerEvents="none">
                <rect
                  x={tipX}
                  y={tipY}
                  width={120}
                  height={56}
                  fill="var(--color-text-primary)"
                  opacity={0.95}
                  rx={6}
                />
                <text x={tipX + 8} y={tipY + 14} fontSize="10" fill="white" fontWeight="bold">
                  {p.monthLabel}
                </text>
                <text x={tipX + 8} y={tipY + 28} fontSize="10" fill="white" opacity={0.9}>
                  {anchorYear - 1}: {(p.lastYear / 1000).toFixed(0)}k
                </text>
                <text x={tipX + 8} y={tipY + 41} fontSize="10" fill="white" fontWeight="bold">
                  {anchorYear}: {(p.thisYear / 1000).toFixed(0)}k
                </text>
                {p.yoyPct !== null && (
                  <text
                    x={tipX + 112}
                    y={tipY + 41}
                    fontSize="10"
                    textAnchor="end"
                    fill={p.yoyPct >= 0 ? "#a7d4a7" : "#ffb3b3"}
                  >
                    {p.yoyPct >= 0 ? "+" : ""}{p.yoyPct.toFixed(0)}%
                  </text>
                )}
              </g>
            );
          })()}
        </svg>
      </div>

      <p className="text-[10px] text-[var(--color-text-muted)] text-center">
        💡 點/滑入任一月份柱狀，查看詳細數字
      </p>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-[var(--color-text-muted)] text-[11px]">
      <span
        className="inline-block w-2.5 h-2.5 rounded-sm"
        style={{ backgroundColor: color, opacity: 0.85 }}
      />
      <span className="tabular-nums">{label}</span>
    </span>
  );
}
