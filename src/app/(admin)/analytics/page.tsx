"use client";

import { useState, useEffect, useTransition, useCallback } from "react";
import { usePageTitle } from "@/lib/hooks/use-page-title";

interface Analytics {
  period: string;
  overview: {
    totalBookings: number;
    completedBookings: number;
    cancelledBookings: number;
    noShowBookings: number;
    revenue: number;
    newCustomers: number;
    occupancyRate: number;
  };
  segments: Array<{ segment: string; _count: number }>;
  popularServices: Array<{ serviceName: string; count: number }>;
  dailyBookings: Array<{ day: string; count: number }>;
  heatmap: Array<{ dayOfWeek: number; hour: number; count: number }>;
  dailyRevenue: Array<{ date: string; revenue: number; bookings: number }>;
}

const SEGMENT_LABELS: Record<string, string> = {
  NEW: "新客",
  REGULAR: "常客",
  VIP: "VIP",
  AT_RISK: "流失風險",
  LAPSED: "已流失",
  BLACKLISTED: "黑名單",
};

const DAY_LABELS = ["日", "一", "二", "三", "四", "五", "六"];
const HOURS = [11, 12, 13, 14, 15, 16, 17, 18, 19];

function getHeatmapColor(count: number): string {
  if (count === 0) return "bg-gray-50 text-gray-300";
  if (count === 1) return "bg-emerald-100 text-emerald-700";
  if (count <= 3) return "bg-emerald-300 text-emerald-900";
  return "bg-emerald-600 text-white";
}

export default function AnalyticsPage() {
  usePageTitle("營運分析");
  const [data, setData] = useState<Analytics | null>(null);
  const [period, setPeriod] = useState("week");
  const [isPending, startTransition] = useTransition();
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/analytics?period=${period}`);
        const json = await res.json();
        setData(json);
      } catch (err) {
        console.error(err);
      }
    });
  }, [period]);

  const exportAnalyticsCSV = useCallback(() => {
    if (!data) return;
    setExporting(true);

    try {
      const BOM = "\uFEFF";
      const header = "日期,預約數,完成數,營收,新客戶,取消數";

      // Use dailyRevenue for per-day data, fill in with overview totals for summary
      const rows: string[] = [];

      if (data.dailyRevenue && data.dailyRevenue.length > 0) {
        // Per-day rows from dailyRevenue
        data.dailyRevenue.forEach((d) => {
          const dateStr = new Date(d.date).toISOString().split("T")[0];
          rows.push(`${dateStr},${d.bookings},,${d.revenue},,`);
        });
      }

      // Summary row
      rows.push(
        `合計,${data.overview.totalBookings},${data.overview.completedBookings},${data.overview.revenue},${data.overview.newCustomers},${data.overview.cancelledBookings}`
      );

      const csv = BOM + [header, ...rows].join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `analytics_${data.period}_${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }, [data]);

  if (isPending || !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const { overview } = data;

  // Build heatmap lookup
  const heatmapMap = new Map<string, number>();
  (data.heatmap || []).forEach((h) => {
    heatmapMap.set(`${h.dayOfWeek}-${h.hour}`, h.count);
  });

  // Revenue chart max
  const maxRevenue = Math.max(...(data.dailyRevenue || []).map((d) => d.revenue), 1);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">數據分析</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={exportAnalyticsCSV}
            disabled={exporting}
            className="px-3 py-1.5 text-sm rounded-lg bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            {exporting ? "匯出中..." : "匯出 CSV"}
          </button>
          <div className="flex gap-1">
            {[
              { value: "week", label: "本週" },
              { value: "month", label: "本月" },
              { value: "year", label: "今年" },
            ].map((p) => (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value)}
                className={`px-3 py-1.5 text-sm rounded-lg ${
                  period === p.value
                    ? "bg-emerald-500 text-white"
                    : "bg-gray-100 text-gray-600"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Overview cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard label="總預約" value={overview.totalBookings} />
        <StatCard label="完成" value={overview.completedBookings} color="text-blue-600" />
        <StatCard
          label="營收"
          value={`NT$${overview.revenue.toLocaleString()}`}
          color="text-emerald-600"
        />
        <StatCard
          label="佔用率"
          value={`${overview.occupancyRate}%`}
          color={overview.occupancyRate > 70 ? "text-emerald-600" : "text-amber-600"}
        />
      </div>

      <div className="grid grid-cols-4 gap-4 mb-8">
        <StatCard
          label="取消"
          value={overview.cancelledBookings}
          color="text-gray-500"
        />
        <StatCard
          label="未到店"
          value={overview.noShowBookings}
          color="text-red-500"
        />
        <StatCard label="新客" value={overview.newCustomers} color="text-sky-600" />
        <StatCard
          label="取消率"
          value={
            overview.totalBookings > 0
              ? `${Math.round(((overview.cancelledBookings + overview.noShowBookings) / overview.totalBookings) * 100)}%`
              : "0%"
          }
          color="text-orange-500"
        />
      </div>

      {/* Heatmap */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="font-semibold text-gray-900 mb-4">尖峰時段熱力圖</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[500px]">
            <thead>
              <tr>
                <th className="w-12 text-xs text-gray-400 font-normal pb-2 text-left" />
                {HOURS.map((h) => (
                  <th key={h} className="text-xs text-gray-400 font-normal pb-2 text-center">
                    {h}:00
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* Render Mon(1) through Sun(0): order 1,2,3,4,5,6,0 */}
              {[1, 2, 3, 4, 5, 6, 0].map((dow) => (
                <tr key={dow}>
                  <td className="text-xs text-gray-500 pr-2 py-1 font-medium">
                    {DAY_LABELS[dow]}
                  </td>
                  {HOURS.map((h) => {
                    const count = heatmapMap.get(`${dow}-${h}`) || 0;
                    return (
                      <td key={h} className="p-0.5 text-center">
                        <div
                          className={`rounded text-xs font-medium py-2 ${getHeatmapColor(count)}`}
                          title={`${DAY_LABELS[dow]} ${h}:00 — ${count} 筆預約`}
                        >
                          {count}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center gap-3 mt-3 text-xs text-gray-400">
          <span>少</span>
          <div className="w-5 h-3 rounded bg-gray-50 border border-gray-200" />
          <div className="w-5 h-3 rounded bg-emerald-100" />
          <div className="w-5 h-3 rounded bg-emerald-300" />
          <div className="w-5 h-3 rounded bg-emerald-600" />
          <span>多</span>
        </div>
      </div>

      {/* Revenue Trend Chart */}
      {data.dailyRevenue && data.dailyRevenue.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="font-semibold text-gray-900 mb-4">每日營收趨勢</h2>
          <div className="overflow-x-auto">
            <div className="flex items-end gap-1.5 h-40 min-w-[400px]">
              {data.dailyRevenue.map((d) => {
                const height = maxRevenue > 0 ? (d.revenue / maxRevenue) * 100 : 0;
                const dateStr = new Date(d.date).toISOString().split("T")[0];
                const displayDate = `${new Date(d.date).getMonth() + 1}/${new Date(d.date).getDate()}`;
                return (
                  <div
                    key={dateStr}
                    className="flex-1 flex flex-col items-center gap-1 group"
                  >
                    <span className="text-[10px] text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                      NT${d.revenue.toLocaleString()}
                    </span>
                    <div
                      className="w-full bg-emerald-400 hover:bg-emerald-500 rounded-t transition-colors relative"
                      style={{ height: `${Math.max(height, 2)}%` }}
                      title={`${dateStr}: NT$${d.revenue.toLocaleString()} / ${d.bookings} 筆`}
                    />
                    <span className="text-[10px] text-gray-400">{displayDate}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-6">
        {/* Popular services */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">熱門服務</h2>
          {data.popularServices.length === 0 ? (
            <p className="text-gray-400 text-sm">暫無數據</p>
          ) : (
            <div className="space-y-3">
              {data.popularServices.map((s, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 bg-emerald-100 text-emerald-700 text-xs rounded-full flex items-center justify-center font-medium">
                      {i + 1}
                    </span>
                    <span className="text-sm">{s.serviceName}</span>
                  </div>
                  <span className="text-sm text-gray-500">{s.count} 筆</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Customer segments */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">顧客分類</h2>
          {data.segments.length === 0 ? (
            <p className="text-gray-400 text-sm">暫無數據</p>
          ) : (
            <div className="space-y-3">
              {data.segments.map((s) => (
                <div key={s.segment} className="flex items-center justify-between">
                  <span className="text-sm">
                    {SEGMENT_LABELS[s.segment] || s.segment}
                  </span>
                  <span className="text-sm text-gray-500">{s._count} 人</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Daily bookings chart (simple bar) */}
      {data.dailyBookings.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mt-6">
          <h2 className="font-semibold text-gray-900 mb-4">每日預約數</h2>
          <div className="flex items-end gap-2 h-32">
            {data.dailyBookings.map((d) => {
              const max = Math.max(...data.dailyBookings.map((x) => x.count), 1);
              const height = (d.count / max) * 100;
              return (
                <div key={d.day} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-xs text-gray-500">{d.count}</span>
                  <div
                    className="w-full bg-emerald-400 rounded-t"
                    style={{ height: `${Math.max(height, 4)}%` }}
                  />
                  <span className="text-[10px] text-gray-400">
                    {new Date(d.day).getDate()}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string | number;
  color?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <p className="text-sm text-gray-500">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${color || "text-gray-900"}`}>
        {value}
      </p>
    </div>
  );
}
