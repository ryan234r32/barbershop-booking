"use client";

import useSWR from "swr";
import { usePageTitle } from "@/lib/hooks/use-page-title";
import { adminHeaders } from "@/lib/auth/admin-fetch";

interface MonthlyRevenue {
  month: string;
  count: number;
  revenue: number;
  newCustomers: number;
}

interface ServicePie {
  category: string;
  count: number;
  revenue: number;
}

interface TopService {
  name: string;
  count: number;
  revenue: number;
  avg: number;
}

interface CustomerSegment {
  segment: "NEW" | "REGULAR" | "VIP" | "AT_RISK" | "LAPSED";
  count: number;
  pct: number;
}

interface ArpuPoint {
  month: string;
  activeCustomers: number;
  avgPerCustomer: number;
  avgPerBooking: number;
}

interface CohortPoint {
  cohortMonth: string;
  size: number;
  returned30: number;
  returned60: number;
  returned90: number;
}

interface LapsedPoint {
  month: string;
  active: number;
  lapsed: number;
}

interface ReportsSnapshot {
  generatedAt: string;
  source: string;
  period: { from: string; to: string };
  totals: {
    bookings: number;
    revenue: number;
    uniqueCustomers: number;
    repeatCustomers: number;
    newCustomers: number;
    repeatRate: number;
  };
  monthlyRevenue: MonthlyRevenue[];
  servicePie: ServicePie[];
  heatmap: { weekdays: string[]; hours: string[]; data: number[][] };
  topServices: TopService[];
  customerSegments?: CustomerSegment[];
  arpuTrend?: ArpuPoint[];
  cohorts?: CohortPoint[];
  lapsedTrend?: LapsedPoint[];
}

const fetcher = (url: string) =>
  fetch(url, { headers: adminHeaders() }).then((r) => {
    if (!r.ok) throw new Error(`${r.status}`);
    return r.json();
  });

const SERVICE_COLORS: Record<string, string> = {
  剪: "bg-[var(--color-brand)]",
  燙: "bg-orange-400",
  染: "bg-purple-400",
  漂: "bg-[var(--color-warning)]",
  護: "bg-[var(--color-success)]",
  洗: "bg-cyan-400",
  其他: "bg-[var(--color-text-muted)]",
};

export default function ReportsPage() {
  usePageTitle("報表");
  const { data, error, isLoading } = useSWR<ReportsSnapshot>("/api/reports", fetcher, {
    revalidateOnFocus: false,
  });

  if (isLoading) {
    return (
      <main className="p-6 max-w-5xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-32 bg-[var(--color-surface)] rounded-2xl" />
          <div className="h-64 bg-[var(--color-surface)] rounded-2xl" />
          <div className="h-48 bg-[var(--color-surface)] rounded-2xl" />
        </div>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="p-6 max-w-2xl mx-auto">
        <div className="bg-[var(--color-danger)]/10 rounded-xl p-5 text-sm text-[var(--color-danger)]">
          報表資料載入失敗。請執行 <code className="bg-[var(--color-bg)] px-1.5 py-0.5 rounded">npm run reports:snapshot</code> 產生快照。
        </div>
      </main>
    );
  }

  const maxMonthRevenue = Math.max(...data.monthlyRevenue.map((m) => m.revenue), 1);
  const totalServiceCount = data.servicePie.reduce((s, p) => s + p.count, 0);
  const maxHeatmapValue = Math.max(...data.heatmap.data.flat(), 1);

  return (
    <main className="p-4 sm:p-6 max-w-5xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-baseline gap-3">
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">2025 年度報表</h1>
        <span className="text-[10px] font-semibold tracking-wider px-2 py-0.5 rounded bg-[var(--color-brand)]/15 text-[var(--color-brand)]">
          BETA · 歷史資料
        </span>
      </div>
      <p className="text-xs text-[var(--color-text-muted)] -mt-2">
        資料來源：{data.source} · 快照產生於 {new Date(data.generatedAt).toLocaleString("zh-TW")}
      </p>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-[var(--color-surface)] rounded-2xl p-4">
          <p className="text-[10px] tracking-wider text-[var(--color-text-muted)] uppercase">總營收</p>
          <p className="text-2xl font-bold text-[var(--color-brand)] mt-1">
            NT${(data.totals.revenue / 10000).toFixed(0)}萬
          </p>
          <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
            {data.totals.revenue.toLocaleString()} 元
          </p>
        </div>
        <div className="bg-[var(--color-surface)] rounded-2xl p-4">
          <p className="text-[10px] tracking-wider text-[var(--color-text-muted)] uppercase">總預約</p>
          <p className="text-2xl font-bold text-[var(--color-text-primary)] mt-1">
            {data.totals.bookings.toLocaleString()}
          </p>
          <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
            日均 {Math.round(data.totals.bookings / 313)} 筆（扣週三公休）
          </p>
        </div>
        <div className="bg-[var(--color-surface)] rounded-2xl p-4">
          <p className="text-[10px] tracking-wider text-[var(--color-text-muted)] uppercase">客戶數</p>
          <p className="text-2xl font-bold text-[var(--color-text-primary)] mt-1">
            {data.totals.uniqueCustomers}
          </p>
          <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
            含 {data.totals.newCustomers} 新客
          </p>
        </div>
        <div className="bg-[var(--color-surface)] rounded-2xl p-4">
          <p className="text-[10px] tracking-wider text-[var(--color-text-muted)] uppercase">回訪率</p>
          <p className="text-2xl font-bold text-[var(--color-success)] mt-1">
            {data.totals.repeatRate}%
          </p>
          <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
            {data.totals.repeatCustomers} 位回頭客
          </p>
        </div>
      </div>

      {/* Monthly revenue bar chart */}
      <div className="bg-[var(--color-surface)] rounded-2xl p-5">
        <h2 className="text-sm font-bold text-[var(--color-text-primary)] mb-4">月營收趨勢</h2>
        <div className="space-y-2">
          {data.monthlyRevenue.map((m) => (
            <div key={m.month} className="flex items-center gap-2">
              <span className="text-xs text-[var(--color-text-muted)] w-14 shrink-0 font-mono">{m.month}</span>
              <div className="flex-1 bg-[var(--color-bg)] rounded h-6 relative overflow-hidden">
                <div
                  className="h-full bg-[var(--color-brand)]/80 rounded transition-all"
                  style={{ width: `${(m.revenue / maxMonthRevenue) * 100}%` }}
                />
                <span className="absolute inset-0 flex items-center justify-end pr-2 text-[11px] font-semibold text-[var(--color-text-primary)]">
                  NT${m.revenue.toLocaleString()} ({m.count})
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Service pie (horizontal bar) */}
      <div className="bg-[var(--color-surface)] rounded-2xl p-5">
        <h2 className="text-sm font-bold text-[var(--color-text-primary)] mb-1">服務分布</h2>
        <p className="text-xs text-[var(--color-text-muted)] mb-4">按類別歸類，總計 {totalServiceCount} 筆</p>
        <div className="space-y-2">
          {data.servicePie.map((p) => {
            const pct = (p.count / totalServiceCount) * 100;
            return (
              <div key={p.category} className="flex items-center gap-3">
                <span className="text-sm font-semibold w-8 shrink-0 text-[var(--color-text-primary)]">{p.category}</span>
                <div className="flex-1 bg-[var(--color-bg)] rounded h-5 overflow-hidden">
                  <div
                    className={`h-full rounded ${SERVICE_COLORS[p.category] || SERVICE_COLORS["其他"]}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-xs text-[var(--color-text-body)] w-32 text-right tabular-nums">
                  {p.count} 筆 · NT${p.revenue.toLocaleString()}
                </span>
                <span className="text-xs text-[var(--color-text-muted)] w-12 text-right tabular-nums">
                  {pct.toFixed(1)}%
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Heatmap */}
      <div className="bg-[var(--color-surface)] rounded-2xl p-5">
        <h2 className="text-sm font-bold text-[var(--color-text-primary)] mb-4">時段熱力圖（一週 × 整點）</h2>
        <div className="overflow-x-auto">
          <table className="text-[10px] tabular-nums">
            <thead>
              <tr>
                <th className="px-1 py-1"></th>
                {data.heatmap.hours.map((h) => (
                  <th key={h} className="px-2 py-1 text-[var(--color-text-muted)] font-mono font-normal">{h}</th>
                ))}
                <th className="px-2 py-1 text-[var(--color-text-muted)] font-mono font-normal">合計</th>
              </tr>
            </thead>
            <tbody>
              {data.heatmap.weekdays.map((wd, wi) => {
                const rowSum = data.heatmap.data[wi].reduce((s, n) => s + n, 0);
                return (
                  <tr key={wd}>
                    <td className="px-1 py-1 font-semibold text-[var(--color-text-primary)] pr-3">{wd}</td>
                    {data.heatmap.data[wi].map((n, hi) => {
                      const intensity = n / maxHeatmapValue;
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
          顏色越深 = 越熱門。週四下午 / 週六全天最忙；週一二早段是低營收區，是行銷推播的好對象。
        </p>
      </div>

      {/* Top services */}
      <div className="bg-[var(--color-surface)] rounded-2xl p-5">
        <h2 className="text-sm font-bold text-[var(--color-text-primary)] mb-4">服務 Top 10（按筆數）</h2>
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
              {data.topServices.map((s) => (
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

      {/* Customer segment ring */}
      {data.customerSegments && data.customerSegments.length > 0 && (
        <CustomerSegmentWidget
          segments={data.customerSegments}
          total={data.totals.uniqueCustomers}
        />
      )}

      {/* Lapsed trend */}
      {data.lapsedTrend && data.lapsedTrend.length > 0 && (
        <LapsedTrendWidget points={data.lapsedTrend} />
      )}

      {/* ARPU trend */}
      {data.arpuTrend && data.arpuTrend.length > 0 && (
        <ArpuWidget points={data.arpuTrend} />
      )}

      {/* Cohort retention */}
      {data.cohorts && data.cohorts.length > 0 && (
        <CohortWidget cohorts={data.cohorts} />
      )}

      {/* Footer note */}
      <div className="bg-[var(--color-surface)] rounded-2xl p-4 text-xs text-[var(--color-text-muted)] space-y-1">
        <p>📊 本頁顯示 <strong>2025 年 1-12 月歷史資料</strong>（Excel 預約表解析）。</p>
        <p>🔄 V3 系統即時資料（取消 / no-show 比例）待 Excel live import 完成後接入。</p>
        <p>🛠️ 重新生成快照：<code className="bg-[var(--color-bg)] px-1.5 py-0.5 rounded">npm run reports:snapshot</code></p>
      </div>
    </main>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Wave 5 follow-up widgets — driven by the same snapshot
// ────────────────────────────────────────────────────────────────────────

const SEGMENT_COLOR: Record<CustomerSegment["segment"], string> = {
  NEW: "var(--color-brand)",
  REGULAR: "#60a5fa",
  VIP: "#fbbf24",
  AT_RISK: "#fb923c",
  LAPSED: "var(--color-text-muted)",
};
const SEGMENT_LABEL: Record<CustomerSegment["segment"], string> = {
  NEW: "新客 (1 次)",
  REGULAR: "常客 (2-4 次)",
  VIP: "VIP (5+ 次)",
  AT_RISK: "流失中 (100+ 天)",
  LAPSED: "已流失 (180+ 天)",
};

function CustomerSegmentWidget({
  segments,
  total,
}: {
  segments: CustomerSegment[];
  total: number;
}) {
  const visibleSegs = segments.filter((s) => s.count > 0);
  const stops = visibleSegs
    .reduce<{ stops: string[]; acc: number }>(
      (memo, s) => {
        const start = memo.acc;
        const next = memo.acc + s.pct;
        memo.stops.push(`${SEGMENT_COLOR[s.segment]} ${start}% ${next}%`);
        return { stops: memo.stops, acc: next };
      },
      { stops: [], acc: 0 },
    )
    .stops.join(", ");

  const lapsedTotal =
    (segments.find((s) => s.segment === "AT_RISK")?.count ?? 0) +
    (segments.find((s) => s.segment === "LAPSED")?.count ?? 0);

  return (
    <div className="bg-[var(--color-surface)] rounded-2xl p-5">
      <h2 className="text-sm font-bold text-[var(--color-text-primary)] mb-1">客戶分層</h2>
      <p className="text-xs text-[var(--color-text-muted)] mb-4">
        按 2025 年訪問頻次與最後到店日（相對 12/31）分類
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
                style={{ background: SEGMENT_COLOR[s.segment] }}
              />
              <span className="flex-1 text-[var(--color-text-body)]">
                {SEGMENT_LABEL[s.segment]}
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
      <p className="text-[11px] text-[var(--color-text-muted)] mt-4">
        💡 流失中 + 已流失 = {lapsedTotal} 位 — 是行銷喚回的最大池子。
      </p>
    </div>
  );
}

function LapsedTrendWidget({ points }: { points: LapsedPoint[] }) {
  const max = Math.max(...points.flatMap((p) => [p.active, p.lapsed]), 1);
  return (
    <div className="bg-[var(--color-surface)] rounded-2xl p-5">
      <h2 className="text-sm font-bold text-[var(--color-text-primary)] mb-1">活躍 vs 流失趨勢</h2>
      <p className="text-xs text-[var(--color-text-muted)] mb-4">
        每月底：active = 90 天內有來；lapsed = 90+ 天沒來
      </p>
      <div className="space-y-2">
        {points.map((p) => (
          <div key={p.month} className="flex items-center gap-2 text-xs">
            <span className="w-14 shrink-0 font-mono text-[var(--color-text-muted)]">
              {p.month.slice(5)}月
            </span>
            <div className="flex-1 flex h-5 rounded overflow-hidden bg-[var(--color-bg)]">
              <div
                className="bg-[var(--color-brand)]/80 flex items-center justify-end pr-1.5 text-white font-mono text-[10px]"
                style={{ width: `${(p.active / max) * 100}%` }}
              >
                {p.active > 30 ? p.active : ""}
              </div>
              <div
                className="bg-[var(--color-warning,#fb923c)]/70 flex items-center justify-end pr-1.5 text-white font-mono text-[10px]"
                style={{ width: `${(p.lapsed / max) * 100}%` }}
              >
                {p.lapsed > 30 ? p.lapsed : ""}
              </div>
            </div>
            <span className="w-20 shrink-0 text-right text-[var(--color-text-body)] tabular-nums">
              {p.active} / {p.lapsed}
            </span>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-4 mt-3 text-[11px] text-[var(--color-text-muted)]">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-[var(--color-brand)]/80" />
          活躍
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-[var(--color-warning,#fb923c)]/70" />
          流失
        </span>
      </div>
    </div>
  );
}

function ArpuWidget({ points }: { points: ArpuPoint[] }) {
  const maxCustomer = Math.max(...points.map((p) => p.avgPerCustomer), 1);
  return (
    <div className="bg-[var(--color-surface)] rounded-2xl p-5">
      <h2 className="text-sm font-bold text-[var(--color-text-primary)] mb-1">
        客單價趨勢 (ARPU)
      </h2>
      <p className="text-xs text-[var(--color-text-muted)] mb-4">
        每月：人均客單 = 月營收 ÷ 該月活躍人數；筆均 = 月營收 ÷ 月預約數
      </p>
      <div className="overflow-x-auto -mx-1 px-1">
        <table className="w-full text-xs tabular-nums">
          <thead>
            <tr className="text-[10px] tracking-wider text-[var(--color-text-muted)] uppercase border-b border-[var(--color-bg)]">
              <th className="text-left py-1.5">月</th>
              <th className="text-right py-1.5">活躍人數</th>
              <th className="text-right py-1.5">人均客單</th>
              <th className="text-right py-1.5">筆均</th>
              <th className="text-right py-1.5 hidden sm:table-cell">人均比例條</th>
            </tr>
          </thead>
          <tbody>
            {points.map((p) => (
              <tr key={p.month} className="border-b border-[var(--color-bg)]/50">
                <td className="py-1.5 text-[var(--color-text-muted)] font-mono">
                  {p.month.slice(5)}月
                </td>
                <td className="py-1.5 text-right text-[var(--color-text-body)]">
                  {p.activeCustomers}
                </td>
                <td className="py-1.5 text-right text-[var(--color-text-primary)] font-semibold">
                  NT${p.avgPerCustomer.toLocaleString()}
                </td>
                <td className="py-1.5 text-right text-[var(--color-text-body)]">
                  NT${p.avgPerBooking.toLocaleString()}
                </td>
                <td className="py-1.5 hidden sm:table-cell w-32">
                  <div className="h-2 bg-[var(--color-bg)] rounded overflow-hidden">
                    <div
                      className="h-full bg-[var(--color-brand)]/70 rounded"
                      style={{ width: `${(p.avgPerCustomer / maxCustomer) * 100}%` }}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CohortWidget({ cohorts }: { cohorts: CohortPoint[] }) {
  return (
    <div className="bg-[var(--color-surface)] rounded-2xl p-5">
      <h2 className="text-sm font-bold text-[var(--color-text-primary)] mb-1">
        新客回訪 Cohort (30/60/90 天)
      </h2>
      <p className="text-xs text-[var(--color-text-muted)] mb-4">
        該月首訪客戶中，多少人在 30/60/90 天內再回來。後段月份 90 天視窗未滿，數值偏低。
      </p>
      <div className="overflow-x-auto -mx-1 px-1">
        <table className="w-full text-xs tabular-nums">
          <thead>
            <tr className="text-[10px] tracking-wider text-[var(--color-text-muted)] uppercase border-b border-[var(--color-bg)]">
              <th className="text-left py-1.5">首訪月</th>
              <th className="text-right py-1.5">新客數</th>
              <th className="text-right py-1.5">30 天</th>
              <th className="text-right py-1.5">60 天</th>
              <th className="text-right py-1.5">90 天</th>
            </tr>
          </thead>
          <tbody>
            {cohorts.map((c) => {
              const r30 = c.size > 0 ? Math.round((c.returned30 / c.size) * 100) : 0;
              const r60 = c.size > 0 ? Math.round((c.returned60 / c.size) * 100) : 0;
              const r90 = c.size > 0 ? Math.round((c.returned90 / c.size) * 100) : 0;
              return (
                <tr key={c.cohortMonth} className="border-b border-[var(--color-bg)]/50">
                  <td className="py-1.5 text-[var(--color-text-muted)] font-mono">
                    {c.cohortMonth.slice(5)}月
                  </td>
                  <td className="py-1.5 text-right text-[var(--color-text-body)]">
                    {c.size}
                  </td>
                  <CohortCell pct={r30} count={c.returned30} />
                  <CohortCell pct={r60} count={c.returned60} />
                  <CohortCell pct={r90} count={c.returned90} />
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CohortCell({ pct, count }: { pct: number; count: number }) {
  const intensity = Math.min(pct / 60, 1);
  const dark = intensity > 0.6;
  return (
    <td
      className="py-1.5 text-right tabular-nums"
      style={{
        backgroundColor: pct > 0 ? `rgba(0, 61, 43, ${0.05 + intensity * 0.4})` : undefined,
        color: dark ? "white" : undefined,
      }}
    >
      <span style={{ color: dark ? "white" : undefined }}>{pct}%</span>
      <span
        className="text-[10px] ml-1"
        style={{ color: dark ? "rgba(255,255,255,0.7)" : "var(--color-text-muted)" }}
      >
        ({count})
      </span>
    </td>
  );
}
