"use client";

import { memo, useState } from "react";
import { BarChart3 } from "lucide-react";
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
 * - Cumulative summary promoted to a hero card above the chart
 */
// V3.8 perf (Wave 2): memo'd — YoYBars 內計算 SVG viewBox + 12 個月 bar 座標
// 並渲染 24 個 SVG <rect>。父層 monthly view 切換 expenses/closes useSWR 時不
// 該重算。`data` 只在 SWR refetch 才換 reference。
function YoYBarsImpl({ data, hasLastYearData, anchorYear }: YoYBarsProps) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  if (!hasLastYearData) {
    return (
      <div className="bg-[var(--color-surface)]/40 rounded-lg p-6 text-center text-sm text-[var(--color-text-muted)] space-y-1.5">
        <div className="flex justify-center opacity-40">
          <BarChart3 size={28} aria-hidden />
        </div>
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

  // V3.10 老闆 feedback：「整個圖表可以再大一點」
  // viewBox H 從 220 拉到 320 — 比例 600:320 ≈ 1.875。SVG 用 `w-full` 撐滿父
  // 寬，高度由 viewBox 比例決定，不用 className h-* 也不用 preserveAspectRatio
  // ="none"（會把柱子＋字一起壓扁）。在 400px 寬手機上實際高度 147px → 213px
  // (+45%)；在 720px 寬桌面 tile 264px → 384px。
  // 同時把字級放大：Y軸/月份/tooltip 一起變大，視覺上「真的大一點」。
  const W = 600;
  const H = 320;
  const padL = 56;
  const padR = 16;
  const padT = 16;
  const padB = 40;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const groupW = innerW / 12;
  const barW = (groupW - 4) / 2;

  const cumulativeYoy = data.cumulativeYoyPct;
  const cumulativeYoyTone =
    cumulativeYoy === null
      ? "text-[var(--color-text-muted)]"
      : cumulativeYoy >= 0
        ? "text-[var(--color-success)]"
        : "text-[var(--color-danger)]";

  return (
    <div className="space-y-3">
      {/* Cumulative — 兩欄大字，左本年（brand 色）、右去年；底下一條對比帶。
          設計 reference：頂尖 SaaS dashboard（Stripe、Shopify 後台）都把
          「本期 vs 去年同期」當成 hero KPI 顯示，不是埋在圖例裡的小字。 */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 bg-[var(--color-surface)]/40 rounded-lg px-3 py-3 sm:px-4 sm:py-3.5 border border-[var(--color-brand)]/8">
        <div>
          <p className="text-[10px] sm:text-[11px] tracking-wider text-[var(--color-text-muted)] uppercase">
            {anchorYear} 年累計
          </p>
          <p className="text-xl sm:text-2xl font-bold tabular-nums text-[var(--color-brand)] mt-0.5 leading-tight">
            {(data.thisYearTotal / 10000).toFixed(1)}
            <span className="text-sm font-normal text-[var(--color-text-muted)] ml-0.5">萬</span>
          </p>
        </div>
        <div className="text-right sm:text-left">
          <p className="text-[10px] sm:text-[11px] tracking-wider text-[var(--color-text-muted)] uppercase">
            {anchorYear - 1} 年累計
          </p>
          <p className="text-xl sm:text-2xl font-bold tabular-nums text-[var(--color-text-primary)] mt-0.5 leading-tight">
            {(data.lastYearTotal / 10000).toFixed(1)}
            <span className="text-sm font-normal text-[var(--color-text-muted)] ml-0.5">萬</span>
          </p>
        </div>
        {cumulativeYoy !== null && (
          <p
            className={`col-span-2 text-xs sm:text-sm font-semibold tabular-nums ${cumulativeYoyTone} pt-1 border-t border-[var(--color-brand)]/8 mt-0.5`}
          >
            {cumulativeYoy >= 0 ? "↑ 成長" : "↓ 衰退"}{" "}
            {Math.abs(cumulativeYoy).toFixed(1)}% vs {anchorYear - 1} 年同期
          </p>
        )}
      </div>

      <div className="flex items-center justify-end gap-3">
        <Legend color="var(--color-text-muted)" label={String(anchorYear - 1)} />
        <Legend color="var(--color-brand)" label={String(anchorYear)} />
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
                  x={padL - 6}
                  y={y + 4}
                  textAnchor="end"
                  fontSize="12"
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
                  y={H - 14}
                  textAnchor="middle"
                  fontSize="13"
                  fill="var(--color-text-muted)"
                >
                  {p.monthLabel}
                </text>
              </g>
            );
          })}

          {/* Tooltip — V3.10 放大：120×56 → 180×96，字級 10→13，可讀性大幅提升。
              「整體畫面偏小」這個 feedback 主要針對的就是這塊互動區。 */}
          {hoverIdx != null && (() => {
            const p = data.points[hoverIdx];
            const groupX = padL + hoverIdx * groupW;
            const TIP_W = 180;
            const TIP_H = 96;
            const tipX = Math.min(W - padR - TIP_W, Math.max(padL, groupX + groupW / 2 - TIP_W / 2));
            const tipY = padT + 4;
            return (
              <g pointerEvents="none">
                <rect
                  x={tipX}
                  y={tipY}
                  width={TIP_W}
                  height={TIP_H}
                  fill="var(--color-text-primary)"
                  opacity={0.95}
                  rx={8}
                />
                <text x={tipX + 12} y={tipY + 22} fontSize="14" fill="white" fontWeight="bold">
                  {p.monthLabel}
                </text>
                <text x={tipX + 12} y={tipY + 44} fontSize="13" fill="white" opacity={0.9}>
                  {anchorYear - 1}: {(p.lastYear / 1000).toFixed(0)}k
                </text>
                <text x={tipX + 12} y={tipY + 64} fontSize="13" fill="white" fontWeight="bold">
                  {anchorYear}: {(p.thisYear / 1000).toFixed(0)}k
                </text>
                {p.yoyPct !== null && (
                  <text
                    x={tipX + TIP_W - 12}
                    y={tipY + 86}
                    fontSize="13"
                    textAnchor="end"
                    fontWeight="bold"
                    fill={p.yoyPct >= 0 ? "#a7d4a7" : "#ffb3b3"}
                  >
                    同期 {p.yoyPct >= 0 ? "+" : ""}{p.yoyPct.toFixed(0)}%
                  </text>
                )}
              </g>
            );
          })()}
        </svg>
      </div>
    </div>
  );
}

export const YoYBars = memo(YoYBarsImpl);

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
