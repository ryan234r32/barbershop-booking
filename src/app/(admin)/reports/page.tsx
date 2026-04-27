"use client";

import { useState } from "react";
import useSWR from "swr";
import { usePageTitle } from "@/lib/hooks/use-page-title";
import { adminHeaders } from "@/lib/auth/admin-fetch";
import { WidgetSection } from "@/components/admin/reports/widget-section";
import {
  DiagnosisBanner,
  diagnoseOneTimerRate,
  diagnoseOccupancyRate,
  diagnoseRetention90,
  diagnoseGapDays,
} from "@/components/admin/reports/diagnosis-banner";
import { HeroEstimate } from "@/components/admin/reports/hero-estimate";
import { ShopSourceBar } from "@/components/admin/reports/shop-source-bar";
import { ServiceMixByCustomerWidget } from "@/components/admin/reports/service-mix-by-customer";

// ─── Types (match GET /api/reports response) ─────────────────────────────

type RangeType = "week" | "month" | "quarter" | "year";

interface Totals {
  bookings: number;
  revenue: number;
  uniqueCustomers: number;
  newCustomers: number;
  arpu: number;
  occupancyRate: number;
  cancellationRate: number;
  noShowRate: number;
  // V3.5 additions
  visitFrequency: number;
  oneTimerRate: number;
  avgGapDays: number;
  medianGapDays: number;
  shopNewCustomers: number;
  shopOldCustomers: number;
}

interface GlobalRetention {
  retention30Days: number;
  retention60Days: number;
  retention90Days: number;
}

interface TrendPoint {
  bucket: string;
  bookings: number;
  revenue: number;
  newCustomers: number;
}

interface ServicePieEntry {
  category: string;
  count: number;
  revenue: number;
}

interface TopServiceEntry {
  name: string;
  count: number;
  revenue: number;
  avg: number;
}

interface TopCustomerEntry {
  id: string;
  displayName: string | null;
  visitCount: number;
  totalSpend: number;
  lastVisit: string | null;
  segment: string;
}

interface SegmentEntry {
  segment: string;
  count: number;
  pct: number;
}

interface PaymentMixEntry {
  method: string;
  count: number;
  amount: number;
}

interface ServiceMixByCustomerEntry {
  category: string;
  newCount: number;
  returningCount: number;
}

interface ShopSourceQuarterEntry {
  label: string;
  fromIso: string;
  toIso: string;
  shopNew: number;
  shopOld: number;
}

interface ReportsResponse {
  range: { type: RangeType; offset: number; label: string; fromIso: string; toIso: string };
  previousLabel: string;
  totals: Totals;
  previousTotals: Totals;
  trend: TrendPoint[];
  servicePie: ServicePieEntry[];
  serviceMixByCustomer: ServiceMixByCustomerEntry[];
  shopSourceQuarters: ShopSourceQuarterEntry[];
  heatmap: { weekdays: string[]; hours: string[]; data: number[][] };
  topServices: TopServiceEntry[];
  topCustomers: TopCustomerEntry[];
  customerSegments: SegmentEntry[];
  paymentMix: PaymentMixEntry[];
  retention: GlobalRetention;
}

const fetcher = (url: string) =>
  fetch(url, { headers: adminHeaders() }).then((r) => {
    if (!r.ok) throw new Error(`${r.status}`);
    return r.json();
  });

const RANGE_LABELS: Record<RangeType, string> = {
  week: "週",
  month: "月",
  quarter: "季",
  year: "年",
};

const PAYMENT_LABELS: Record<string, string> = {
  CASH: "現金",
  BANK_TRANSFER: "轉帳",
  ECPAY_ATM: "ATM (綠界)",
};

// ─── Page ────────────────────────────────────────────────────────────────

// Localised labels for the prev/next button so user knows what they'll get.
const PREV_LABEL: Record<RangeType, string> = {
  week: "上一週",
  month: "上一月",
  quarter: "上一季",
  year: "上一年",
};
const NEXT_LABEL: Record<RangeType, string> = {
  week: "下一週",
  month: "下一月",
  quarter: "下一季",
  year: "下一年",
};

export default function ReportsPage() {
  usePageTitle("報表");
  const [range, setRange] = useState<RangeType>("year");
  // 預設 offset=-1（去年/上月/上季/上週），因為 2026 系統剛上線資料還少；
  // 2025 才是 Excel 匯入的歷史資料所在。切換 range 時保留 offset，
  // 不要 reset 成 0 — 不然點「年」會跳到 2026 空畫面，沒辦法回頭。
  const [offset, setOffset] = useState<number>(-1);

  const { data, error, isLoading } = useSWR<ReportsResponse>(
    `/api/reports?range=${range}&offset=${offset}`,
    fetcher,
    { revalidateOnFocus: false },
  );

  return (
    <main className="p-4 sm:p-6 max-w-5xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">營收報表</h1>

      {/* Range type tabs — 週 / 月 / 季 / 年 */}
      <div className="grid grid-cols-4 gap-1 p-1 bg-[var(--color-surface)] rounded-lg">
        {(["week", "month", "quarter", "year"] as const).map((r) => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={`py-2 text-sm rounded-md transition-colors ${
              range === r
                ? "bg-[var(--color-bg)] text-[var(--color-text-primary)] font-semibold shadow-sm"
                : "text-[var(--color-text-muted)]"
            }`}
          >
            {RANGE_LABELS[r]}
          </button>
        ))}
      </div>

      {/* Period nav — explicit 上/下 一週/月/季/年 buttons + current label */}
      <div className="flex items-stretch gap-2">
        <button
          onClick={() => setOffset((o) => o - 1)}
          className="shrink-0 px-3 sm:px-4 py-2 rounded-lg bg-[var(--color-surface)] text-[var(--color-text-primary)] text-sm font-medium hover:bg-[var(--color-text-muted)]/10 transition-colors flex items-center gap-1"
        >
          <span>←</span>
          <span className="hidden sm:inline">{PREV_LABEL[range]}</span>
        </button>

        <div className="flex-1 min-w-0 text-center bg-[var(--color-bg)] border border-[var(--color-text-muted)]/15 rounded-lg px-2 py-2">
          <div className="text-sm font-bold text-[var(--color-text-primary)] truncate">
            {data?.range.label ?? "載入中"}
          </div>
          {data && (
            <div className="text-[10px] text-[var(--color-text-muted)] tabular-nums truncate">
              {data.range.fromIso} ~ {data.range.toIso}
            </div>
          )}
        </div>

        <button
          onClick={() => setOffset((o) => o + 1)}
          disabled={offset >= 0}
          className="shrink-0 px-3 sm:px-4 py-2 rounded-lg bg-[var(--color-surface)] text-[var(--color-text-primary)] text-sm font-medium hover:bg-[var(--color-text-muted)]/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
        >
          <span className="hidden sm:inline">{NEXT_LABEL[range]}</span>
          <span>→</span>
        </button>
      </div>

      {/* Quick "回到本期" link — only when offset != 0 */}
      {offset !== 0 && (
        <div className="text-right -mt-2">
          <button
            onClick={() => setOffset(0)}
            className="text-xs text-[var(--color-brand)] hover:underline"
          >
            回到本{RANGE_LABELS[range]}
          </button>
        </div>
      )}

      {isLoading && (
        <div className="animate-pulse space-y-4">
          <div className="h-32 bg-[var(--color-surface)] rounded-2xl" />
          <div className="h-64 bg-[var(--color-surface)] rounded-2xl" />
          <div className="h-48 bg-[var(--color-surface)] rounded-2xl" />
        </div>
      )}

      {error && (
        <div className="bg-[var(--color-danger)]/10 rounded-xl p-5 text-sm text-[var(--color-danger)]">
          報表資料載入失敗：{String(error)}
        </div>
      )}

      {data && !isLoading && <ReportsContent data={data} />}
    </main>
  );
}

function ReportsContent({ data }: { data: ReportsResponse }) {
  const empty = data.totals.bookings === 0;

  if (empty) {
    return (
      <div className="bg-[var(--color-surface)] rounded-2xl p-12 text-center text-sm text-[var(--color-text-muted)] space-y-2">
        <div className="text-3xl opacity-40">📊</div>
        <p>{data.range.label}沒有預約紀錄</p>
        <p className="text-xs">切換到「{data.previousLabel}」或更長的時間範圍試試</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Hero estimate — V3.5 wow moment, sits above everything else */}
      <HeroEstimate
        revenue={data.totals.revenue}
        oneTimerRate={data.totals.oneTimerRate}
        occupancyRate={data.totals.occupancyRate}
        rangeLabel={data.range.label}
      />

      {/* KPI strip — primary big-number + secondary context. `primary` =
          "NT$135萬" headline, `secondary` = "1,348,900 元" full precision.
          Stops 7-figure revenue clip + adds inline benchmark hint to 佔用率. */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          label="營收"
          primary={formatRevenuePrimary(data.totals.revenue)}
          secondary={`${data.totals.revenue.toLocaleString()} 元`}
          prevValue={data.previousTotals.revenue}
          curValue={data.totals.revenue}
          previousLabel={data.previousLabel}
          tone="brand"
        />
        <KpiCard
          label="客戶"
          primary={data.totals.uniqueCustomers.toLocaleString()}
          secondary={`新客 ${data.totals.newCustomers}`}
          prevValue={data.previousTotals.uniqueCustomers}
          curValue={data.totals.uniqueCustomers}
          previousLabel={data.previousLabel}
        />
        <KpiCard
          label="客單價"
          primary={`NT$${data.totals.arpu.toLocaleString()}`}
          secondary={`年訪 ${data.totals.visitFrequency} 次/人`}
          prevValue={data.previousTotals.arpu}
          curValue={data.totals.arpu}
          previousLabel={data.previousLabel}
        />
        <KpiCard
          label="佔用率"
          primary={`${data.totals.occupancyRate}%`}
          secondary={data.totals.occupancyRate < 75 ? "業界健康 75%+" : "🟢 達標"}
          prevValue={data.previousTotals.occupancyRate}
          curValue={data.totals.occupancyRate}
          previousLabel={data.previousLabel}
          tone="success"
        />
      </div>

      {/* Secondary ratios */}
      <div className="grid grid-cols-3 gap-3 text-xs">
        <SecondaryStat label="預約數" value={data.totals.bookings.toLocaleString()} />
        <SecondaryStat label="取消率" value={`${data.totals.cancellationRate}%`} />
        <SecondaryStat label="No-show 率" value={`${data.totals.noShowRate}%`} />
      </div>

      {/* ── 客戶診斷 — V3.5 hero diagnosis section ─────────────────────── */}
      <WidgetSection
        title="客戶診斷"
        subtitle="把客戶結構攤開，找出最大的營收 leverage"
      >
        <DiagnosisBanner diagnosis={diagnoseOneTimerRate(data.totals.oneTimerRate)} />
        <DiagnosisBanner diagnosis={diagnoseRetention90(data.retention.retention90Days)} />
        <DiagnosisBanner diagnosis={diagnoseGapDays(data.totals.medianGapDays)} />
        <DiagnosisBanner diagnosis={diagnoseOccupancyRate(data.totals.occupancyRate)} />
      </WidgetSection>

      {/* ── 客戶來源 ─ shop-source split per quarter ───────────────────── */}
      <WidgetSection
        title="客戶來源"
        subtitle="近 4 季新進客戶（新店面客 vs 從舊店搬過來）"
      >
        <ShopSourceBar quarters={data.shopSourceQuarters} />
      </WidgetSection>

      {/* ── 客戶活躍度 ─ existing segment donut ────────────────────────── */}
      <WidgetSection title="客戶活躍度" subtitle="按頻率 + 最近到訪分層">
        <CustomerSegmentWidget segments={data.customerSegments} />
      </WidgetSection>

      {/* ── 服務組合 ─ split 新熟 + Top services table ─────────────────── */}
      <WidgetSection title="服務組合" subtitle="同時看「服務在誰身上」+「Top 排行」">
        <ServiceMixByCustomerWidget mix={data.serviceMixByCustomer} />
        <TopServicesWidget services={data.topServices} />
      </WidgetSection>

      {/* ── 時段 ─ 趨勢 + 熱力圖 ───────────────────────────────────────── */}
      <WidgetSection title="時段（產能利用）" subtitle="哪些時段空著沒填，哪些天最忙">
        <TrendWidget trend={data.trend} rangeType={data.range.type} />
        <HeatmapWidget heatmap={data.heatmap} />
      </WidgetSection>

      {/* ── VIP Top 20 ─────────────────────────────────────────────────── */}
      <WidgetSection title="VIP 客戶" subtitle="按本期消費總額排序">
        <TopCustomersWidget customers={data.topCustomers} />
      </WidgetSection>

      {/* ── 收款方式 ────────────────────────────────────────────────────── */}
      <WidgetSection title="收款方式" subtitle="本期已收款分布">
        <PaymentMixWidget mix={data.paymentMix} />
      </WidgetSection>
    </div>
  );
}

// ─── Widgets ─────────────────────────────────────────────────────────────

/** Compact revenue formatter. NT$1,348,900 → "NT$135萬"; smaller falls back. */
function formatRevenuePrimary(rev: number): string {
  if (rev >= 10000) return `NT$${Math.round(rev / 10000).toLocaleString()}萬`;
  return `NT$${rev.toLocaleString()}`;
}

function KpiCard({
  label,
  primary,
  secondary,
  prevValue,
  curValue,
  previousLabel,
  tone = "default",
}: {
  label: string;
  primary: string;
  secondary?: string;
  prevValue: number;
  curValue: number;
  previousLabel: string;
  tone?: "default" | "brand" | "success";
}) {
  const delta = prevValue === 0 ? null : ((curValue - prevValue) / prevValue) * 100;
  const deltaClass =
    delta == null
      ? "text-[var(--color-text-muted)]"
      : delta > 0
        ? "text-[var(--color-success)]"
        : delta < 0
          ? "text-[var(--color-danger)]"
          : "text-[var(--color-text-muted)]";
  const valueClass =
    tone === "brand"
      ? "text-[var(--color-brand)]"
      : tone === "success"
        ? "text-[var(--color-success)]"
        : "text-[var(--color-text-primary)]";

  return (
    <div className="bg-[var(--color-surface)] rounded-2xl p-4 min-w-0">
      <p className="text-[10px] tracking-wider text-[var(--color-text-muted)] uppercase whitespace-nowrap">
        {label}
      </p>
      <p className={`text-2xl font-bold mt-1 truncate tabular-nums ${valueClass}`}>
        {primary}
      </p>
      {secondary && (
        <p className="text-[11px] text-[var(--color-text-muted)] tabular-nums truncate mt-0.5">
          {secondary}
        </p>
      )}
      {delta != null && (
        <p className={`text-[11px] mt-0.5 tabular-nums ${deltaClass}`}>
          {delta > 0 ? "↑" : delta < 0 ? "↓" : "—"} {Math.abs(delta).toFixed(1)}% vs {previousLabel}
        </p>
      )}
    </div>
  );
}

function SecondaryStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-[var(--color-surface)]/60 rounded-lg p-2.5 text-center">
      <p className="text-[10px] text-[var(--color-text-muted)]">{label}</p>
      <p className="text-base font-semibold text-[var(--color-text-body)] mt-0.5 tabular-nums">{value}</p>
    </div>
  );
}

function TrendWidget({ trend, rangeType }: { trend: TrendPoint[]; rangeType: RangeType }) {
  if (trend.length === 0) return null;
  const max = Math.max(...trend.map((p) => p.revenue), 1);
  const titleSuffix =
    rangeType === "week" ? "（每日）" :
    rangeType === "month" ? "（每週）" :
    rangeType === "quarter" ? "（每月）" :
    "（每月）";
  return (
    <div className="bg-[var(--color-surface)] rounded-2xl p-5">
      <h2 className="text-sm font-bold text-[var(--color-text-primary)] mb-4">
        營收趨勢{titleSuffix}
      </h2>
      <div className="space-y-2">
        {trend.map((p) => (
          <div key={p.bucket} className="flex items-center gap-2">
            <span className="text-xs text-[var(--color-text-muted)] w-14 shrink-0 font-mono">
              {p.bucket}
            </span>
            <div className="flex-1 bg-[var(--color-bg)] rounded h-6 relative overflow-hidden">
              <div
                className="h-full bg-[var(--color-brand)]/80 rounded transition-all"
                style={{ width: `${(p.revenue / max) * 100}%` }}
              />
              <span className="absolute inset-0 flex items-center justify-end pr-2 text-[11px] font-semibold text-[var(--color-text-primary)] tabular-nums">
                NT${p.revenue.toLocaleString()} ({p.bookings})
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const SEGMENT_COLOR: Record<string, string> = {
  NEW: "var(--color-brand)",
  REGULAR: "var(--color-service-color)",
  VIP: "var(--color-warning)",
  AT_RISK: "var(--color-service-perm)",
  LAPSED: "var(--color-text-muted)",
  BLACKLISTED: "var(--color-danger)",
};
const SEGMENT_LABEL: Record<string, string> = {
  NEW: "新客 (1 次)",
  REGULAR: "常客 (2-4 次)",
  VIP: "VIP (5+ 次)",
  AT_RISK: "流失中 (60+ 天)",
  LAPSED: "已流失 (180+ 天)",
  BLACKLISTED: "黑名單",
};

function CustomerSegmentWidget({ segments }: { segments: SegmentEntry[] }) {
  if (segments.length === 0) return null;
  const total = segments.reduce((s, x) => s + x.count, 0);
  if (total === 0) return null;

  const visible = segments.filter((s) => s.count > 0);
  const stops = visible
    .reduce<{ list: string[]; acc: number }>(
      (memo, s) => {
        const start = memo.acc;
        const next = memo.acc + s.pct;
        memo.list.push(`${SEGMENT_COLOR[s.segment] ?? "#999"} ${start}% ${next}%`);
        return { list: memo.list, acc: next };
      },
      { list: [], acc: 0 },
    )
    .list.join(", ");

  const lapsedTotal =
    (segments.find((s) => s.segment === "AT_RISK")?.count ?? 0) +
    (segments.find((s) => s.segment === "LAPSED")?.count ?? 0);

  return (
    <div className="bg-[var(--color-surface)] rounded-2xl p-5">
      <h2 className="text-sm font-bold text-[var(--color-text-primary)] mb-1">客戶分層</h2>
      <p className="text-xs text-[var(--color-text-muted)] mb-4">
        全店客戶分層（依訪問頻次 + 最後到訪時間）
      </p>
      <div className="flex items-center gap-5 flex-wrap">
        <div className="relative w-32 h-32 shrink-0">
          <div
            className="w-full h-full rounded-full"
            style={{ background: `conic-gradient(${stops})` }}
          />
          <div className="absolute inset-3 rounded-full bg-[var(--color-surface)] flex items-center justify-center flex-col">
            <span className="text-lg font-bold text-[var(--color-text-primary)] leading-none">
              {total}
            </span>
            <span className="text-[10px] text-[var(--color-text-muted)] mt-0.5">總客戶</span>
          </div>
        </div>
        <div className="flex-1 min-w-[200px] space-y-1.5">
          {segments.map((s) => (
            <div key={s.segment} className="flex items-center text-xs">
              <span
                className="inline-block w-3 h-3 rounded-sm mr-2 shrink-0"
                style={{ background: SEGMENT_COLOR[s.segment] ?? "#999" }}
              />
              <span className="flex-1 text-[var(--color-text-body)]">
                {SEGMENT_LABEL[s.segment] ?? s.segment}
              </span>
              <span className="font-mono text-[var(--color-text-primary)] w-10 text-right">
                {s.count}
              </span>
              <span className="font-mono text-[var(--color-text-muted)] w-12 text-right">
                {s.pct}%
              </span>
            </div>
          ))}
        </div>
      </div>
      {lapsedTotal > 0 && (
        <p className="text-[11px] text-[var(--color-text-muted)] mt-4">
          💡 流失中 + 已流失 = {lapsedTotal} 位 — 行銷喚回的最大池子
        </p>
      )}
    </div>
  );
}

function HeatmapWidget({ heatmap }: { heatmap: ReportsResponse["heatmap"] }) {
  const max = Math.max(...heatmap.data.flat(), 1);
  return (
    <div className="bg-[var(--color-surface)] rounded-2xl p-5">
      <h2 className="text-sm font-bold text-[var(--color-text-primary)] mb-4">時段熱力圖（一週 × 整點）</h2>
      <div className="overflow-x-auto">
        <table className="text-[10px] tabular-nums">
          <thead>
            <tr>
              <th className="px-1 py-1"></th>
              {heatmap.hours.map((h) => (
                <th key={h} className="px-2 py-1 text-[var(--color-text-muted)] font-mono font-normal">{h}</th>
              ))}
              <th className="px-2 py-1 text-[var(--color-text-muted)] font-mono font-normal">合計</th>
            </tr>
          </thead>
          <tbody>
            {heatmap.weekdays.map((wd, wi) => {
              const rowSum = heatmap.data[wi].reduce((s, n) => s + n, 0);
              return (
                <tr key={wd}>
                  <td className="px-1 py-1 font-semibold text-[var(--color-text-primary)] pr-3">{wd}</td>
                  {heatmap.data[wi].map((n, hi) => {
                    const intensity = n / max;
                    return (
                      <td
                        key={hi}
                        className="px-2 py-2 text-center font-mono"
                        style={{
                          backgroundColor: n > 0 ? `rgba(0, 61, 43, ${0.1 + intensity * 0.6})` : undefined,
                          color: intensity > 0.5 ? "white" : undefined,
                        }}
                      >
                        {n || ""}
                      </td>
                    );
                  })}
                  <td className="px-2 py-1 font-semibold text-[var(--color-text-body)] pl-3">{rowSum}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-[var(--color-text-muted)] mt-3">
        顏色越深 = 越熱門。週一公休空白；週四下午 / 週六全天最忙
      </p>
    </div>
  );
}

function TopCustomersWidget({ customers }: { customers: TopCustomerEntry[] }) {
  if (customers.length === 0) return null;
  return (
    <div className="bg-[var(--color-surface)] rounded-2xl p-5">
      <h2 className="text-sm font-bold text-[var(--color-text-primary)] mb-4">VIP 客戶 Top {customers.length}</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[10px] tracking-wider text-[var(--color-text-muted)] uppercase border-b border-[var(--color-bg)]">
              <th className="text-left py-2">客戶</th>
              <th className="text-center py-2">分層</th>
              <th className="text-right py-2">訪問</th>
              <th className="text-right py-2">總消費</th>
              <th className="text-right py-2">最後到訪</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((c) => (
              <tr key={c.id} className="border-b border-[var(--color-bg)]/50">
                <td className="py-2 text-[var(--color-text-primary)]">{c.displayName ?? "—"}</td>
                <td className="py-2 text-center text-[10px] text-[var(--color-text-muted)]">{c.segment}</td>
                <td className="py-2 text-right tabular-nums">{c.visitCount}</td>
                <td className="py-2 text-right tabular-nums text-[var(--color-text-body)]">NT${c.totalSpend.toLocaleString()}</td>
                <td className="py-2 text-right text-[var(--color-text-muted)] tabular-nums text-xs">{c.lastVisit ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TopServicesWidget({ services }: { services: TopServiceEntry[] }) {
  if (services.length === 0) return null;
  return (
    <div className="bg-[var(--color-surface)] rounded-2xl p-5">
      <h2 className="text-sm font-bold text-[var(--color-text-primary)] mb-4">服務 Top {services.length}（按筆數）</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[10px] tracking-wider text-[var(--color-text-muted)] uppercase border-b border-[var(--color-bg)]">
              <th className="text-left py-2">服務</th>
              <th className="text-right py-2">筆數</th>
              <th className="text-right py-2">營收</th>
              <th className="text-right py-2">客單價</th>
            </tr>
          </thead>
          <tbody>
            {services.map((s) => (
              <tr key={s.name} className="border-b border-[var(--color-bg)]/50">
                <td className="py-2 text-[var(--color-text-primary)]">{s.name}</td>
                <td className="py-2 text-right tabular-nums">{s.count}</td>
                <td className="py-2 text-right tabular-nums text-[var(--color-text-body)]">NT${s.revenue.toLocaleString()}</td>
                <td className="py-2 text-right tabular-nums text-[var(--color-text-muted)]">NT${s.avg}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PaymentMixWidget({ mix }: { mix: PaymentMixEntry[] }) {
  if (mix.length === 0) return null;
  const total = mix.reduce((s, p) => s + p.amount, 0);
  return (
    <div className="bg-[var(--color-surface)] rounded-2xl p-5">
      <h2 className="text-sm font-bold text-[var(--color-text-primary)] mb-1">收款方式</h2>
      <p className="text-xs text-[var(--color-text-muted)] mb-4">
        本期已收款分布（總計 NT${total.toLocaleString()}）
      </p>
      <div className="space-y-2">
        {mix.map((p) => {
          const pct = total > 0 ? (p.amount / total) * 100 : 0;
          return (
            <div key={p.method} className="flex items-center gap-3">
              <span className="text-sm font-semibold w-20 shrink-0 text-[var(--color-text-primary)]">
                {PAYMENT_LABELS[p.method] ?? p.method}
              </span>
              <div className="flex-1 bg-[var(--color-bg)] rounded h-5 overflow-hidden">
                <div
                  className="h-full bg-[var(--color-brand)]/70 rounded"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-xs text-[var(--color-text-body)] w-32 text-right tabular-nums">
                {p.count} 筆 · NT${p.amount.toLocaleString()}
              </span>
              <span className="text-xs text-[var(--color-text-muted)] w-12 text-right tabular-nums">
                {pct.toFixed(1)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
