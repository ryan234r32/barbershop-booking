"use client";

import { useMemo } from "react";
import useSWR from "swr";
import { BarChart3, Coins } from "lucide-react";
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
  const { data, error, isLoading } = useSWR<MonthlyResponse>(
    `/api/reports/v3.6?view=monthly&period=${period}`,
    fetcher,
    { revalidateOnFocus: false },
  );

  // V3.7 §E — fetch expenses + day-close snapshots in parallel.
  const range = useMemo(() => monthRange(period), [period]);
  const { data: expensesData } = useSWR<{ totalAmount: number; expenses: Array<{ amount: number; type: "FIXED" | "VARIABLE" }> }>(
    `/api/expenses?from=${range.from}&to=${range.to}`,
    fetcher,
    { revalidateOnFocus: false },
  );
  const { data: closesData } = useSWR<{ snapshots: Array<{ date: string; netProfit: number; cashDiff: number; bankConfirmed: boolean }> }>(
    `/api/admin/day-close?from=${range.from}&to=${range.to}`,
    fetcher,
    { revalidateOnFocus: false },
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
    <div className="space-y-5">
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

          {/* V3.7 §E — 支出 / 淨利 / 結帳天數 row.
              `min-w-0` on each MCard so flex children can shrink instead of
              forcing horizontal overflow on narrow phones. Numbers use
              `whitespace-nowrap` to avoid mid-thousands wrapping; sublines wrap. */}
          <div className="grid grid-cols-3 gap-2">
            <MCard padding="md">
              <p className="text-[10px] tracking-wider text-[var(--color-text-muted)] uppercase">
                本月支出
              </p>
              <p className="text-base sm:text-xl font-bold tabular-nums text-[var(--color-danger)] mt-1 whitespace-nowrap">
                -{expenseTotal.toLocaleString()}
              </p>
              <p className="text-[10px] text-[var(--color-text-muted)] mt-1 tabular-nums leading-tight break-words">
                固定 {expenseFixed.toLocaleString()}
                <br />
                變動 {expenseVariable.toLocaleString()}
              </p>
            </MCard>
            <MCard padding="md">
              <p className="text-[10px] tracking-wider text-[var(--color-text-muted)] uppercase">
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
              <p className="text-[10px] text-[var(--color-text-muted)] mt-1 leading-tight">
                淨利率 {revenue > 0 ? (((revenue - expenseTotal) / revenue) * 100).toFixed(1) : "—"}%
              </p>
            </MCard>
            <MCard padding="md">
              <p className="text-[10px] tracking-wider text-[var(--color-text-muted)] uppercase">
                結帳天數
              </p>
              <p className="text-base sm:text-xl font-bold tabular-nums text-[var(--color-text-primary)] mt-1 whitespace-nowrap">
                {closedDates.size}
                <span className="text-sm font-normal text-[var(--color-text-muted)]">
                  /{range.daysInMonth}
                </span>
              </p>
              <p className="text-[10px] text-[var(--color-text-muted)] mt-1 leading-tight">
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

// ─── V3.7 §E — Close-status grid ────────────────────────────────────────

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

  return (
    <MCard padding="md">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-[var(--color-text-primary)]">
          結帳狀態
        </p>
        <div className="flex items-center gap-3 text-[10px] text-[var(--color-text-muted)]">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[var(--color-success)]" />
            已結帳
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[var(--color-warning)]" />
            有差異
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[var(--color-text-disabled)]/40" />
            未結
          </span>
        </div>
      </div>
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
          const bg = isFuture
            ? "bg-transparent text-[var(--color-text-disabled)]"
            : isClosed && hasDiff
              ? "bg-[var(--color-warning)]/15 text-[var(--color-warning)] font-semibold"
              : isClosed
                ? "bg-[var(--color-success)]/15 text-[var(--color-success)] font-semibold"
                : "bg-[var(--color-surface)] text-[var(--color-text-muted)]";
          const ring = isToday ? "ring-2 ring-[var(--color-brand)]/40" : "";
          return (
            <div
              key={c.iso}
              className={`aspect-square rounded-md flex items-center justify-center ${bg} ${ring}`}
            >
              {c.day}
            </div>
          );
        })}
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
