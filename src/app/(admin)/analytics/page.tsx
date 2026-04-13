"use client";

import { useState } from "react";
import { usePageTitle } from "@/lib/hooks/use-page-title";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface AnalyticsData {
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
  heatmap: Array<{ dayOfWeek: number; hour: number; count: number }>;
  dailyRevenue: Array<{ date: string; revenue: number; bookings: number }>;
}

const SEGMENT_COLORS: Record<string, string> = {
  VIP: "bg-[var(--color-warning)]",
  REGULAR: "bg-[var(--color-success)]",
  NEW: "bg-[var(--color-brand)]",
  AT_RISK: "bg-[var(--color-warning)]/60",
  LAPSED: "bg-[var(--color-danger)]",
};

const SEGMENT_LABELS: Record<string, string> = {
  VIP: "VIP", REGULAR: "常客", NEW: "新客", AT_RISK: "流失中", LAPSED: "已流失",
};

const WEEKDAY_LABELS = ["日", "一", "二", "三", "四", "五", "六"];

export default function AnalyticsPage() {
  usePageTitle("報表");
  const [period, setPeriod] = useState<"week" | "month" | "year">("week");

  const { data, isLoading } = useSWR(`/api/admin/analytics?period=${period}`, fetcher);
  const analytics: AnalyticsData | null = data || null;
  const o = analytics?.overview;

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-xl font-bold text-[var(--color-text-primary)] mb-4 tracking-wide">報表</h1>

      <div className="flex mb-5 border border-[var(--color-brand)] rounded-lg overflow-hidden">
        {(["week", "month", "year"] as const).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${
              period === p
                ? "bg-[var(--color-brand)] text-[var(--color-bg)]"
                : "text-[var(--color-brand)]"
            }`}
          >
            {{ week: "本週", month: "本月", year: "今年" }[p]}
          </button>
        ))}
      </div>

      {isLoading || !o || !analytics ? (
        <div className="py-12 text-center">
          <div className="w-6 h-6 border-2 border-[var(--color-brand)] border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 mb-6">
            <StatCard label="營收" value={`NT$${o.revenue.toLocaleString()}`} />
            <StatCard label="預約數" value={String(o.totalBookings)} />
            <StatCard label="佔用率" value={`${o.occupancyRate}%`} />
            <StatCard label="新客數" value={String(o.newCustomers)} />
          </div>

          {analytics.dailyRevenue.length > 0 && (
            <div className="mb-6">
              <h2 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">每日營收趨勢</h2>
              <div className="flex items-end gap-1 h-32">
                {analytics.dailyRevenue.map((d, i) => {
                  const max = Math.max(...analytics.dailyRevenue.map((x) => x.revenue), 1);
                  const height = (d.revenue / max) * 100;
                  const dateObj = new Date(d.date + "T00:00:00+08:00");
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <div
                        className="w-full bg-[var(--color-brand)]/70 rounded-t transition-all"
                        style={{ height: `${Math.max(height, 4)}%` }}
                      />
                      <span className="text-[9px] text-[var(--color-text-muted)]">
                        {WEEKDAY_LABELS[dateObj.getDay()]}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {analytics.heatmap.length > 0 && (
            <div className="mb-6">
              <h2 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">尖峰時段</h2>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      <th className="w-8 text-[9px] text-[var(--color-text-muted)]" />
                      {WEEKDAY_LABELS.map((d) => (
                        <th key={d} className="text-[9px] text-[var(--color-text-muted)] text-center p-0.5">{d}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: 9 }, (_, i) => {
                      const hour = 11 + i;
                      return (
                        <tr key={hour}>
                          <td className="text-[9px] text-[var(--color-text-muted)] pr-1 text-right">{hour}</td>
                          {Array.from({ length: 7 }, (_, dow) => {
                            const entry = analytics.heatmap.find((h) => h.dayOfWeek === dow && h.hour === hour);
                            const count = entry?.count || 0;
                            const maxCount = Math.max(...analytics.heatmap.map((h) => h.count), 1);
                            const opacity = count === 0 ? 0.05 : 0.15 + (count / maxCount) * 0.6;
                            return (
                              <td key={dow} className="p-0.5">
                                <div className="w-full h-5 rounded bg-[var(--color-brand)]" style={{ opacity }} />
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {analytics.popularServices.length > 0 && (
            <div className="mb-6">
              <h2 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">熱門服務</h2>
              <div className="space-y-2">
                {analytics.popularServices.map((s, i) => {
                  const maxCount = analytics.popularServices[0]?.count || 1;
                  const pct = analytics.overview.totalBookings > 0
                    ? Math.round((s.count / analytics.overview.totalBookings) * 100)
                    : 0;
                  return (
                    <div key={i} className="flex items-center gap-3">
                      <span className="text-sm text-[var(--color-text-body)] w-20 truncate">{s.serviceName}</span>
                      <div className="flex-1 h-4 bg-[var(--color-surface)] rounded overflow-hidden">
                        <div className="h-full bg-[var(--color-brand)] rounded" style={{ width: `${(s.count / maxCount) * 100}%` }} />
                      </div>
                      <span className="text-xs text-[var(--color-text-muted)] w-10 text-right">{pct}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {analytics.segments.length > 0 && (
            <div className="mb-6">
              <h2 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">客群分佈</h2>
              <div className="flex h-5 rounded overflow-hidden mb-2">
                {analytics.segments.map((s) => {
                  const total = analytics.segments.reduce((sum, x) => sum + x._count, 0);
                  const pct = total > 0 ? (s._count / total) * 100 : 0;
                  return (
                    <div
                      key={s.segment}
                      className={SEGMENT_COLORS[s.segment] || "bg-[var(--color-surface)]"}
                      style={{ width: `${pct}%` }}
                    />
                  );
                })}
              </div>
              <div className="flex flex-wrap gap-3">
                {analytics.segments.map((s) => {
                  const total = analytics.segments.reduce((sum, x) => sum + x._count, 0);
                  const pct = total > 0 ? Math.round((s._count / total) * 100) : 0;
                  return (
                    <div key={s.segment} className="flex items-center gap-1">
                      <div className={`w-2 h-2 rounded-full ${SEGMENT_COLORS[s.segment] || "bg-[var(--color-surface)]"}`} />
                      <span className="text-[10px] text-[var(--color-text-muted)]">
                        {SEGMENT_LABELS[s.segment] || s.segment} ({pct}%)
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[var(--color-surface)] rounded-xl p-4">
      <p className="text-lg font-bold text-[var(--color-text-primary)]">{value}</p>
      <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">{label}</p>
    </div>
  );
}
