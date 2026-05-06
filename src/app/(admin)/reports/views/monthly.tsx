"use client";

import { memo, useMemo } from "react";
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
            </MCard>
          </div>

          {/* V3.7 §E — Close-status month grid */}
          <CloseStatusGrid
            period={period}
            daysInMonth={range.daysInMonth}
            closedDates={closedDates}
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

          {/* ⑥ 服務組合 — V3.10 redesign：donut + 對比表（reference 業界 SaaS
               ：Phorest / GlossGenius / Fresha 都用相同 hero pattern） */}
          <SectionDivider number="02" title="服務組合佔營收" subtitle="各服務類別貢獻比例 + 客單均價 + vs 上月">
            <ServiceMixWidget
              pie={data.servicePie}
              prevPie={data.prevServicePie ?? []}
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
  剪: "#0F6E56", // brand 綠（最常被點選的服務）
  染: "#7E22CE", // 紫（化學服務）
  燙: "#BA7517", // 棕
  漂: "#A32D2D", // 紅（高難度）
  護: "#1D9E75", // 薄荷綠
};
const FALLBACK_COLOR = "#5B6770"; // 灰 — 「其他」未知類別

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
}: {
  pie: Array<{ category: string; count: number; revenue: number }>;
  /** Optional：舊 PWA / CDN cache 的 v1 response 沒這個欄位 */
  prevPie?: Array<{ category: string; count: number; revenue: number }>;
  chemicalShare: number;
  chemicalShareLast: number;
  totalRevenue: number;
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
    </MCard>
  );
});

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
