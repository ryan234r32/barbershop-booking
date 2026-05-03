"use client";

import { useState } from "react";
import useSWR from "swr";
import { adminHeaders } from "@/lib/auth/admin-fetch";
import { MCard } from "@/components/admin/reports/v3.6/m-card";
import { MTag } from "@/components/admin/reports/v3.6/m-tag";
import { KpiCard } from "@/components/admin/reports/v3.6/kpi-card";
import { CohortStackedBar } from "@/components/admin/reports/v3.6/cohort-bar";
import { SectionDivider } from "@/components/admin/reports/v3.6/section-divider";
import { DateStrip } from "@/components/admin/reports/v3.6/date-strip";
import type {
  RfmGrid,
  YoYResult,
  AnnualHighlights,
  Scenario,
  ScenarioKey,
  MonthSpark,
} from "@/lib/reports/v3.6/aggregates";

interface AnnualResponse {
  view: "annual";
  period: string;
  year: number;
  range: { label: string; fromIso: string; toIso: string };
  totals: {
    bookings: number;
    revenue: number;
    uniqueCustomers: number;
    newCustomers: number;
    arpu: number;
    occupancyRate: number;
    visitFrequency: number;
    medianGapDays: number;
  };
  retention: { retention30Days: number; retention60Days: number; retention90Days: number };
  servicePie: Array<{ category: string; count: number; revenue: number }>;
  serviceShares: Array<{ category: string; revenue: number; share: number; count: number }>;
  rfm: RfmGrid;
  yoy: YoYResult;
  topCustomers: Array<{ id: string; displayName: string | null; visitCount: number; totalSpend: number }>;
  highlights: AnnualHighlights;
  sparkline: MonthSpark[];
  scenarios: Scenario[];
}

const fetcher = (url: string) =>
  fetch(url, { headers: adminHeaders() }).then((r) => {
    if (!r.ok) throw new Error(String(r.status));
    return r.json();
  });

interface AnnualViewProps {
  period: string;     // "YYYY"
  onPeriodChange: (next: string) => void;
}

export function AnnualView({ period, onPeriodChange }: AnnualViewProps) {
  const { data, error, isLoading } = useSWR<AnnualResponse>(
    `/api/reports/v3.6?view=annual&period=${period}`,
    fetcher,
    { revalidateOnFocus: false },
  );
  const [chosenScenario, setChosenScenario] = useState<ScenarioKey>("aggressive");

  // V3.7 §F — full-year expense aggregation for the P&L decomposition.
  const { data: yearExpenses } = useSWR<{
    totalAmount: number;
    expenses: Array<{ amount: number; type: "FIXED" | "VARIABLE"; date: string }>;
  }>(
    `/api/expenses?from=${period}-01-01&to=${period}-12-31`,
    fetcher,
    { revalidateOnFocus: false },
  );
  const expFixed = (yearExpenses?.expenses ?? [])
    .filter((e) => e.type === "FIXED")
    .reduce((s, e) => s + e.amount, 0);
  const expVar = (yearExpenses?.expenses ?? [])
    .filter((e) => e.type === "VARIABLE")
    .reduce((s, e) => s + e.amount, 0);

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <div className="h-32 bg-[var(--color-surface)] rounded-2xl animate-pulse" />
        <div className="h-48 bg-[var(--color-surface)] rounded-2xl animate-pulse" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-[var(--color-danger)]/10 rounded-xl p-5 text-sm text-[var(--color-danger)]">
        報表資料載入失敗：{String(error)}
      </div>
    );
  }

  const empty = data.totals.bookings === 0;
  const yearNum = data.year;

  return (
    <div className="space-y-5 print:bg-white">
      {/* Year navigator — 左右滑動選年份 */}
      <div className="print:hidden">
        <DateStrip kind="year" selected={String(yearNum)} onSelect={onPeriodChange} />
      </div>
      <p className="text-[10px] text-[var(--color-text-muted)] tabular-nums text-center print:hidden">
        {data.range.fromIso} ~ {data.range.toIso}
      </p>

      {empty && (
        <div className="bg-[var(--color-surface)] rounded-2xl p-12 text-center text-sm text-[var(--color-text-muted)]">
          {yearNum} 年度沒有預約紀錄
        </div>
      )}

      {!empty && (
        <>
          {/* 封面 Cover (print-only flex variant) */}
          <CoverPage year={yearNum} from={data.range.fromIso} to={data.range.toIso} />

          {/* Executive Summary */}
          <ExecutiveSummary data={data} />

          {/* ① 年度三大核心指標 */}
          <SectionDivider number="01" title="年度三大核心指標" subtitle="與業界基準對標">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <KpiCard
                label="全年營收"
                primary={`${(data.totals.revenue / 10000).toFixed(1)}萬`}
                secondary={`${data.totals.revenue.toLocaleString()} 元`}
                deltaPct={data.yoy.cumulativeYoyPct ?? null}
                comparisonLabel={`${yearNum - 1} 年`}
                status={statusForYoY(data.yoy.cumulativeYoyPct)}
                benchmark={
                  data.yoy.hasLastYearData && data.yoy.cumulativeYoyPct !== null
                    ? {
                        current: 50 + Math.max(-50, Math.min(50, data.yoy.cumulativeYoyPct ?? 0)),
                        tiers: [
                          { at: 0, label: "-50%" },
                          { at: 50, label: "持平" },
                          { at: 65, label: "業界 +15~20%" },
                        ],
                      }
                    : undefined
                }
              />
              <KpiCard
                label="客戶終身價值 ARPU"
                primary={`${data.totals.arpu.toLocaleString()}`}
                secondary={`年訪 ${data.totals.visitFrequency.toFixed(2)} 次/人`}
                status={statusForArpu(data.totals.visitFrequency)}
                benchmark={{
                  current: Math.min(100, (data.totals.visitFrequency / 6) * 100),
                  tiers: [
                    { at: 0, label: "0 次" },
                    { at: 81.3, label: "業界 4.88 次/年" },
                    { at: 100, label: "頂尖 6+ 次" },
                  ],
                }}
              />
              <KpiCard
                label="客戶留存基數"
                primary={`${data.retention.retention90Days.toFixed(1)}%`}
                secondary={`90 天回訪率`}
                status={statusForRetention(data.retention.retention90Days)}
                benchmark={{
                  current: data.retention.retention90Days,
                  tiers: [
                    { at: 0, label: "0%" },
                    { at: 50, label: "業界 50%" },
                    { at: 65, label: "頂尖 65%" },
                  ],
                }}
              />
            </div>
          </SectionDivider>

          {/* V3.7 §F — 年度損益分解 (P&L)：插在 §01 ↔ §02 之間，無新編號避免動到後面 */}
          <MCard padding="md">
            <p className="text-sm font-semibold text-[var(--color-text-primary)] mb-2">
              年度損益分解
            </p>
            <p className="text-[11px] text-[var(--color-text-muted)] mb-3">
              營收 − 固定支出 − 變動支出 = 淨利
            </p>
            <PLDecomposition
              revenue={data.totals.revenue}
              fixedCost={expFixed}
              variableCost={expVar}
            />
          </MCard>

          {/* ② 客戶健康深度分析 */}
          <SectionDivider number="02" title="客戶健康深度分析" subtitle="客戶結構與年度貢獻分布">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <SmallStat label="不重複客戶" value={data.totals.uniqueCustomers.toLocaleString()} />
              <SmallStat label="年訪頻率" value={`${data.totals.visitFrequency.toFixed(2)} 次/人`} />
              <SmallStat label="平均客單" value={`${data.totals.arpu.toLocaleString()}`} />
              <SmallStat label="中位回訪間隔" value={`${data.totals.medianGapDays} 天`} />
            </div>

            <MCard padding="md">
              <CohortStackedBar
                segments={[
                  { key: "champion", label: `🏆 冠軍 (${data.rfm.champion})`, pct: data.rfm.pct.champion, color: "#0F6E56", count: data.rfm.champion },
                  { key: "loyal",    label: `💎 忠實 (${data.rfm.loyal})`,    pct: data.rfm.pct.loyal,    color: "#1D9E75", count: data.rfm.loyal    },
                  { key: "newC",     label: `🌱 新客 (${data.rfm.newCustomer})`, pct: data.rfm.pct.newCustomer, color: "#7E22CE", count: data.rfm.newCustomer },
                  { key: "atRisk",   label: `⚠️ 流失中 (${data.rfm.atRisk})`,  pct: data.rfm.pct.atRisk,  color: "#BA7517", count: data.rfm.atRisk   },
                  { key: "lost",     label: `🚪 已失 (${data.rfm.lost})`,     pct: data.rfm.pct.lost,     color: "#A32D2D", count: data.rfm.lost     },
                ]}
              />
              <div className="mt-3 bg-[var(--color-brand)]/8 border-l-[3px] border-[var(--color-brand)] rounded-r-md px-3 py-2 text-xs">
                <p className="font-semibold text-[var(--color-text-primary)]">
                  💡 VIP 集中度（冠軍 + 忠實）：{(data.rfm.pct.champion + data.rfm.pct.loyal).toFixed(1)}%
                </p>
                <p className="text-[var(--color-text-body)] mt-1">
                  喚回池 = 流失中 + 已流失 = {data.rfm.atRisk + data.rfm.lost} 位，是行銷重點目標
                </p>
              </div>
            </MCard>
          </SectionDivider>

          {/* ③ 全年服務結構 */}
          <SectionDivider number="03" title="全年服務結構" subtitle="服務類別營收佔比 + 客單訊號">
            <ServiceStructureTable shares={data.serviceShares} totalRev={data.totals.revenue} />
          </SectionDivider>

          {/* ④ 季節性節奏 */}
          <SectionDivider number="04" title={`${yearNum} 年季節性節奏`} subtitle="月營收 SVG 柱狀 + 旺淡季解讀">
            <SeasonalityChart sparkline={data.sparkline} />
          </SectionDivider>

          {/* ⑤ 高光時刻 */}
          <SectionDivider number="05" title={`${yearNum} 年度高光時刻`} subtitle="年度里程碑 + Top 5 客戶">
            <Highlights highlights={data.highlights} topCustomers={data.topCustomers} />
          </SectionDivider>

          {/* ⑥ 明年目標設定 */}
          <SectionDivider
            number="06"
            title={`${yearNum + 1} 年度目標設定`}
            subtitle="4 情境 radio + 達成路徑"
          >
            <ScenarioPicker
              scenarios={data.scenarios}
              chosen={chosenScenario}
              onChoose={setChosenScenario}
              year={yearNum + 1}
              prevYearRevenue={data.totals.revenue}
            />
          </SectionDivider>

          {/* Footer */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 print:hidden">
            <button
              onClick={() => window.print()}
              className="px-4 py-3 rounded-xl bg-[var(--color-brand)] text-[var(--color-bg)] text-sm font-semibold hover:opacity-90"
            >
              產出 {yearNum} 完整年度報告 PDF
            </button>
            <button
              onClick={() => window.print()}
              className="px-4 py-3 rounded-xl bg-[var(--color-surface)] text-sm font-semibold"
            >
              列印此頁
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────

/**
 * V3.7 §F — 4-way P&L decomposition: Revenue / Fixed / Variable / Profit
 * as a horizontal stacked bar + numeric breakdown.
 */
function PLDecomposition({
  revenue,
  fixedCost,
  variableCost,
}: {
  revenue: number;
  fixedCost: number;
  variableCost: number;
}) {
  const profit = revenue - fixedCost - variableCost;
  const profitable = profit >= 0;
  // Bar width: % of revenue. Profit slot can be negative; clip to 0% if so.
  const denom = revenue > 0 ? revenue : 1;
  const fixedPct = Math.min(100, Math.max(0, (fixedCost / denom) * 100));
  const varPct = Math.min(100, Math.max(0, (variableCost / denom) * 100));
  const profitPct = Math.max(0, 100 - fixedPct - varPct);

  return (
    <div>
      <div className="flex h-6 rounded-md overflow-hidden mb-3">
        <div
          className="bg-[var(--color-warning)]/70"
          style={{ width: `${fixedPct}%` }}
          title={`固定 ${fixedPct.toFixed(1)}%`}
        />
        <div
          className="bg-[var(--color-danger)]/70"
          style={{ width: `${varPct}%` }}
          title={`變動 ${varPct.toFixed(1)}%`}
        />
        <div
          className={`${profitable ? "bg-[var(--color-brand)]" : "bg-[var(--color-text-disabled)]/40"}`}
          style={{ width: `${profitPct}%` }}
          title={`淨利 ${profitPct.toFixed(1)}%`}
        />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <PLCell
          label="營收"
          amount={revenue}
          dotColour="var(--color-text-primary)"
        />
        <PLCell
          label="固定支出"
          amount={-fixedCost}
          dotColour="var(--color-warning)"
        />
        <PLCell
          label="變動支出"
          amount={-variableCost}
          dotColour="var(--color-danger)"
        />
        <PLCell
          label="淨利"
          amount={profit}
          dotColour={profitable ? "var(--color-brand)" : "var(--color-danger)"}
          tone={profitable ? "brand" : "danger"}
          sub={
            revenue > 0
              ? `淨利率 ${((profit / revenue) * 100).toFixed(1)}%`
              : undefined
          }
        />
      </div>
    </div>
  );
}

function PLCell({
  label,
  amount,
  dotColour,
  tone,
  sub,
}: {
  label: string;
  amount: number;
  dotColour: string;
  tone?: "brand" | "danger";
  sub?: string;
}) {
  const textColour =
    tone === "brand"
      ? "var(--color-brand)"
      : tone === "danger"
        ? "var(--color-danger)"
        : "var(--color-text-primary)";
  return (
    <div className="bg-[var(--color-surface)] rounded-md p-3">
      <div className="flex items-center gap-1.5 mb-1">
        <span
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ background: dotColour }}
        />
        <p className="text-[10px] tracking-wider text-[var(--color-text-muted)] uppercase">
          {label}
        </p>
      </div>
      <p
        className="text-base font-bold tabular-nums"
        style={{ color: textColour }}
      >
        {amount < 0
          ? `-${Math.abs(amount).toLocaleString()}`
          : amount.toLocaleString()}
      </p>
      {sub && (
        <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">{sub}</p>
      )}
    </div>
  );
}

function CoverPage({ year, from, to }: { year: number; from: string; to: string }) {
  return (
    <div className="hidden print:flex print:flex-col print:items-stretch print:justify-between print:min-h-screen print:px-12 print:py-16 print:break-after-page">
      <div>
        <p className="text-xs tracking-[0.3em] uppercase text-[var(--color-text-muted)] mb-3">
          ANNUAL REVIEW · 年度營運檢視
        </p>
        <p className="text-[60px] font-serif font-bold leading-none text-[var(--color-text-primary)]">
          {year}
        </p>
        <p className="mt-4 text-base text-[var(--color-text-body)]">理髮廳營運報告</p>
        <p className="text-xs text-[var(--color-text-muted)] mt-1 tabular-nums">
          {from} ~ {to}
        </p>
      </div>
      <div className="text-right">
        <p className="text-[10px] tracking-wider uppercase text-[var(--color-text-muted)]">VERSION</p>
        <p className="font-mono text-sm">v1 · final</p>
      </div>
    </div>
  );
}

function ExecutiveSummary({ data }: { data: AnnualResponse }) {
  const { yoy, totals, rfm, retention } = data;
  const champPct = rfm.pct.champion + rfm.pct.loyal;
  const yoyText = yoy.cumulativeYoyPct !== null
    ? `${yoy.cumulativeYoyPct >= 0 ? "+" : ""}${yoy.cumulativeYoyPct.toFixed(1)}%`
    : "資料準備中";
  const retentionGap = Math.max(0, 50 - retention.retention90Days);

  return (
    <MCard padding="lg" className="bg-[var(--color-surface)]/40">
      <p className="text-[10px] tracking-[0.2em] uppercase text-[var(--color-text-muted)] mb-2">
        EXECUTIVE SUMMARY
      </p>
      <p className="text-sm text-[var(--color-text-body)] leading-relaxed">
        {data.year} 年全年營收 <strong>{totals.revenue.toLocaleString()}</strong>
        （較 {data.year - 1} 年 <strong className={yoy.cumulativeYoyPct === null ? "" : yoy.cumulativeYoyPct >= 0 ? "text-[var(--color-success)]" : "text-[var(--color-danger)]"}>{yoyText}</strong>）
        ，服務 <strong>{totals.uniqueCustomers}</strong> 位不重複客戶，
        其中冠軍 + 忠實老客貢獻 <strong>{champPct.toFixed(1)}%</strong> 主要營收。
        {retentionGap > 0
          ? ` 90 天回訪率 ${retention.retention90Days.toFixed(1)}% — 距業界 50% 仍有 ${retentionGap.toFixed(1)}pp 空間。`
          : " 90 天回訪率達業界水準。"}
      </p>
      <p className="text-sm text-[var(--color-text-body)] leading-relaxed mt-2 font-medium">
        {data.year + 1} 年聚焦：① 留存 {retention.retention90Days.toFixed(0)}% → 50%、② 染燙佔比拉到 35%+，可達成 +10~15% 成長。
      </p>
    </MCard>
  );
}

function SmallStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[var(--color-surface)]/60 rounded-lg p-3 text-center">
      <p className="text-[10px] tracking-wider uppercase text-[var(--color-text-muted)]">{label}</p>
      <p className="text-sm font-bold text-[var(--color-text-primary)] tabular-nums mt-1">{value}</p>
    </div>
  );
}

function ServiceStructureTable({
  shares,
  totalRev,
}: {
  shares: AnnualResponse["serviceShares"];
  totalRev: number;
}) {
  return (
    <MCard padding="md">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] border-b border-[var(--color-brand)]/10">
            <th className="text-left py-2">服務</th>
            <th className="text-right py-2">年營收</th>
            <th className="text-right py-2">佔比</th>
            <th className="text-right py-2">筆數</th>
          </tr>
        </thead>
        <tbody>
          {shares.map((s) => (
            <tr key={s.category} className="border-b border-[var(--color-brand)]/5">
              <td className="py-2 font-semibold text-[var(--color-text-primary)]">{s.category}</td>
              <td className="py-2 text-right tabular-nums">{s.revenue.toLocaleString()}</td>
              <td className="py-2 text-right tabular-nums">{s.share.toFixed(1)}%</td>
              <td className="py-2 text-right tabular-nums text-[var(--color-text-muted)]">{s.count}</td>
            </tr>
          ))}
          <tr className="font-bold">
            <td className="py-2">總計</td>
            <td className="py-2 text-right tabular-nums">{totalRev.toLocaleString()}</td>
            <td className="py-2 text-right tabular-nums">100%</td>
            <td className="py-2 text-right tabular-nums">
              {shares.reduce((s, x) => s + x.count, 0)}
            </td>
          </tr>
        </tbody>
      </table>
    </MCard>
  );
}

function SeasonalityChart({ sparkline }: { sparkline: MonthSpark[] }) {
  const recent12 = sparkline.slice(-12);
  if (recent12.length === 0) return null;
  const max = Math.max(...recent12.map((s) => s.revenue), 1);
  const avg = recent12.reduce((s, x) => s + x.revenue, 0) / recent12.length;
  const peakMonths = recent12.filter((s) => s.isPeak).map((s) => s.label);
  const troughMonths = recent12.filter((s) => s.isTrough).map((s) => s.label);

  return (
    <MCard padding="md">
      <svg viewBox="0 0 600 200" className="w-full h-40 sm:h-56">
        {/* Average line */}
        {avg > 0 && (
          <>
            <line
              x1="0"
              y1={200 - (avg / max) * 180}
              x2="600"
              y2={200 - (avg / max) * 180}
              stroke="var(--color-text-muted)"
              strokeDasharray="4 4"
              strokeWidth="1"
              opacity="0.5"
            />
            <text
              x="595"
              y={200 - (avg / max) * 180 - 4}
              textAnchor="end"
              fontSize="10"
              fill="var(--color-text-muted)"
            >
              月均 {Math.round(avg / 1000)}k
            </text>
          </>
        )}
        {recent12.map((s, i) => {
          const barH = (s.revenue / max) * 180;
          const x = (i / 12) * 600 + 8;
          const w = 600 / 12 - 16;
          let fill = "var(--color-text-muted)";
          if (s.isPeak) fill = "var(--color-success)";
          else if (s.isTrough) fill = "var(--color-danger)";
          return (
            <g key={s.month}>
              <rect
                x={x}
                y={200 - barH}
                width={w}
                height={barH}
                fill={fill}
                opacity={0.7}
                rx={2}
              />
              <text
                x={x + w / 2}
                y={200 - barH - 4}
                textAnchor="middle"
                fontSize="9"
                fill="var(--color-text-primary)"
                fontFamily="monospace"
              >
                {s.revenue > 0 ? `${Math.round(s.revenue / 1000)}k` : ""}
              </text>
              <text
                x={x + w / 2}
                y={196}
                textAnchor="middle"
                fontSize="9"
                fill="var(--color-text-muted)"
              >
                {s.label}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3 text-xs">
        <div className="bg-[var(--color-success)]/10 rounded-md p-2.5">
          <p className="font-semibold text-[var(--color-text-primary)]">
            🟢 旺季：{peakMonths.length > 0 ? peakMonths.join("、") : "—"}
          </p>
          <p className="text-[var(--color-text-body)] mt-0.5 leading-snug">
            高峰月份排班可考慮加開、客戶提前預約綁定
          </p>
        </div>
        <div className="bg-[var(--color-danger)]/10 rounded-md p-2.5">
          <p className="font-semibold text-[var(--color-text-primary)]">
            🔴 淡季：{troughMonths.length > 0 ? troughMonths.join("、") : "—"}
          </p>
          <p className="text-[var(--color-text-body)] mt-0.5 leading-snug">
            可預約老客電話通知 + 折扣推促銷組合，提前填滿空檔
          </p>
        </div>
      </div>

      <div className="mt-3 bg-[var(--color-brand)]/8 border-l-[3px] border-[var(--color-brand)] rounded-r-md px-3 py-2 text-xs">
        <p className="font-semibold">💡 {recent12[0]?.label.replace("月", "")} 年行動建議</p>
        <p className="text-[var(--color-text-body)] mt-1">
          順著季節節奏，把行銷資源集中在淡季月（提前 2 週通知）+ 旺季月（提早 1 個月開放預約）
        </p>
      </div>
    </MCard>
  );
}

function Highlights({
  highlights,
  topCustomers,
}: {
  highlights: AnnualHighlights;
  topCustomers: AnnualResponse["topCustomers"];
}) {
  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <SmallStat
          label="最高單月"
          value={`${(highlights.highestMonthRevenue / 10000).toFixed(1)}萬`}
        />
        <SmallStat label="服務總次數" value={highlights.totalServiceCount.toLocaleString()} />
        <SmallStat label="不重複客戶" value={highlights.uniqueCustomers.toLocaleString()} />
        <SmallStat
          label="最高單筆消費"
          value={`${highlights.highestSingleTicket.toLocaleString()}`}
        />
      </div>

      <MCard padding="md">
        <p className="text-xs font-semibold text-[var(--color-text-primary)] mb-3">
          🥇 Top 5 客戶（按年度消費）
        </p>
        <div className="space-y-2">
          {topCustomers.map((c, i) => (
            <div
              key={c.id}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg ${
                i === 0
                  ? "bg-[var(--color-service-color)]/10 border border-[var(--color-service-color)]/20"
                  : "bg-[var(--color-surface)]/40"
              }`}
            >
              <span
                className={`text-xl font-serif font-bold tabular-nums ${
                  i === 0
                    ? "text-[var(--color-service-color)]"
                    : "text-[var(--color-text-muted)]"
                }`}
                style={{ fontFamily: "Manrope, serif", fontSize: i === 0 ? "28px" : undefined }}
              >
                #{i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[var(--color-text-primary)] truncate">
                  {c.displayName ?? "—"}
                </p>
                <p className="text-[10px] text-[var(--color-text-muted)] tabular-nums">
                  訪問 {c.visitCount} 次 · 消費 {c.totalSpend.toLocaleString()}
                </p>
              </div>
              {i === 0 && <MTag tone="brand">年度冠軍</MTag>}
            </div>
          ))}
        </div>
        <p className="text-[11px] text-[var(--color-text-muted)] mt-3 text-right">
          完整 {highlights.championCount} 位冠軍客戶名單可從「客戶」頁匯出
        </p>
      </MCard>
    </>
  );
}

function ScenarioPicker({
  scenarios,
  chosen,
  onChoose,
  year,
  prevYearRevenue,
}: {
  scenarios: Scenario[];
  chosen: ScenarioKey;
  onChoose: (k: ScenarioKey) => void;
  year: number;
  prevYearRevenue: number;
}) {
  const [customAmount, setCustomAmount] = useState("");
  const chosenS = scenarios.find((s) => s.key === chosen);

  const save = () => {
    const target =
      chosen === "custom"
        ? parseInt(customAmount.replace(/[^\d]/g, ""), 10)
        : chosenS?.targetAnnual ?? 0;
    if (!Number.isFinite(target) || target <= 0) {
      alert("請輸入有效的目標金額");
      return;
    }
    fetch("/api/admin/year-target", {
      method: "POST",
      headers: adminHeaders(),
      body: JSON.stringify({
        year,
        scenario: chosen,
        targetAnnualRevenue: target,
        monthlyTargets: chosen === "custom"
          ? Object.fromEntries(
              Array.from({ length: 12 }, (_, i) => [
                `${year}-${String(i + 1).padStart(2, "0")}`,
                Math.round(target / 12),
              ]),
            )
          : chosenS?.monthlyTargets ?? {},
      }),
    }).then((r) => {
      if (r.ok) alert(`${year} 年目標已儲存：${target.toLocaleString()}`);
      else alert("儲存失敗");
    });
  };

  return (
    <MCard padding="md">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {scenarios.map((s) => {
          const active = s.key === chosen;
          return (
            <button
              key={s.key}
              onClick={() => onChoose(s.key)}
              className={`text-left px-3 py-3 rounded-lg border transition-all ${
                active
                  ? "border-[var(--color-brand)] bg-[var(--color-brand)]/8"
                  : "border-[var(--color-brand)]/12 bg-[var(--color-bg)] hover:bg-[var(--color-surface)]/40"
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-bold text-[var(--color-text-primary)]">
                  {s.label}
                </p>
                {s.recommended && <MTag tone="brand">推薦</MTag>}
              </div>
              <p className="text-base font-bold tabular-nums text-[var(--color-brand)]">
                {s.key === "custom" ? "自訂金額" : `${(s.targetAnnual / 10000).toFixed(1)}萬`}
              </p>
              <p className="text-[10px] text-[var(--color-text-muted)] mt-1 leading-snug">
                {s.key === "custom"
                  ? "點選後輸入自訂年度目標"
                  : `${s.multiplier === 1.0 ? "持平" : `× ${s.multiplier}`}（vs ${year - 1} 年）`}
              </p>
            </button>
          );
        })}
      </div>

      {chosen === "custom" && (
        <div className="mt-3 flex items-center gap-2">
          <span className="text-sm text-[var(--color-text-body)]">目標年營收</span>
          <input
            type="text"
            inputMode="numeric"
            value={customAmount}
            onChange={(e) => setCustomAmount(e.target.value)}
            placeholder={`${prevYearRevenue.toLocaleString()}`}
            className="flex-1 px-3 py-2 rounded-md border border-[var(--color-brand)]/20 bg-[var(--color-bg)] text-sm tabular-nums"
          />
        </div>
      )}

      {chosenS && chosen !== "custom" && (
        <div className="mt-3 bg-[var(--color-brand)]/8 border-l-[3px] border-[var(--color-brand)] rounded-r-md px-3 py-2.5 text-xs">
          <p className="font-semibold text-[var(--color-text-primary)] mb-1">達成路徑</p>
          <p className="text-[var(--color-text-body)] leading-relaxed">{chosenS.pathDescription}</p>
        </div>
      )}

      <button
        onClick={save}
        className="w-full mt-3 px-4 py-3 rounded-xl bg-[var(--color-brand)] text-[var(--color-bg)] text-sm font-semibold hover:opacity-90"
      >
        儲存 {year} 年度目標
      </button>
    </MCard>
  );
}

// ─── helpers ─────────────────────────────────────────────────────────────

function statusForYoY(yoy: number | null): "ok" | "warning" | "danger" {
  if (yoy === null) return "warning";
  if (yoy >= 15) return "ok";
  if (yoy >= 0) return "warning";
  return "danger";
}

function statusForRetention(v: number): "ok" | "warning" | "danger" {
  if (v >= 50) return "ok";
  if (v >= 40) return "warning";
  return "danger";
}

function statusForArpu(visitFreq: number): "ok" | "warning" | "danger" {
  if (visitFreq >= 4) return "ok";
  if (visitFreq >= 3) return "warning";
  return "danger";
}
