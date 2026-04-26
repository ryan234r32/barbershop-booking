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

      {/* Footer note */}
      <div className="bg-[var(--color-surface)] rounded-2xl p-4 text-xs text-[var(--color-text-muted)] space-y-1">
        <p>📊 本頁顯示 <strong>2025 年 1-12 月歷史資料</strong>（Excel 預約表解析）。</p>
        <p>🔄 V3 系統即時資料 + 客戶分層 / 流失趨勢 / 客單價趨勢 / cohort retention 等剩餘 widget 在 Wave 5 後續迭代加入。</p>
        <p>🛠️ 重新生成快照：<code className="bg-[var(--color-bg)] px-1.5 py-0.5 rounded">npm run reports:snapshot</code></p>
      </div>
    </main>
  );
}
