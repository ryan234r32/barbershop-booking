"use client";

import useSWR from "swr";
import { adminHeaders } from "@/lib/auth/admin-fetch";
import { MCard } from "@/components/admin/reports/v3.6/m-card";
import { MTag } from "@/components/admin/reports/v3.6/m-tag";
import { DateStrip } from "@/components/admin/reports/v3.6/date-strip";
import { KpiCard } from "@/components/admin/reports/v3.6/kpi-card";
import { AlertBanner } from "@/components/admin/reports/v3.6/alert-banner";
import { ThreeWayDecomposition } from "@/components/admin/reports/v3.6/three-way-decomposition";
import { Sparkline } from "@/components/admin/reports/v3.6/sparkline";
import { ProgressBar } from "@/components/admin/reports/v3.6/progress-bar";
import { RfmCards, RfmSummary } from "@/components/admin/reports/v3.6/rfm-card";
import { YoYBars } from "@/components/admin/reports/v3.6/yoy-bars";
import { SectionDivider } from "@/components/admin/reports/v3.6/section-divider";
import type { Alert, RfmGrid, YoYResult, MonthSpark, MonthlyTargetResult, PrebookRateResult } from "@/lib/reports/v3.6/aggregates";

interface MonthlyResponse {
  view: "monthly";
  period: string;             // "YYYY-MM"
  range: { label: string; fromIso: string; toIso: string };
  previousLabel: string;
  totals: {
    bookings: number;
    revenue: number;
    uniqueCustomers: number;
    newCustomers: number;
    arpu: number;
    occupancyRate: number;
    cancellationRate: number;
    noShowRate: number;
    visitFrequency: number;
    oneTimerRate: number;
    avgGapDays: number;
    medianGapDays: number;
    shopNewCustomers: number;
    shopOldCustomers: number;
  };
  previousTotals: MonthlyResponse["totals"];
  servicePie: Array<{ category: string; count: number; revenue: number }>;
  retention: { retention30Days: number; retention60Days: number; retention90Days: number };
  prebook: PrebookRateResult;
  prebookPrev: PrebookRateResult;
  rfm: RfmGrid;
  target: MonthlyTargetResult;
  sparkline: MonthSpark[];
  alerts: Alert[];
  summaryText: string;
  chemicalShare: number;
  chemicalShareLastMonth: number;
  yoy: YoYResult;
  momChangePct: number | null;
  yoyChangePct: number | null;
}

const fetcher = (url: string) =>
  fetch(url, { headers: adminHeaders() }).then((r) => {
    if (!r.ok) throw new Error(String(r.status));
    return r.json();
  });

interface MonthlyViewProps {
  period: string;             // "YYYY-MM"
  onPeriodChange: (next: string) => void;
}

export function MonthlyView({ period, onPeriodChange }: MonthlyViewProps) {
  const { data, error, isLoading } = useSWR<MonthlyResponse>(
    `/api/reports/v3.6?view=monthly&period=${period}`,
    fetcher,
    { revalidateOnFocus: false },
  );

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <div className="h-12 bg-[var(--color-surface)] rounded-lg animate-pulse" />
        <div className="h-48 bg-[var(--color-surface)] rounded-2xl animate-pulse" />
        <div className="h-32 bg-[var(--color-surface)] rounded-2xl animate-pulse" />
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
  const t = data.totals;
  const customers = t.uniqueCustomers;
  const ticket = t.arpu;
  const revenue = t.revenue;

  return (
    <div className="space-y-5">
      {/* ① Header — 月份切換器（左右滑動） */}
      <DateStrip kind="month" selected={period} onSelect={onPeriodChange} />

      {empty && (
        <div className="bg-[var(--color-surface)] rounded-2xl p-12 text-center text-sm text-[var(--color-text-muted)] space-y-2">
          <div className="text-3xl opacity-40">📊</div>
          <p>{data.range.label}沒有預約紀錄</p>
        </div>
      )}

      {!empty && (
        <>
          {/* ② Alert Banner */}
          <AlertBanner alerts={data.alerts} />

          {/* ③ Hero: 三段拆解 + sparkline + target progress + summary */}
          <MCard padding="lg">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <p className="text-[10px] tracking-wider text-[var(--color-text-muted)] uppercase">
                  {data.range.label}營收
                </p>
                <p className="text-3xl font-bold tabular-nums text-[var(--color-text-primary)] mt-1">
                  {revenue.toLocaleString()}
                </p>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  {data.momChangePct !== null && (
                    <MTag tone={data.momChangePct >= 0 ? "success" : "danger"}>
                      較上月 {data.momChangePct >= 0 ? "+" : ""}{data.momChangePct.toFixed(1)}%
                    </MTag>
                  )}
                  {data.yoyChangePct !== null && (
                    <MTag tone={data.yoyChangePct >= 0 ? "success" : "danger"}>
                      較去年同月 {data.yoyChangePct >= 0 ? "+" : ""}{data.yoyChangePct.toFixed(1)}%
                    </MTag>
                  )}
                </div>
              </div>
            </div>

            <ThreeWayDecomposition customers={customers} ticket={ticket} revenue={revenue} />

            <div className="mt-4">
              <p className="text-[11px] text-[var(--color-text-muted)] mb-1">過去 12 月走勢</p>
              <Sparkline points={data.sparkline.map((s) => ({
                label: s.label,
                value: s.revenue,
                isCurrent: s.isCurrent,
                isPeak: s.isPeak,
                isTrough: s.isTrough,
              }))} />
            </div>

            {data.target.targetRevenue !== null && (
              <div className="mt-4 pt-4 border-t border-[var(--color-brand)]/8">
                <div className="flex items-baseline justify-between mb-1.5">
                  <p className="text-xs font-semibold text-[var(--color-text-primary)]">
                    本月目標達成率
                  </p>
                  <p className="text-base font-bold tabular-nums text-[var(--color-brand)]">
                    {data.target.achievementRate.toFixed(1)}%
                  </p>
                </div>
                <ProgressBar
                  value={data.target.achievementRate}
                  benchmark={data.target.paceExpectedRate}
                  rightLabel={`目標 ${data.target.targetRevenue.toLocaleString()} · 進度線 ${data.target.paceExpectedRate.toFixed(0)}%`}
                  tone={data.target.achievementRate >= data.target.paceExpectedRate ? "success" : "warning"}
                />
              </div>
            )}

            {/* Natural language summary */}
            <p
              className="text-sm text-[var(--color-text-body)] leading-relaxed mt-4 pt-4 border-t border-[var(--color-brand)]/8"
              dangerouslySetInnerHTML={{ __html: renderMarkdownBold(data.summaryText) }}
            />
          </MCard>

          {/* ④ KPI 2×2 grid */}
          <div className="grid grid-cols-2 gap-3">
            <KpiCard
              label="新客 90 天回訪率"
              primary={`${data.retention.retention90Days.toFixed(1)}%`}
              status={statusForRetention(data.retention.retention90Days)}
              benchmark={{
                current: data.retention.retention90Days,
                tiers: [
                  { at: 40, label: "業界 40%" },
                  { at: 65, label: "頂尖 65%" },
                ],
              }}
            />
            <KpiCard
              label="離店再預約率"
              primary={`${data.prebook.rate.toFixed(1)}%`}
              secondary={`${data.prebook.prebookCount}/${data.prebook.completedCount} 筆`}
              deltaPct={
                data.prebookPrev.rate > 0
                  ? Math.round((data.prebook.rate - data.prebookPrev.rate) * 10) / 10
                  : null
              }
              comparisonLabel="上月"
              status={statusForPrebook(data.prebook.rate)}
              benchmark={{
                current: data.prebook.rate,
                tiers: [
                  { at: 50, label: "警戒 50%" },
                  { at: 70, label: "目標 70%" },
                ],
              }}
            />
            <KpiCard
              label="月活躍客戶數"
              primary={`${customers} 人`}
              secondary={`新客 ${t.newCustomers} · 老客 ${customers - t.newCustomers}`}
              deltaPct={
                data.previousTotals.uniqueCustomers > 0
                  ? Math.round(
                      ((customers - data.previousTotals.uniqueCustomers) /
                        data.previousTotals.uniqueCustomers) *
                        1000,
                    ) / 10
                  : null
              }
              comparisonLabel={data.previousLabel}
              status={statusForActive(customers)}
            />
            <KpiCard
              label="染燙服務佔比"
              primary={`${data.chemicalShare.toFixed(1)}%`}
              deltaPct={
                data.chemicalShareLastMonth > 0
                  ? Math.round((data.chemicalShare - data.chemicalShareLastMonth) * 10) / 10
                  : null
              }
              comparisonLabel="上月"
              status={statusForChemical(data.chemicalShare)}
              benchmark={{
                current: data.chemicalShare,
                tiers: [
                  { at: 35, label: "目標 40%" },
                  { at: 60, label: "頂尖 60%" },
                ],
              }}
            />
          </div>

          {/* ⑤ 12 個月與去年同期對照 */}
          <SectionDivider
            number="01"
            title="過去 12 個月 vs 去年同期"
            subtitle="點任一月份柱狀，看詳細數字 + 同期比"
          >
            <MCard padding="md">
              <YoYBars
                data={data.yoy}
                hasLastYearData={data.yoy.hasLastYearData}
                anchorYear={parseInt(period.slice(0, 4), 10)}
              />
            </MCard>
          </SectionDivider>

          {/* ⑥ 服務組合 */}
          <SectionDivider number="02" title="服務組合" subtitle="本月各服務佔比 + actionable insight">
            <ServiceMixWidget
              pie={data.servicePie}
              chemicalShare={data.chemicalShare}
              chemicalShareLast={data.chemicalShareLastMonth}
              totalRevenue={revenue}
            />
          </SectionDivider>

          {/* ⑦ 客戶結構（RFM） */}
          <SectionDivider
            number="03"
            title="客戶結構（RFM 分群）"
            subtitle="按 Recency / Frequency / Monetary 三維分類"
            collapsible
            defaultOpen={false}
          >
            <MCard padding="md">
              <RfmCards grid={data.rfm} />
              <RfmSummary grid={data.rfm} />
            </MCard>
          </SectionDivider>

          {/* ⑧ Action footer */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              onClick={() => window.print()}
              className="px-4 py-3 rounded-xl bg-[var(--color-brand)] text-[var(--color-bg)] text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              產出 {data.range.label}完整月報 PDF
            </button>
            <SetTargetButton period={period} currentTarget={data.target.targetRevenue} />
          </div>
        </>
      )}
    </div>
  );
}

// ─── Sub-widgets ─────────────────────────────────────────────────────────

function ServiceMixWidget({
  pie,
  chemicalShare,
  chemicalShareLast,
  totalRevenue,
}: {
  pie: Array<{ category: string; count: number; revenue: number }>;
  chemicalShare: number;
  chemicalShareLast: number;
  totalRevenue: number;
}) {
  const total = pie.reduce((s, p) => s + p.revenue, 0) || 1;
  const sorted = [...pie].sort((a, b) => b.revenue - a.revenue);
  const chemDelta = chemicalShare - chemicalShareLast;
  const targetShare = 35;
  const gapPp = targetShare - chemicalShare;
  const monthlyChemRev = (chemicalShare / 100) * totalRevenue;
  const targetRev = (targetShare / 100) * totalRevenue;
  const upliftRev = Math.max(0, targetRev - monthlyChemRev);

  return (
    <MCard padding="md">
      <div className="space-y-2">
        {sorted.map((s) => {
          const pct = (s.revenue / total) * 100;
          return (
            <div key={s.category} className="flex items-center gap-3 text-xs">
              <span className="w-8 shrink-0 font-semibold text-[var(--color-text-primary)]">
                {s.category}
              </span>
              <div className="flex-1 bg-[var(--color-surface)] rounded h-5 overflow-hidden relative">
                <div
                  className="h-full bg-[var(--color-brand)]/70 rounded"
                  style={{ width: `${pct}%` }}
                />
                <span className="absolute inset-0 flex items-center pl-2 text-[10px] text-[var(--color-text-primary)] font-mono">
                  {s.revenue.toLocaleString()} ({s.count})
                </span>
              </div>
              <span className="w-10 text-right font-mono text-[var(--color-text-muted)] tabular-nums">
                {pct.toFixed(0)}%
              </span>
            </div>
          );
        })}
      </div>

      {gapPp > 0 && (
        <div className="mt-4 bg-[var(--color-danger)]/8 border-l-[3px] border-[var(--color-danger)] rounded-r-md px-3 py-2 text-xs">
          <p className="font-semibold text-[var(--color-text-primary)]">
            💰 染燙合計 {chemicalShare.toFixed(1)}%（{chemDelta >= 0 ? "+" : ""}{chemDelta.toFixed(1)}pp vs 上月），距業界目標 {targetShare}% 還差 {gapPp.toFixed(1)}pp
          </p>
          <p className="text-[var(--color-text-body)] mt-1">
            本月染燙營收 {Math.round(monthlyChemRev).toLocaleString()}，達標可增加約 {Math.round(upliftRev).toLocaleString()}/月
          </p>
        </div>
      )}
    </MCard>
  );
}

function SetTargetButton({
  period,
  currentTarget,
}: {
  period: string;
  currentTarget: number | null;
}) {
  return (
    <button
      onClick={() => {
        const input = window.prompt(
          `設定 ${monthLabel(period)} 月目標營收：`,
          currentTarget ? String(currentTarget) : "",
        );
        if (!input) return;
        const v = parseInt(input.replace(/[^\d]/g, ""), 10);
        if (!Number.isFinite(v) || v <= 0) {
          alert("請輸入有效的目標金額");
          return;
        }
        fetch("/api/admin/year-target", {
          method: "POST",
          headers: adminHeaders(),
          body: JSON.stringify({
            year: parseInt(period.slice(0, 4), 10),
            scenario: "custom",
            targetAnnualRevenue: v * 12,
            monthlyTargets: { [period]: v },
          }),
        }).then((r) => {
          if (r.ok) window.location.reload();
        });
      }}
      className="px-4 py-3 rounded-xl bg-[var(--color-surface)] text-[var(--color-text-primary)] text-sm font-semibold hover:bg-[var(--color-text-muted)]/10 transition-colors"
    >
      設定下月目標
    </button>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────

function monthLabel(period: string): string {
  const m = parseInt(period.slice(5, 7), 10);
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Taipei" });
  if (period === today.slice(0, 7)) return "本月";
  const tNum = parseInt(today.slice(0, 7).replace("-", ""), 10);
  const pNum = parseInt(period.replace("-", ""), 10);
  if (pNum === tNum - 1) return "上月";
  if (pNum === tNum + 1) return "下月";
  return `${m} 月`;
}

function statusForRetention(v: number): "ok" | "warning" | "danger" {
  if (v >= 50) return "ok";
  if (v >= 40) return "warning";
  return "danger";
}

function statusForPrebook(v: number): "ok" | "warning" | "danger" {
  if (v >= 50) return "ok";
  if (v >= 30) return "warning";
  return "danger";
}

function statusForActive(v: number): "ok" | "warning" | "danger" {
  if (v >= 70) return "ok";
  if (v >= 60) return "warning";
  return "danger";
}

function statusForChemical(v: number): "ok" | "warning" | "danger" {
  if (v >= 35) return "ok";
  if (v >= 25) return "warning";
  return "danger";
}

/** Convert **bold** markers from natural-language summary to <strong>. */
function renderMarkdownBold(text: string): string {
  // escape HTML first
  const safe = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return safe.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}
