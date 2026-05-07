"use client";

import { memo, useMemo } from "react";
import useSWR from "swr";
import {
  BarChart3,
  CalendarPlus,
  Coins,
  MessageCircle,
  Repeat2,
  Scissors,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react";
import { adminHeaders } from "@/lib/auth/admin-fetch";
import { MCard } from "@/components/admin/reports/v3.6/m-card";
import { MTag } from "@/components/admin/reports/v3.6/m-tag";
import { DateStrip } from "@/components/admin/reports/v3.6/date-strip";
import { AlertBanner } from "@/components/admin/reports/v3.6/alert-banner";
import { Sparkline } from "@/components/admin/reports/v3.6/sparkline";
import { ProgressBar } from "@/components/admin/reports/v3.6/progress-bar";
import { RfmCards, RfmSummary } from "@/components/admin/reports/v3.6/rfm-card";
import { YoYBars } from "@/components/admin/reports/v3.6/yoy-bars";
import { SectionDivider } from "@/components/admin/reports/v3.6/section-divider";
import type {
  Alert,
  RfmGrid,
  YoYResult,
  MonthSpark,
  MonthlyTargetResult,
  PrebookRateResult,
  MonthlyDiagnostics,
} from "@/lib/reports/v3.6/aggregates";

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
  /** V3.10 — 上月 servicePie，用來算 per-category MoM。
   * Optional：舊 PWA SW 快取的 v1 API response 沒有這欄位，新 JS 讀它必須
   * 防禦（否則 `prevPie.reduce` undefined → 整個月報表白屏）。 */
  prevServicePie?: Array<{ category: string; count: number; revenue: number }>;
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
  /** Optional for backwards compatibility with cached PWA/API responses. */
  diagnostics?: MonthlyDiagnostics;
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

function buildFallbackDiagnostics(data: MonthlyResponse): MonthlyDiagnostics {
  const customerCount = data.rfm.total || data.totals.uniqueCustomers;
  const bookingCount = data.totals.bookings;
  const historyMonths = Math.max(1, data.sparkline.length);
  const medianGap = data.totals.medianGapDays || 0;
  const avgGap = data.totals.avgGapDays || 0;
  const intervalStatus = medianGap > 70 || avgGap > 90 ? "danger" : medianGap > 50 || avgGap > 70 ? "warning" : "ok";

  return {
    history: {
      fromIso: data.sparkline[0]?.month ? `${data.sparkline[0].month}-01` : null,
      toIso: data.range.toIso,
      monthCount: historyMonths,
      bookingCount,
      customerCount,
    },
    funnel: [
      { fromVisit: 1, toVisit: 2, fromCount: 0, toCount: 0, rate: data.retention.retention90Days },
      { fromVisit: 2, toVisit: 3, fromCount: 0, toCount: 0, rate: 0 },
      { fromVisit: 3, toVisit: 4, fromCount: 0, toCount: 0, rate: 0 },
      { fromVisit: 4, toVisit: 5, fromCount: 0, toCount: 0, rate: 0 },
    ],
    pareto: [
      { key: "top10", label: "前 10% 核心客", customerCount: Math.ceil(customerCount * 0.1), revenue: 0, revenueShare: 0 },
      { key: "top20", label: "前 20% 熟客主力", customerCount: Math.ceil(customerCount * 0.2), revenue: 0, revenueShare: 0 },
      { key: "rest80", label: "其餘客戶", customerCount: Math.max(0, customerCount - Math.ceil(customerCount * 0.2)), revenue: 0, revenueShare: 0 },
    ],
    intervals: [
      {
        category: "剪",
        medianDays: medianGap,
        avgDays: avgGap,
        targetDays: 50,
        targetLabel: "50天",
        sampleSize: data.totals.bookings,
        status: intervalStatus,
      },
      { category: "染", medianDays: 0, avgDays: 0, targetDays: 35, targetLabel: "35天", sampleSize: 0, status: "warning" },
      { category: "燙", medianDays: 0, avgDays: 0, targetDays: 120, targetLabel: "90-120天", sampleSize: 0, status: "warning" },
    ],
    fansAtRisk: [],
    sleepers: [],
    serviceLtv: {
      chemicalCustomers: 0,
      chemicalAvgSpend: 0,
      haircutOnlyCustomers: 0,
      haircutOnlyAvgSpend: 0,
      multiplier: null,
    },
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
  const diagnostics = data.diagnostics ?? buildFallbackDiagnostics(data);

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
          <AlertBanner alerts={data.alerts} />

          <MonthlyExecutiveSummary
            data={data}
            diagnostics={diagnostics}
            revenue={revenue}
            customers={customers}
            ticket={ticket}
          />

          <SignalGrid data={data} diagnostics={diagnostics} />

          <ComparisonTable data={data} />

          <MonthlyMoneyStrip
            revenue={revenue}
            expenseTotal={expenseTotal}
            expenseFixed={expenseFixed}
            expenseVariable={expenseVariable}
            closedCount={closedDates.size}
            daysInMonth={range.daysInMonth}
          />

          <CloseStatusGrid
            period={period}
            daysInMonth={range.daysInMonth}
            closedDates={closedDates}
          />

          <SectionDivider
            number="01"
            title="過去 12 個月 vs 去年同期"
            subtitle="用同一套歷史預約資料計算；不是手填示意數字"
          >
            <MCard padding="md">
              <YoYBars
                data={data.yoy}
                hasLastYearData={data.yoy.hasLastYearData}
                anchorYear={parseInt(period.slice(0, 4), 10)}
              />
            </MCard>
          </SectionDivider>

          <SectionDivider number="02" title="服務組合與升級機會" subtitle="染燙營收、單數佔比與客戶長期價值">
            <ServiceMixWidget
              pie={data.servicePie}
              prevPie={data.prevServicePie ?? []}
              chemicalShare={data.chemicalShare}
              chemicalShareLast={data.chemicalShareLastMonth}
              totalRevenue={revenue}
              serviceLtv={diagnostics.serviceLtv}
            />
          </SectionDivider>

          <SectionDivider number="03" title="回訪轉換漏斗" subtitle={`${diagnostics.history.monthCount} 個月歷史顧客的第 1 到第 5 次回訪`}>
            <FunnelWidget diagnostics={diagnostics} />
          </SectionDivider>

          <SectionDivider number="04" title="客戶集中度" subtitle="80/20 法則：先守住高價值熟客">
            <ParetoWidget diagnostics={diagnostics} />
          </SectionDivider>

          <SectionDivider number="05" title="回訪間隔" subtitle="剪 / 染 / 燙依歷史實際間隔計算">
            <ReturnIntervalsWidget diagnostics={diagnostics} />
          </SectionDivider>

          <SectionDivider number="06" title="本月待行動名單" subtitle="自動偵測鐵粉預警與沉睡客戶">
            <ActionCustomersWidget diagnostics={diagnostics} />
          </SectionDivider>

          <SectionDivider
            number="07"
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

          <NextActionsWidget data={data} diagnostics={diagnostics} />

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

function MonthlyExecutiveSummary({
  data,
  diagnostics,
  revenue,
  customers,
  ticket,
}: {
  data: MonthlyResponse;
  diagnostics: MonthlyDiagnostics;
  revenue: number;
  customers: number;
  ticket: number;
}) {
  const retentionDanger = data.retention.retention90Days < 40;
  const chemicalCountShare = serviceCountShare(data.servicePie, ["染", "燙", "漂"]);
  const headline = retentionDanger
    ? "新客第二次回訪，是本月最大破口"
    : data.momChangePct !== null && data.momChangePct < 0
      ? "營收回落，先看客量與染燙結構"
      : "本月體質穩定，下一步拉高回訪密度";

  return (
    <MCard padding="lg" className="overflow-hidden">
      <div className="flex flex-col gap-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <MTag tone="brand" size="sm">{data.range.label}月報</MTag>
              <MTag tone="info" size="sm">
                {diagnostics.history.monthCount} 個月 · {diagnostics.history.bookingCount.toLocaleString()} 筆歷史
              </MTag>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold leading-tight text-[var(--color-text-primary)]">
              {headline}
            </h2>
          </div>
        </div>

        <div className="rounded-lg bg-[var(--color-brand)] text-[var(--color-bg)] p-4">
          <p className="text-xs font-semibold opacity-70">本月總營收</p>
          <div className="flex items-end justify-between gap-3 mt-1">
            <p className="text-4xl font-bold tabular-nums leading-none whitespace-nowrap">
              {revenue.toLocaleString()}
            </p>
            <div className="flex flex-col items-end gap-1 text-xs">
              {data.momChangePct !== null && <DeltaPill value={data.momChangePct} label="上月" inverse />}
              {data.yoyChangePct !== null && <DeltaPill value={data.yoyChangePct} label="去年" inverse />}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <HeroMiniStat label="單數" value={data.totals.bookings.toLocaleString()} />
          <HeroMiniStat label="月活客戶" value={`${customers}`} suffix="人" />
          <HeroMiniStat label="客單價" value={ticket.toLocaleString()} />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <HeroMiniStat label="染燙營收佔比" value={`${data.chemicalShare.toFixed(1)}%`} tone={statusForChemical(data.chemicalShare)} />
          <HeroMiniStat label="染燙單數佔比" value={`${chemicalCountShare.toFixed(1)}%`} tone={chemicalCountShare >= 18 ? "ok" : chemicalCountShare >= 15 ? "warning" : "danger"} />
        </div>

        <div>
          <p className="text-xs font-semibold text-[var(--color-text-muted)] mb-1.5">過去 12 月走勢</p>
          <Sparkline points={data.sparkline.map((s) => ({
            label: s.label,
            value: s.revenue,
            isCurrent: s.isCurrent,
            isPeak: s.isPeak,
            isTrough: s.isTrough,
          }))} />
        </div>

        {data.target.targetRevenue !== null && (
          <div className="pt-4 border-t border-[var(--color-brand)]/8">
            <div className="flex items-baseline justify-between gap-3 mb-1.5">
              <p className="text-sm font-semibold text-[var(--color-text-primary)]">本月目標達成率</p>
              <p className="text-base font-bold tabular-nums text-[var(--color-brand)] whitespace-nowrap">
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

        <p
          className="text-sm text-[var(--color-text-body)] leading-relaxed pt-4 border-t border-[var(--color-brand)]/8"
          dangerouslySetInnerHTML={{ __html: renderMarkdownBold(data.summaryText) }}
        />
      </div>
    </MCard>
  );
}

function HeroMiniStat({
  label,
  value,
  suffix,
  tone = "neutral",
}: {
  label: string;
  value: string;
  suffix?: string;
  tone?: "ok" | "warning" | "danger" | "neutral";
}) {
  const toneClass = {
    ok: "text-[var(--color-success)]",
    warning: "text-[var(--color-warning)]",
    danger: "text-[var(--color-danger)]",
    neutral: "text-[var(--color-text-primary)]",
  }[tone];
  return (
    <div className="rounded-lg bg-[var(--color-surface)] px-3 py-2 min-w-0">
      <p className="text-xs font-semibold text-[var(--color-text-muted)]">{label}</p>
      <p className={`mt-1 text-xl font-bold tabular-nums leading-none whitespace-nowrap ${toneClass}`}>
        {value}
        {suffix && <span className="ml-0.5 text-xs font-medium text-[var(--color-text-muted)]">{suffix}</span>}
      </p>
    </div>
  );
}

function SignalGrid({ data, diagnostics }: { data: MonthlyResponse; diagnostics: MonthlyDiagnostics }) {
  const chemicalCountShare = serviceCountShare(data.servicePie, ["染", "燙", "漂"]);
  const fanCount = diagnostics.fansAtRisk.length;
  const signals = [
    {
      label: "離店再預約率",
      value: `${data.prebook.rate.toFixed(1)}%`,
      note: `${data.prebook.prebookCount}/${data.prebook.completedCount} 筆 · 目標 50%+`,
      status: statusForPrebook(data.prebook.rate),
      icon: CalendarPlus,
    },
    {
      label: "新客 90 天回訪",
      value: `${data.retention.retention90Days.toFixed(1)}%`,
      note: "低於 40% 就要補第二次預約腳本",
      status: statusForRetention(data.retention.retention90Days),
      icon: Repeat2,
    },
    {
      label: "染燙單數佔比",
      value: `${chemicalCountShare.toFixed(1)}%`,
      note: "看進門客人是否被升級",
      status: chemicalCountShare >= 18 ? "ok" : chemicalCountShare >= 15 ? "warning" : "danger",
      icon: Sparkles,
    },
    {
      label: "鐵粉預警",
      value: `${fanCount}`,
      note: "超過個人習慣間隔 1.5 倍",
      status: fanCount === 0 ? "ok" : fanCount <= 3 ? "warning" : "danger",
      icon: Users,
    },
  ] as const;

  return (
    <div className="grid grid-cols-2 gap-3">
      {signals.map((s) => {
        const Icon = s.icon;
        return (
          <MCard key={s.label} padding="md" leftBand={statusBand(s.status)}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-[var(--color-text-muted)]">{s.label}</p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-[var(--color-text-primary)] whitespace-nowrap">
                  {s.value}
                </p>
              </div>
              <Icon size={18} className="shrink-0 text-[var(--color-brand)]/70" aria-hidden />
            </div>
            <div className="mt-2 flex items-center justify-between gap-2">
              <StatusTag status={s.status} />
            </div>
            <p className="mt-2 text-[11px] leading-snug text-[var(--color-text-muted)]">{s.note}</p>
          </MCard>
        );
      })}
    </div>
  );
}

function ComparisonTable({ data }: { data: MonthlyResponse }) {
  const rows = [
    {
      label: "總營收",
      now: data.totals.revenue,
      prev: data.previousTotals.revenue,
      yoy: data.yoyChangePct,
      format: formatMoney,
    },
    {
      label: "總單數",
      now: data.totals.bookings,
      prev: data.previousTotals.bookings,
      format: (n: number) => n.toLocaleString(),
    },
    {
      label: "客單價",
      now: data.totals.arpu,
      prev: data.previousTotals.arpu,
      yoy: null,
      format: formatMoney,
    },
    {
      label: "月活客戶",
      now: data.totals.uniqueCustomers,
      prev: data.previousTotals.uniqueCustomers,
      yoy: null,
      format: (n: number) => n.toLocaleString(),
    },
    {
      label: "新客數",
      now: data.totals.newCustomers,
      prev: data.previousTotals.newCustomers,
      yoy: null,
      format: (n: number) => n.toLocaleString(),
    },
    {
      label: "染燙營收%",
      now: data.chemicalShare,
      prev: data.chemicalShareLastMonth,
      yoy: null,
      format: (n: number) => `${n.toFixed(1)}%`,
      deltaIsPp: true,
    },
  ];

  return (
    <MCard padding="md">
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <div>
          <h3 className="text-base font-bold text-[var(--color-text-primary)]">同期比較</h3>
          <p className="text-xs text-[var(--color-text-muted)]">本月、上月與去年同月的差異</p>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[360px] text-xs">
          <thead>
            <tr className="border-b border-[var(--color-brand)]/10 text-[var(--color-text-muted)]">
              <th className="py-2 text-left font-semibold">指標</th>
              <th className="py-2 text-right font-semibold">本月</th>
              <th className="py-2 text-right font-semibold">{data.previousLabel}</th>
              <th className="py-2 text-right font-semibold">變化</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const delta = r.prev > 0
                ? r.deltaIsPp
                  ? r.now - r.prev
                  : ((r.now - r.prev) / r.prev) * 100
                : null;
              return (
                <tr key={r.label} className="border-b border-[var(--color-brand)]/5 last:border-0">
                  <td className="py-2.5 font-semibold text-[var(--color-text-primary)] whitespace-nowrap">{r.label}</td>
                  <td className="py-2.5 text-right tabular-nums whitespace-nowrap">{r.format(r.now)}</td>
                  <td className="py-2.5 text-right tabular-nums text-[var(--color-text-muted)] whitespace-nowrap">{r.format(r.prev)}</td>
                  <td className="py-2.5 text-right tabular-nums whitespace-nowrap">
                    {delta === null ? "—" : <DeltaText value={delta} suffix={r.deltaIsPp ? "pp" : "%"} />}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </MCard>
  );
}

function MonthlyMoneyStrip({
  revenue,
  expenseTotal,
  expenseFixed,
  expenseVariable,
  closedCount,
  daysInMonth,
}: {
  revenue: number;
  expenseTotal: number;
  expenseFixed: number;
  expenseVariable: number;
  closedCount: number;
  daysInMonth: number;
}) {
  const profit = revenue - expenseTotal;
  return (
    <div className="grid grid-cols-3 gap-2">
      <MCard padding="md" className="min-w-0">
        <p className="text-xs font-semibold text-[var(--color-text-muted)]">本月支出</p>
        <p className="mt-1 text-base sm:text-xl font-bold tabular-nums text-[var(--color-danger)] whitespace-nowrap">
          -{expenseTotal.toLocaleString()}
        </p>
        <p className="mt-1 text-[11px] leading-tight text-[var(--color-text-muted)] tabular-nums">
          固定 {expenseFixed.toLocaleString()}
          <br />
          變動 {expenseVariable.toLocaleString()}
        </p>
      </MCard>
      <MCard padding="md" className="min-w-0">
        <p className="text-xs font-semibold text-[var(--color-text-muted)]">本月淨利</p>
        <p
          className="mt-1 text-base sm:text-xl font-bold tabular-nums whitespace-nowrap"
          style={{ color: profit >= 0 ? "var(--color-brand)" : "var(--color-danger)" }}
        >
          {profit.toLocaleString()}
        </p>
        <p className="mt-1 text-[11px] leading-tight text-[var(--color-text-muted)]">
          淨利率 {revenue > 0 ? ((profit / revenue) * 100).toFixed(1) : "—"}%
        </p>
      </MCard>
      <MCard padding="md" className="min-w-0">
        <p className="text-xs font-semibold text-[var(--color-text-muted)]">結帳天數</p>
        <p className="mt-1 text-base sm:text-xl font-bold tabular-nums text-[var(--color-text-primary)] whitespace-nowrap">
          {closedCount}
          <span className="text-sm font-normal text-[var(--color-text-muted)]">/{daysInMonth}</span>
        </p>
      </MCard>
    </div>
  );
}

function FunnelWidget({ diagnostics }: { diagnostics: MonthlyDiagnostics }) {
  const maxRate = Math.max(100, ...diagnostics.funnel.map((s) => s.rate));
  return (
    <MCard padding="md">
      <div className="flex items-start gap-3 rounded-lg bg-[var(--color-surface)] p-3 mb-4">
        <Repeat2 size={18} className="mt-0.5 shrink-0 text-[var(--color-brand)]" aria-hidden />
        <p className="text-sm leading-relaxed text-[var(--color-text-body)]">
          第二次回訪是關鍵。只要客人跨過第 2 次，後面的第 3、4、5 次通常會自然變穩。
        </p>
      </div>
      <div className="space-y-3">
        {diagnostics.funnel.map((step, idx) => {
          const danger = idx === 0 && step.rate < 45;
          const tone = danger ? "danger" : step.rate >= 70 ? "ok" : "warning";
          return (
            <div key={`${step.fromVisit}-${step.toVisit}`}>
              <div className="flex items-baseline justify-between gap-3 mb-1">
                <p className="text-sm font-bold text-[var(--color-text-primary)]">
                  第 {step.fromVisit} 次 <span className="text-[var(--color-text-muted)]">→</span> 第 {step.toVisit} 次
                  {danger && <span className="ml-2 text-[10px] font-bold text-[var(--color-danger)] whitespace-nowrap">最大破口</span>}
                </p>
                <p className="text-base font-bold tabular-nums whitespace-nowrap" style={{ color: statusBand(tone) }}>
                  {step.rate.toFixed(1)}%
                </p>
              </div>
              <div className="h-6 rounded-md bg-[var(--color-surface)] overflow-hidden">
                <div
                  className="h-full rounded-md flex items-center px-2 text-[11px] font-semibold tabular-nums text-[var(--color-bg)] whitespace-nowrap"
                  style={{
                    width: `${Math.max(8, (step.rate / maxRate) * 100)}%`,
                    background: statusBand(tone),
                  }}
                >
                  {step.toCount}/{step.fromCount}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-4 rounded-lg border-l-[3px] border-[var(--color-brand)] bg-[var(--color-brand)]/8 px-3 py-2 text-xs leading-relaxed text-[var(--color-text-body)]">
        每多救回 10 位新客的第二次回訪，後續通常會再沉澱成一批穩定熟客。下月策略應優先放在「第一次離店前先約下一次」。
      </p>
    </MCard>
  );
}

function ParetoWidget({ diagnostics }: { diagnostics: MonthlyDiagnostics }) {
  const top10 = diagnostics.pareto.find((p) => p.key === "top10");
  return (
    <MCard padding="md">
      <div className="mb-4">
        <p className="text-sm text-[var(--color-text-muted)]">歷史累計營收集中度</p>
        <h3 className="mt-1 text-xl font-bold leading-tight text-[var(--color-text-primary)]">
          {top10?.customerCount ?? 0} 位核心客戶，撐起 {top10?.revenueShare.toFixed(1) ?? "0.0"}% 營收
        </h3>
      </div>
      <div className="space-y-3">
        {diagnostics.pareto.map((tier) => (
          <div key={tier.key}>
            <div className="flex items-center justify-between gap-3 mb-1">
              <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                {tier.label}
                <span className="ml-1 text-xs font-normal text-[var(--color-text-muted)] whitespace-nowrap">
                  {tier.customerCount} 人
                </span>
              </p>
              <p className="text-base font-bold tabular-nums text-[var(--color-brand)] whitespace-nowrap">
                {tier.revenueShare.toFixed(1)}%
              </p>
            </div>
            <div className="h-2 rounded-full bg-[var(--color-surface)] overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.min(100, tier.revenueShare)}%`,
                  background: tier.key === "rest80" ? "var(--color-text-muted)" : "var(--color-brand)",
                  opacity: tier.key === "rest80" ? 0.45 : 0.9,
                }}
              />
            </div>
          </div>
        ))}
      </div>
      <p className="mt-4 rounded-lg bg-[var(--color-danger)]/8 border-l-[3px] border-[var(--color-danger)] px-3 py-2 text-xs leading-relaxed text-[var(--color-text-body)]">
        鐵粉預警不是 CRM 裝飾，是最高 ROI 的防守動作。失去一位高頻高消費客戶，通常要好幾位普通客才補得回來。
      </p>
    </MCard>
  );
}

function ReturnIntervalsWidget({ diagnostics }: { diagnostics: MonthlyDiagnostics }) {
  const iconByCat = {
    剪: Scissors,
    染: Sparkles,
    燙: Sparkles,
  } as const;
  return (
    <MCard padding="md">
      <div className="space-y-4">
        {diagnostics.intervals.map((item) => {
          const Icon = iconByCat[item.category];
          return (
            <div key={item.category} className="border-b border-[var(--color-brand)]/8 last:border-0 last:pb-0 pb-4">
              <div className="flex items-center justify-between gap-3 mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Icon size={17} className="shrink-0 text-[var(--color-brand)]" aria-hidden />
                  <p className="text-sm font-bold text-[var(--color-text-primary)]">{serviceFullName(item.category)}</p>
                  <StatusTag status={item.status} />
                </div>
                <p className="text-[11px] text-[var(--color-text-muted)] tabular-nums whitespace-nowrap">
                  n={item.sampleSize}
                </p>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <IntervalStat label="中位" value={item.medianDays ? `${item.medianDays}天` : "—"} tone={item.status} />
                <IntervalStat label="平均" value={item.avgDays ? `${item.avgDays}天` : "—"} tone={item.avgDays > item.targetDays * 1.5 ? "danger" : item.status} />
                <IntervalStat label="目標" value={item.targetLabel} tone="neutral" />
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-4 text-xs leading-relaxed text-[var(--color-text-muted)]">
        中位數用來看「典型客人」，平均數用來抓「有人拖很久才回來」的尾端風險。
      </p>
    </MCard>
  );
}

function IntervalStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "ok" | "warning" | "danger" | "neutral";
}) {
  const color = tone === "neutral" ? "var(--color-text-primary)" : statusBand(tone);
  return (
    <div className="rounded-lg bg-[var(--color-surface)] px-2 py-2 text-center min-w-0">
      <p className="text-[11px] font-semibold text-[var(--color-text-muted)]">{label}</p>
      <p className="mt-1 text-sm font-bold tabular-nums whitespace-nowrap" style={{ color }}>{value}</p>
    </div>
  );
}

function ActionCustomersWidget({ diagnostics }: { diagnostics: MonthlyDiagnostics }) {
  return (
    <div className="space-y-3">
      <MCard padding="md">
        <ActionListHeader
          title="鐵粉預警"
          count={diagnostics.fansAtRisk.length}
          note="超過個人習慣間隔 1.5 倍"
          tone="warning"
        />
        <CustomerActionRows rows={diagnostics.fansAtRisk} empty="目前沒有需要立即挽回的鐵粉。" primary />
      </MCard>

      <MCard padding="md">
        <ActionListHeader
          title="沉睡名單"
          count={diagnostics.sleepers.length}
          note="90-240 天未回訪且曾經回訪過"
          tone="default"
        />
        <CustomerActionRows rows={diagnostics.sleepers} empty="目前沒有符合條件的沉睡客戶。" />
      </MCard>
    </div>
  );
}

function ActionListHeader({
  title,
  count,
  note,
  tone,
}: {
  title: string;
  count: number;
  note: string;
  tone: "warning" | "default";
}) {
  return (
    <div className="flex items-start justify-between gap-3 mb-3">
      <div>
        <h3 className="text-base font-bold text-[var(--color-text-primary)]">{title}</h3>
        <p className="text-xs text-[var(--color-text-muted)]">{note}</p>
      </div>
      <MTag tone={tone === "warning" ? "warning" : "default"} size="sm">{count} 人</MTag>
    </div>
  );
}

function CustomerActionRows({
  rows,
  empty,
  primary = false,
}: {
  rows: MonthlyDiagnostics["fansAtRisk"];
  empty: string;
  primary?: boolean;
}) {
  if (rows.length === 0) {
    return <p className="rounded-lg bg-[var(--color-surface)] p-3 text-sm text-[var(--color-text-muted)]">{empty}</p>;
  }
  return (
    <div className="divide-y divide-[var(--color-brand)]/8">
      {rows.map((row) => (
        <div key={row.id} className="py-3 first:pt-0 last:pb-0 grid grid-cols-[34px_1fr_auto] items-center gap-3">
          <div
            className="w-[34px] h-[34px] rounded-full flex items-center justify-center text-sm font-bold"
            style={{
              background: primary ? "var(--color-danger)" : "var(--color-surface)",
              color: primary ? "var(--color-bg)" : "var(--color-brand)",
            }}
          >
            {row.initial}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-[var(--color-text-primary)] truncate">{row.displayName}</p>
            <p className="text-[11px] leading-snug text-[var(--color-text-muted)] tabular-nums">
              習慣 {row.expectedIntervalDays} 天回 · 已 {row.daysSinceVisit} 天未回 · 年消費 {row.annualSpend.toLocaleString()}
            </p>
          </div>
          <button className="inline-flex items-center gap-1 rounded-md bg-[var(--color-brand)] px-2.5 py-1.5 text-xs font-semibold text-[var(--color-bg)] whitespace-nowrap">
            <MessageCircle size={13} aria-hidden />
            LINE
          </button>
        </div>
      ))}
    </div>
  );
}

function NextActionsWidget({ data, diagnostics }: { data: MonthlyResponse; diagnostics: MonthlyDiagnostics }) {
  const fanCount = diagnostics.fansAtRisk.length;
  const firstFunnel = diagnostics.funnel[0];
  const hasChemicalGap = data.chemicalShare < 35;
  const actions = [
    {
      priority: 1,
      title: fanCount > 0 ? `立刻 LINE ${fanCount} 位鐵粉預警` : "本週檢查鐵粉名單",
      due: "本週",
      desc: fanCount > 0
        ? "先處理已超過個人習慣間隔的高價值客戶。這比群發折扣更精準。"
        : "目前沒有紅色鐵粉預警，但仍建議每週固定掃一次高價值客戶回訪狀態。",
      icon: MessageCircle,
      tone: "danger" as const,
    },
    {
      priority: 2,
      title: "啟動 Pre-book 結帳腳本",
      due: "下週起",
      desc: `目前第 1→2 次轉換 ${firstFunnel?.rate.toFixed(1) ?? "—"}%。離店前直接幫客人卡下一次，比事後召回更有效。`,
      icon: CalendarPlus,
      tone: "warning" as const,
    },
    {
      priority: 3,
      title: hasChemicalGap ? "設計染後補色 / 護髮回訪券" : "維持染燙升級節奏",
      due: "月底前",
      desc: hasChemicalGap
        ? `染燙營收佔比 ${data.chemicalShare.toFixed(1)}%，距 35% 健康線還有 ${(35 - data.chemicalShare).toFixed(1)}pp。`
        : "染燙佔比已接近健康線，接下來重點是穩定回訪而不是盲目折扣。",
      icon: Target,
      tone: "default" as const,
    },
  ];

  return (
    <MCard padding="lg" className="bg-[var(--color-brand)] text-[var(--color-bg)] border-[var(--color-brand)]">
      <div className="mb-4">
        <h3 className="text-xl font-bold">下月該做的 3 件事</h3>
        <p className="mt-1 text-sm opacity-70">按預估 ROI 排序</p>
      </div>
      <div className="space-y-3">
        {actions.map((action) => (
          <div key={action.priority} className="rounded-lg bg-[var(--color-bg)]/8 border border-[var(--color-bg)]/12 p-3">
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-full bg-[var(--color-bg)] text-[var(--color-brand)] flex items-center justify-center text-sm font-bold tabular-nums shrink-0">
                {action.priority}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold leading-snug">{action.title}</p>
              </div>
              <span className="rounded-md bg-[var(--color-bg)]/10 px-2 py-1 text-[10px] font-semibold opacity-80 whitespace-nowrap">
                {action.due}
              </span>
            </div>
            <p className="mt-2 pl-10 text-xs leading-relaxed opacity-75">{action.desc}</p>
          </div>
        ))}
      </div>
    </MCard>
  );
}

/**
 * V3.10 ServiceMix redesign — donut + comparison table.
 *
 * Reference (頂尖理髮 SaaS 怎麼呈現「服務組合佔營收」)：
 *   - Phorest / GlossGenius / Fresha：Hero donut + legend + detail table。
 *     重點：donut 是「比例」一眼看完，table 是 supporting metrics
 *     (revenue / 客單均價 / vs 上月 trend arrow)。
 *   - Square Appointments：類似 pattern，再加一個 "top services" list。
 *   - Stripe / Shopify Reports：mix breakdown 永遠是 donut + per-row
 *     comparison vs 上期，不是裸 bar list。
 *
 * 設計重點：
 *   1. Donut 為 hero — % 是主訊息（老闆 5 秒就能看完）。
 *   2. 每一服務固定顏色（穩定 mental model：染永遠是紫、燙永遠是棕）。
 *   3. Table 加客單均價 (avg ticket) + MoM trend — 之前完全沒有，
 *      只有「revenue + count」 → 老闆無法判斷哪個服務是「漲量」or「漲價」。
 *   4. 染燙 actionable banner 保留 — 還是最重要的一句話。
 */
const SERVICE_COLOR: Record<string, string> = {
  剪: "#003D2B",
  染: "#4A7C59",
  燙: "#C88B3B",
  漂: "#A84A3B",
  護: "#6B8F71",
};
const FALLBACK_COLOR = "#5B6770";

function colourFor(category: string): string {
  return SERVICE_COLOR[category] ?? FALLBACK_COLOR;
}

interface ServiceRow {
  category: string;
  revenue: number;
  count: number;
  share: number;       // % of total revenue this month
  avgTicket: number;   // revenue / count
  momPct: number | null;       // revenue MoM %
  momSharePp: number | null;   // 佔比 MoM (pp)
  colour: string;
}

const ServiceMixWidget = memo(function ServiceMixWidget({
  pie,
  prevPie,
  chemicalShare,
  chemicalShareLast,
  totalRevenue,
  serviceLtv,
}: {
  pie: Array<{ category: string; count: number; revenue: number }>;
  /** Optional：舊 PWA / CDN cache 的 v1 response 沒這個欄位 */
  prevPie?: Array<{ category: string; count: number; revenue: number }>;
  chemicalShare: number;
  chemicalShareLast: number;
  totalRevenue: number;
  serviceLtv: MonthlyDiagnostics["serviceLtv"];
}) {
  // V3.8 perf: useMemo so unrelated re-renders (expenses/closes useSWR
  // resolving at different ms) don't re-sort/re-reduce.
  const { rows, total, chemDelta, gapPp, monthlyChemRev, upliftRev, targetShare } = useMemo(() => {
    // 防禦：舊 cache 的 response 沒 prevPie → undefined。`?? []` 讓 reduce
    // 落在 0，per-category MoM 就會變 null（畫面顯示「—」），不會白屏。
    const safePie = pie ?? [];
    const safePrev = prevPie ?? [];
    const tShare = 35;
    const t = safePie.reduce((s, p) => s + p.revenue, 0) || 1;
    const prevT = safePrev.reduce((s, p) => s + p.revenue, 0) || 1;
    const prevByCat = new Map(safePrev.map((p) => [p.category, p]));
    const built: ServiceRow[] = [...safePie]
      .sort((a, b) => b.revenue - a.revenue)
      .map((s) => {
        const prev = prevByCat.get(s.category);
        const share = (s.revenue / t) * 100;
        const prevShare = prev ? (prev.revenue / prevT) * 100 : null;
        const momPct = prev && prev.revenue > 0
          ? Math.round(((s.revenue - prev.revenue) / prev.revenue) * 1000) / 10
          : null;
        const momSharePp = prevShare !== null
          ? Math.round((share - prevShare) * 10) / 10
          : null;
        return {
          category: s.category,
          revenue: s.revenue,
          count: s.count,
          share,
          avgTicket: s.count > 0 ? Math.round(s.revenue / s.count) : 0,
          momPct,
          momSharePp,
          colour: colourFor(s.category),
        };
      });
    const monthlyChem = (chemicalShare / 100) * totalRevenue;
    const targetRev = (tShare / 100) * totalRevenue;
    return {
      rows: built,
      total: t,
      chemDelta: chemicalShare - chemicalShareLast,
      gapPp: tShare - chemicalShare,
      monthlyChemRev: monthlyChem,
      upliftRev: Math.max(0, targetRev - monthlyChem),
      targetShare: tShare,
    };
  }, [pie, prevPie, chemicalShare, chemicalShareLast, totalRevenue]);

  if (rows.length === 0) {
    return (
      <MCard padding="md">
        <p className="text-sm text-[var(--color-text-muted)] text-center py-6">
          本月尚無服務紀錄
        </p>
      </MCard>
    );
  }

  return (
    <MCard padding="md">
      {/* Hero: Donut + legend + 染燙 share callout —— 一眼看完比例 */}
      <div className="flex flex-col sm:flex-row items-center gap-5 sm:gap-6">
        <ServiceDonut rows={rows} totalRevenue={total} />
        <ServiceLegend rows={rows} />
      </div>

      {/* Detail table — 每服務的營收 / 佔比 / 客單均價 / vs 上月
           設計 reference: Phorest「Service mix」報表 */}
      <div className="mt-5 pt-5 border-t border-[var(--color-brand)]/8 overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] border-b border-[var(--color-brand)]/10">
              <th className="text-left py-2 font-medium">服務</th>
              <th className="text-right py-2 font-medium">營收</th>
              <th className="text-right py-2 font-medium">佔比</th>
              <th className="text-right py-2 font-medium hidden sm:table-cell">客單均價</th>
              <th className="text-right py-2 font-medium hidden sm:table-cell">筆數</th>
              <th className="text-right py-2 font-medium">vs 上月</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.category} className="border-b border-[var(--color-brand)]/5">
                <td className="py-2.5">
                  <span className="inline-flex items-center gap-2">
                    <span
                      className="inline-block w-2.5 h-2.5 rounded-sm shrink-0"
                      style={{ background: r.colour }}
                      aria-hidden
                    />
                    <span className="font-semibold text-[var(--color-text-primary)]">{r.category}</span>
                  </span>
                </td>
                <td className="py-2.5 text-right tabular-nums">{r.revenue.toLocaleString()}</td>
                <td className="py-2.5 text-right tabular-nums font-semibold">{r.share.toFixed(1)}%</td>
                <td className="py-2.5 text-right tabular-nums hidden sm:table-cell text-[var(--color-text-body)]">
                  {r.avgTicket > 0 ? r.avgTicket.toLocaleString() : "—"}
                </td>
                <td className="py-2.5 text-right tabular-nums hidden sm:table-cell text-[var(--color-text-muted)]">{r.count}</td>
                <td className="py-2.5 text-right tabular-nums">
                  <MomCell pct={r.momPct} pp={r.momSharePp} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 染燙佔比 actionable banner — 保留原 V3.6 設計，這是最值錢的 insight */}
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

      <div className="mt-4 rounded-lg bg-[var(--color-surface)] p-3">
        <div className="flex items-center gap-2 mb-3">
          <Coins size={16} className="text-[var(--color-brand)]" aria-hidden />
          <p className="text-sm font-bold text-[var(--color-text-primary)]">染燙客 vs 純剪客長期價值</p>
        </div>
        <div className="space-y-2">
          <LtvBar
            label={`染燙客 (${serviceLtv.chemicalCustomers})`}
            value={serviceLtv.chemicalAvgSpend}
            max={Math.max(serviceLtv.chemicalAvgSpend, serviceLtv.haircutOnlyAvgSpend, 1)}
            accent="var(--color-brand)"
          />
          <LtvBar
            label={`純剪客 (${serviceLtv.haircutOnlyCustomers})`}
            value={serviceLtv.haircutOnlyAvgSpend}
            max={Math.max(serviceLtv.chemicalAvgSpend, serviceLtv.haircutOnlyAvgSpend, 1)}
            accent="var(--color-text-muted)"
          />
        </div>
        <p className="mt-3 text-xs leading-relaxed text-[var(--color-text-muted)]">
          {serviceLtv.multiplier
            ? `歷史實算：染燙客平均累計消費約為純剪客 ${serviceLtv.multiplier.toFixed(1)} 倍。`
            : "目前純剪客樣本不足，暫不計算倍數。"}
          下月行動不應只追新客，也要把高頻純剪熟客自然升級到染 / 護。
        </p>
      </div>
    </MCard>
  );
});

function LtvBar({
  label,
  value,
  max,
  accent,
}: {
  label: string;
  value: number;
  max: number;
  accent: string;
}) {
  return (
    <div className="grid grid-cols-[92px_1fr_auto] items-center gap-2 text-xs">
      <span className="font-semibold text-[var(--color-text-muted)] truncate">{label}</span>
      <div className="h-5 rounded-md bg-[var(--color-bg)] overflow-hidden">
        <div className="h-full rounded-md" style={{ width: `${Math.max(6, (value / max) * 100)}%`, background: accent }} />
      </div>
      <span className="font-bold tabular-nums text-[var(--color-text-primary)] whitespace-nowrap">
        {value.toLocaleString()}
      </span>
    </div>
  );
}

/**
 * SVG donut showing service share. Center label = top category + its share.
 * 用 stroke-dasharray 切片是業界常見做法（Phorest / GlossGenius / Recharts
 * 內部都用同樣手法），cumulative offset 把每個 segment 接在上一個結束的角度。
 */
function ServiceDonut({ rows, totalRevenue }: { rows: ServiceRow[]; totalRevenue: number }) {
  const SIZE = 144;
  const STROKE = 22;
  const R = (SIZE - STROKE) / 2;
  const C = 2 * Math.PI * R;
  const top = rows[0];

  // React Compiler doesn't allow render-time mutation, so pre-compute each
  // segment's dashoffset via a single reduce — same effect, immutable.
  const segments = rows.reduce<Array<{ category: string; colour: string; dash: number; offset: number }>>(
    (acc, r) => {
      const frac = totalRevenue > 0 ? r.revenue / totalRevenue : 0;
      const dash = frac * C;
      const prevTotal = acc.length > 0 ? acc[acc.length - 1].offset - acc[acc.length - 1].dash : 0;
      acc.push({ category: r.category, colour: r.colour, dash, offset: prevTotal });
      return acc;
    },
    [],
  );

  return (
    <div className="relative shrink-0" style={{ width: SIZE, height: SIZE }}>
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="-rotate-90">
        {/* Track */}
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={R}
          fill="none"
          stroke="var(--color-surface)"
          strokeWidth={STROKE}
        />
        {segments.map((seg) => (
          <circle
            key={seg.category}
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R}
            fill="none"
            stroke={seg.colour}
            strokeWidth={STROKE}
            strokeDasharray={`${seg.dash} ${C - seg.dash}`}
            strokeDashoffset={seg.offset}
            strokeLinecap="butt"
          />
        ))}
      </svg>
      {/* Center label — top category share is the headline */}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
        <p className="text-[10px] tracking-wider text-[var(--color-text-muted)] uppercase">主力</p>
        <p className="text-2xl font-bold tabular-nums text-[var(--color-text-primary)] leading-none mt-0.5">
          {top.share.toFixed(0)}%
        </p>
        <p className="text-xs text-[var(--color-text-body)] mt-1 font-semibold">{top.category}</p>
      </div>
    </div>
  );
}

function ServiceLegend({ rows }: { rows: ServiceRow[] }) {
  return (
    <ul className="flex-1 w-full grid grid-cols-2 sm:grid-cols-1 gap-x-3 gap-y-1.5 text-xs">
      {rows.map((r) => (
        <li key={r.category} className="flex items-center gap-2">
          <span
            className="inline-block w-2.5 h-2.5 rounded-sm shrink-0"
            style={{ background: r.colour }}
            aria-hidden
          />
          <span className="font-semibold text-[var(--color-text-primary)] w-6">{r.category}</span>
          <span className="flex-1 text-right tabular-nums text-[var(--color-text-muted)]">
            {r.share.toFixed(1)}%
          </span>
        </li>
      ))}
    </ul>
  );
}

/**
 * MoM cell — shows revenue % change with arrow + 佔比 pp delta below.
 * Renders "新出現" if last month had 0 of this category (no MoM math possible),
 * 「無變化」 if % is exactly 0, otherwise ↑/↓ arrow with colour.
 */
function MomCell({ pct, pp }: { pct: number | null; pp: number | null }) {
  if (pct === null) {
    return <span className="text-[10px] text-[var(--color-text-muted)]">新出現</span>;
  }
  const tone = pct > 0
    ? "text-[var(--color-success)]"
    : pct < 0
      ? "text-[var(--color-danger)]"
      : "text-[var(--color-text-muted)]";
  const arrow = pct > 0 ? "↑" : pct < 0 ? "↓" : "→";
  return (
    <span className={`inline-flex flex-col items-end ${tone}`}>
      <span className="font-semibold tabular-nums">
        {arrow} {Math.abs(pct).toFixed(0)}%
      </span>
      {pp !== null && pp !== 0 && (
        <span className="text-[10px] text-[var(--color-text-muted)] tabular-nums">
          {pp > 0 ? "+" : ""}
          {pp.toFixed(1)}pp 佔比
        </span>
      )}
    </span>
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

/**
 * V3.10 老闆 feedback 簡化：上一版 5 種狀態（已結 / 有差異 / 待結 / 今日 / 未來）
 * 老闆覺得太複雜，「只要區分『已結帳』和『還沒結帳』就好」。同時：
 *   - 過去 + 未結的日期要可以點 → 跳到該日結帳頁（不只今日才能點）
 *   - Legend 放在格子上方（首屏就看到顏色意義，不用滾到下面）
 *   - 顏色：綠 = 已結帳；中性灰底 = 未結（過去+今日都同色）；淡 = 未來
 *   - 今日仍保留一圈 brand ring 方便視覺定位（不算第三種「狀態」）
 */
function CloseStatusGrid({
  period,
  daysInMonth,
  closedDates,
}: {
  period: string;
  daysInMonth: number;
  closedDates: Set<string>;
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

  // Elapsed = past days + today (only count days that already happened).
  const elapsedDays = cells.reduce((n, c) => {
    if (!c) return n;
    return c.iso <= todayStr ? n + 1 : n;
  }, 0);
  const closedCount = closedDates.size;
  const pendingCount = Math.max(0, elapsedDays - closedCount);

  const jumpToDaily = (iso: string) => {
    // Absolute nav — page-level effect mirrors state to URL on mount, so a
    // hard navigate re-enters the report page on the daily tab for that date.
    window.location.assign(`/reports?view=daily&date=${iso}`);
  };

  return (
    <MCard padding="md">
      <div className="flex items-baseline justify-between mb-2 gap-2 flex-wrap">
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
              <span> / {elapsedDays} 天已結</span>
              {pendingCount > 0 && (
                <span className="text-[var(--color-text-muted)]">
                  {" "}
                  · {pendingCount} 天未結
                </span>
              )}
            </>
          )}
        </p>
      </div>

      {/* Legend — 放在格子上方，第一眼就讀到顏色意義。3 個 chip 對應 3 種視覺
          （已結 / 未結 / 未來）；功能上仍是「已結 / 未結」兩態。 */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mb-3 text-[11px] text-[var(--color-text-muted)]">
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-sm bg-[var(--color-success)]/30 border border-[var(--color-success)]" />
          已結帳
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-sm bg-[var(--color-surface)] border border-[var(--color-text-muted)]/30" />
          未結（點可前往該日結帳）
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-sm border border-[var(--color-text-disabled)]/30" />
          未來
        </span>
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
          const isFuture = c.iso > todayStr;
          const isToday = c.iso === todayStr;

          // 兩種功能態：已結（綠）/ 未結（中性）。未來日另外淡掉以免被當未結。
          let cellClass: string;
          if (isFuture) {
            cellClass = "bg-transparent text-[var(--color-text-disabled)]";
          } else if (isClosed) {
            cellClass =
              "bg-[var(--color-success)]/20 text-[var(--color-success)] font-bold";
          } else {
            cellClass =
              "bg-[var(--color-surface)] text-[var(--color-text-body)] font-semibold";
          }
          // 今日加一圈 ring，方便老闆一眼看到「我在哪」。
          const ring = isToday
            ? "ring-2 ring-[var(--color-brand)]/55 ring-offset-1 ring-offset-[var(--color-bg)]"
            : "";

          // 過去 + 今日 + 未結 都可點 → 直接跳該日結帳頁。未來不可點。
          const clickable = !isFuture && !isClosed;
          const cellBaseClass = `aspect-square rounded-md flex items-center justify-center ${cellClass} ${ring}`;
          if (clickable) {
            return (
              <button
                key={c.iso}
                onClick={() => jumpToDaily(c.iso)}
                aria-label={`${c.iso} 尚未結帳，前往該日結帳`}
                className={`${cellBaseClass} cursor-pointer hover:bg-[var(--color-brand)]/15 hover:text-[var(--color-brand)] transition-colors`}
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
    </MCard>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────

type HealthStatus = "ok" | "warning" | "danger";

function formatMoney(n: number): string {
  return n.toLocaleString();
}

function statusBand(status: HealthStatus): string {
  if (status === "ok") return "var(--color-success)";
  if (status === "warning") return "var(--color-warning)";
  return "var(--color-danger)";
}

function StatusTag({ status }: { status: HealthStatus }) {
  const label = status === "ok" ? "綠燈" : status === "warning" ? "黃燈" : "紅燈";
  return (
    <MTag tone={status === "ok" ? "success" : status === "warning" ? "warning" : "danger"}>
      {label}
    </MTag>
  );
}

function DeltaText({ value, suffix }: { value: number; suffix: string }) {
  const positive = value > 0;
  const neutral = value === 0;
  return (
    <span
      className={
        neutral
          ? "text-[var(--color-text-muted)]"
          : positive
            ? "text-[var(--color-success)]"
            : "text-[var(--color-danger)]"
      }
    >
      {positive ? "↑" : value < 0 ? "↓" : "→"} {Math.abs(value).toFixed(1)}
      {suffix}
    </span>
  );
}

function DeltaPill({
  value,
  label,
  inverse = false,
}: {
  value: number;
  label: string;
  inverse?: boolean;
}) {
  const Icon = value >= 0 ? TrendingUp : TrendingDown;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums whitespace-nowrap ${
        inverse
          ? "bg-[var(--color-bg)]/12 text-[var(--color-bg)]"
          : value >= 0
            ? "bg-[var(--color-success)]/15 text-[var(--color-success)]"
            : "bg-[var(--color-danger)]/12 text-[var(--color-danger)]"
      }`}
    >
      <Icon size={12} aria-hidden />
      {value >= 0 ? "+" : ""}
      {value.toFixed(1)}% vs {label}
    </span>
  );
}

function serviceCountShare(
  pie: Array<{ category: string; count: number }>,
  categories: string[],
): number {
  const total = pie.reduce((sum, p) => sum + p.count, 0);
  if (total === 0) return 0;
  const count = pie
    .filter((p) => categories.includes(p.category))
    .reduce((sum, p) => sum + p.count, 0);
  return Math.round((count / total) * 1000) / 10;
}

function serviceFullName(category: string): string {
  if (category === "剪") return "剪髮";
  if (category === "染") return "染髮";
  if (category === "燙") return "燙髮";
  return category;
}

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
