"use client";

import { memo, useMemo } from "react";
import useSWR from "swr";
import { AlertTriangle, ArrowRight, BarChart3, CheckCircle2, Coins } from "lucide-react";
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

interface MonthRangeMeta {
  from: string;
  to: string;
  daysInMonth: number;
}

function monthRange(period: string): MonthRangeMeta {
  const [y, m] = period.split("-").map((s) => parseInt(s, 10));
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    from: `${y}-${pad(m)}-01`,
    to: `${y}-${pad(m)}-${pad(daysInMonth)}`,
    daysInMonth,
  };
}

export function MonthlyView({ period, onPeriodChange }: MonthlyViewProps) {
  const { data, error, isLoading, isValidating } = useSWR<MonthlyResponse>(
    `/api/reports/v3.6?view=monthly&period=${period}`,
    fetcher,
    { revalidateOnFocus: false, keepPreviousData: true, dedupingInterval: 3000 },
  );

  // V3.7 §E — fetch expenses + day-close snapshots in parallel.
  const range = useMemo(() => monthRange(period), [period]);
  const { data: expensesData } = useSWR<{ totalAmount: number; expenses: Array<{ amount: number; type: "FIXED" | "VARIABLE" }> }>(
    `/api/expenses?from=${range.from}&to=${range.to}`,
    fetcher,
    { revalidateOnFocus: false, keepPreviousData: true, dedupingInterval: 3000 },
  );
  const { data: closesData } = useSWR<{ snapshots: Array<{ date: string; netProfit: number; cashDiff: number; bankConfirmed: boolean }> }>(
    `/api/admin/day-close?from=${range.from}&to=${range.to}`,
    fetcher,
    { revalidateOnFocus: false, keepPreviousData: true, dedupingInterval: 3000 },
  );
  const expenseTotal = expensesData?.totalAmount ?? 0;
  const expenseFixed = (expensesData?.expenses ?? [])
    .filter((e) => e.type === "FIXED")
    .reduce((s, e) => s + e.amount, 0);
  const expenseVariable = (expensesData?.expenses ?? [])
    .filter((e) => e.type === "VARIABLE")
    .reduce((s, e) => s + e.amount, 0);
  const closedDates = new Set(closesData?.snapshots.map((s) => s.date) ?? []);
  const closesWithDiff = (closesData?.snapshots ?? []).filter(
    (s) => s.cashDiff !== 0,
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
    <div className="space-y-5 relative">
      {isValidating && (
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-[var(--color-brand)] animate-pulse z-10" />
      )}
      {/* ① Header — 月份切換器（左右滑動） */}
      <DateStrip kind="month" selected={period} onSelect={onPeriodChange} />

      {empty && (
        <div className="bg-[var(--color-surface)] rounded-2xl p-12 text-center text-sm text-[var(--color-text-muted)] space-y-2">
          <div className="flex justify-center opacity-40">
            <BarChart3 size={36} aria-hidden />
          </div>
          <p>{data.range.label}沒有預約紀錄</p>
        </div>
      )}

      {!empty && (
        <>
          {/* ② Alert Banner */}
          <AlertBanner alerts={data.alerts} />

          {/* ③ Hero: 三段拆解 + sparkline + target progress + summary */}
          <MCard padding="lg">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <p className="text-xs sm:text-sm tracking-wider text-[var(--color-text-muted)] uppercase">
                  {data.range.label}營收
                </p>
                <p className="text-4xl sm:text-5xl font-bold tabular-nums text-[var(--color-text-primary)] mt-1.5">
                  {revenue.toLocaleString()}
                </p>
                <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                  {data.momChangePct !== null && (
                    <MTag size="sm" tone={data.momChangePct >= 0 ? "success" : "danger"}>
                      較上月 {data.momChangePct >= 0 ? "+" : ""}{data.momChangePct.toFixed(1)}%
                    </MTag>
                  )}
                  {data.yoyChangePct !== null && (
                    <MTag size="sm" tone={data.yoyChangePct >= 0 ? "success" : "danger"}>
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

          {/* V3.7 §E — 支出 / 淨利 / 結帳天數 row.
              `min-w-0` on each MCard so flex children can shrink instead of
              forcing horizontal overflow on narrow phones. Numbers use
              `whitespace-nowrap` to avoid mid-thousands wrapping; sublines wrap.
              V3.9 a11y: labels were `text-[10px] uppercase` — failed Apple HIG
              minimum readable size on phone. Bump to `text-xs font-semibold`
              (12px) without uppercase for normal Chinese-character cadence. */}
          <div className="grid grid-cols-3 gap-2">
            <MCard padding="md">
              <p className="text-xs sm:text-sm font-semibold text-[var(--color-text-muted)]">
                本月支出
              </p>
              <p className="text-base sm:text-xl font-bold tabular-nums text-[var(--color-danger)] mt-1 whitespace-nowrap">
                -{expenseTotal.toLocaleString()}
              </p>
              <p className="text-[11px] text-[var(--color-text-muted)] mt-1 tabular-nums leading-tight break-words">
                固定 {expenseFixed.toLocaleString()}
                <br />
                變動 {expenseVariable.toLocaleString()}
              </p>
            </MCard>
            <MCard padding="md">
              <p className="text-xs sm:text-sm font-semibold text-[var(--color-text-muted)]">
                本月淨利
              </p>
              <p
                className="text-base sm:text-xl font-bold tabular-nums mt-1 whitespace-nowrap"
                style={{
                  color:
                    revenue - expenseTotal >= 0
                      ? "var(--color-brand)"
                      : "var(--color-danger)",
                }}
              >
                {(revenue - expenseTotal).toLocaleString()}
              </p>
              <p className="text-[11px] text-[var(--color-text-muted)] mt-1 leading-tight">
                淨利率 {revenue > 0 ? (((revenue - expenseTotal) / revenue) * 100).toFixed(1) : "—"}%
              </p>
            </MCard>
            <MCard padding="md">
              <p className="text-xs sm:text-sm font-semibold text-[var(--color-text-muted)]">
                結帳天數
              </p>
              <p className="text-base sm:text-xl font-bold tabular-nums text-[var(--color-text-primary)] mt-1 whitespace-nowrap">
                {closedDates.size}
                <span className="text-sm font-normal text-[var(--color-text-muted)]">
                  /{range.daysInMonth}
                </span>
              </p>
              <p className="text-[11px] text-[var(--color-text-muted)] mt-1 leading-tight">
                {closesWithDiff.length > 0 ? `${closesWithDiff.length} 天有差異` : "全部準時對上"}
              </p>
            </MCard>
          </div>

          {/* V3.7 §E — Close-status month grid */}
          <CloseStatusGrid
            period={period}
            daysInMonth={range.daysInMonth}
            closedDates={closedDates}
            diffDates={new Set(closesWithDiff.map((s) => s.date))}
          />

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

const ServiceMixWidget = memo(function ServiceMixWidget({
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
  // V3.8 perf: useMemo so unrelated re-renders (expenses/closes useSWR
  // resolving at different ms) don't re-sort/re-reduce. Recomputes only
  // when the SWR fetch returns a fresh `pie` reference or share changes.
  const { sorted, total, chemDelta, gapPp, monthlyChemRev, upliftRev, targetShare } = useMemo(() => {
    const tShare = 35;
    const t = pie.reduce((s, p) => s + p.revenue, 0) || 1;
    const s = [...pie].sort((a, b) => b.revenue - a.revenue);
    const monthlyChem = (chemicalShare / 100) * totalRevenue;
    const targetRev = (tShare / 100) * totalRevenue;
    return {
      sorted: s,
      total: t,
      chemDelta: chemicalShare - chemicalShareLast,
      gapPp: tShare - chemicalShare,
      monthlyChemRev: monthlyChem,
      upliftRev: Math.max(0, targetRev - monthlyChem),
      targetShare: tShare,
    };
  }, [pie, chemicalShare, chemicalShareLast, totalRevenue]);

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
          <p className="font-semibold text-[var(--color-text-primary)] inline-flex items-start gap-1.5">
            <Coins size={14} aria-hidden className="mt-0.5 shrink-0" />
            <span>
              染燙合計 {chemicalShare.toFixed(1)}%（{chemDelta >= 0 ? "+" : ""}{chemDelta.toFixed(1)}pp vs 上月），距業界目標 {targetShare}% 還差 {gapPp.toFixed(1)}pp
            </span>
          </p>
          <p className="text-[var(--color-text-body)] mt-1">
            本月染燙營收 {Math.round(monthlyChemRev).toLocaleString()}，達標可增加約 {Math.round(upliftRev).toLocaleString()}/月
          </p>
        </div>
      )}
    </MCard>
  );
});

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

// ─── V3.7 §E — Close-status grid ────────────────────────────────────────

/**
 * V3.9 redesign — 結帳狀態 calendar grid.
 *
 * Why this exists: pre-V3.9, every "未結" day used the same flat surface fill,
 * so future / today / past-not-closed all looked identical → owner thought
 * "確認對帳" on each booking row was the same as 完成今日結帳, never noticed the
 * grid stayed blank. This rewrite fixes both the visual grammar and the
 * call-to-action gap.
 *
 * Visual grammar (5 states, distinct shape + hue):
 *   - 已結帳 / 無差異 → solid green fill
 *   - 已結帳 / 有差異 → solid amber fill (drives clicks back to daily view)
 *   - 過去 / 未結    → dashed amber outline ("待結" — needs action)
 *   - 今日 / 未結    → solid brand-color outline + bold (the "do this now" cell)
 *   - 未來          → faint, no fill
 *
 * UX guards on top of the grid:
 *   - **Summary line** "X / Y 天已結帳" answers "where am I" instantly.
 *   - **Today CTA** appears only when today is unclosed → one tap to daily view.
 *   - **Empty-state hint** explains the gap when the grid is blank
 *     (closes 0 yet days have elapsed) — this is exactly the trap that bit
 *     the owner on 2026-05-05.
 */
function CloseStatusGrid({
  period,
  daysInMonth,
  closedDates,
  diffDates,
}: {
  period: string;
  daysInMonth: number;
  closedDates: Set<string>;
  diffDates: Set<string>;
}) {
  const [year, month] = period.split("-").map((s) => parseInt(s, 10));
  const todayStr = new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Taipei",
  });
  // Compute weekday of day-1 (Sun=0). Use Date.UTC + getUTCDay for TZ-safe.
  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const cells: Array<{ day: number; iso: string } | null> = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    cells.push({ day: d, iso });
  }

  // Summary stats — "elapsed" = past days + today (if today is in this month).
  // For other months, elapsed = whole month if month < today's month, else 0.
  const elapsedDays = cells.reduce((n, c) => {
    if (!c) return n;
    return c.iso <= todayStr ? n + 1 : n;
  }, 0);
  const closedCount = closedDates.size;
  const diffCount = diffDates.size;
  const pendingCount = Math.max(0, elapsedDays - closedCount);
  const todayInMonth = cells.some((c) => c?.iso === todayStr);
  const todayClosed = closedDates.has(todayStr);
  const showTodayCta = todayInMonth && !todayClosed;
  const showEmptyHint = closedCount === 0 && elapsedDays > 0;

  const jumpToDailyToday = () => {
    // Page-level effect mirrors state to URL on mount, so an absolute nav
    // re-enters the report page on the daily tab for today. Full reload is
    // <300ms on the SWR-prefetched bundle and avoids prop-drilling setView.
    window.location.assign(`/reports?view=daily&date=${todayStr}`);
  };

  return (
    <MCard padding="md">
      <div className="flex items-baseline justify-between mb-1 gap-2 flex-wrap">
        <p className="text-sm font-semibold text-[var(--color-text-primary)]">
          結帳狀態
        </p>
        <p className="text-xs text-[var(--color-text-muted)] tabular-nums">
          {elapsedDays === 0 ? (
            "本月尚未開始"
          ) : (
            <>
              <span className="text-[var(--color-success)] font-semibold">
                {closedCount}
              </span>
              <span> / {elapsedDays} 天已結帳</span>
              {diffCount > 0 && (
                <span className="text-[var(--color-warning)]">
                  {" "}
                  · {diffCount} 天有差異
                </span>
              )}
              {pendingCount > 0 && (
                <span className="text-[var(--color-warning)]">
                  {" "}
                  · {pendingCount} 天待結
                </span>
              )}
            </>
          )}
        </p>
      </div>

      {/* Today CTA — primary call-to-action when today isn't closed yet.
          Appears only on the current month's view (todayInMonth check). */}
      {showTodayCta && (
        <button
          onClick={jumpToDailyToday}
          className="w-full mb-3 mt-2 flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg bg-[var(--color-brand)]/8 border border-[var(--color-brand)]/25 text-[var(--color-brand)] hover:bg-[var(--color-brand)]/12 transition-colors text-left"
        >
          <span className="flex items-center gap-2 text-sm font-semibold">
            <CheckCircle2 size={16} aria-hidden />
            今日（{todayStr.slice(5).replace("-", "/")}）尚未結帳
          </span>
          <span className="flex items-center gap-1 text-xs font-semibold whitespace-nowrap">
            前往結帳
            <ArrowRight size={14} aria-hidden />
          </span>
        </button>
      )}

      {/* Empty-state hint — disambiguates "我有按確認啊，為什麼還是空的？"
          The owner confused per-booking settle with day-close on 2026-05-05. */}
      {showEmptyHint && !showTodayCta && (
        <div className="mb-3 mt-2 px-3 py-2 rounded-md bg-[var(--color-surface)]/60 border-l-[3px] border-[var(--color-text-muted)]/40">
          <p className="text-[11px] text-[var(--color-text-body)] leading-relaxed inline-flex items-start gap-1.5">
            <AlertTriangle
              size={12}
              aria-hidden
              className="mt-0.5 shrink-0 text-[var(--color-text-muted)]"
            />
            <span>
              在「每日」分頁底完成「<span className="font-semibold">完成今日結帳</span>」按鈕後，這裡才會點亮綠色。逐筆「確認對帳」尚不算結帳。
            </span>
          </p>
        </div>
      )}

      <div className="grid grid-cols-7 gap-1 text-[11px] tabular-nums">
        {["日", "一", "二", "三", "四", "五", "六"].map((w) => (
          <div
            key={w}
            className="text-center text-[10px] text-[var(--color-text-muted)] py-1"
          >
            {w}
          </div>
        ))}
        {cells.map((c, i) => {
          if (!c) return <div key={`b${i}`} />;
          const isClosed = closedDates.has(c.iso);
          const hasDiff = diffDates.has(c.iso);
          const isFuture = c.iso > todayStr;
          const isToday = c.iso === todayStr;
          // 5-state classification. Each branch sets the cell's full visual
          // grammar (fill + text + border) so the cases are mutually exclusive
          // and easy to scan.
          let cellClass: string;
          if (isFuture) {
            cellClass = "bg-transparent text-[var(--color-text-disabled)]";
          } else if (isClosed && hasDiff) {
            cellClass =
              "bg-[var(--color-warning)]/20 text-[var(--color-warning)] font-bold";
          } else if (isClosed) {
            cellClass =
              "bg-[var(--color-success)]/20 text-[var(--color-success)] font-bold";
          } else if (isToday) {
            // Today + unclosed → the "do this now" cell. Brand-color outline
            // + tinted fill stands out among past-grey / future-faint.
            cellClass =
              "bg-[var(--color-brand)]/10 text-[var(--color-brand)] font-bold border-2 border-dashed border-[var(--color-brand)]/60";
          } else {
            // Past + unclosed → amber dashed outline, hints "should be done".
            cellClass =
              "bg-[var(--color-warning)]/5 text-[var(--color-warning)] border border-dashed border-[var(--color-warning)]/35 font-semibold";
          }
          // Today gets an extra ring so the eye finds it instantly.
          const ring = isToday ? "ring-2 ring-[var(--color-brand)]/40 ring-offset-1 ring-offset-[var(--color-bg)]" : "";
          // Today + unclosed is also clickable — same destination as the
          // hero CTA above. Past dates aren't clickable to keep the grid
          // glanceable rather than a navigation surface.
          const clickable = isToday && !isClosed;
          const cellBaseClass = `aspect-square rounded-md flex items-center justify-center ${cellClass} ${ring}`;
          if (clickable) {
            return (
              <button
                key={c.iso}
                onClick={jumpToDailyToday}
                aria-label="今日尚未結帳，前往每日結帳"
                className={`${cellBaseClass} cursor-pointer hover:bg-[var(--color-brand)]/15 transition-colors`}
              >
                {c.day}
              </button>
            );
          }
          return (
            <div key={c.iso} className={cellBaseClass}>
              {c.day}
            </div>
          );
        })}
      </div>

      {/* Legend — placed below the grid so first scan goes status → grid → key.
          5 states (was 3) — added 待結 + 今日 to disambiguate. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mt-3 pt-3 border-t border-[var(--color-brand)]/8 text-[10px] text-[var(--color-text-muted)]">
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-sm bg-[var(--color-success)]/30 border border-[var(--color-success)]" />
          已結帳
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-sm bg-[var(--color-warning)]/30 border border-[var(--color-warning)]" />
          有差異
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-sm border border-dashed border-[var(--color-warning)]/60" />
          待結
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-sm bg-[var(--color-brand)]/15 border-2 border-dashed border-[var(--color-brand)]/60" />
          今日
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-sm border border-[var(--color-text-disabled)]/30" />
          未來
        </span>
      </div>
    </MCard>
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
