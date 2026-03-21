"use client";

import { useState, useEffect } from "react";

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
}

const SEGMENT_LABELS: Record<string, string> = {
  NEW: "新客",
  REGULAR: "常客",
  VIP: "VIP",
  AT_RISK: "流失風險",
  LAPSED: "已流失",
  BLACKLISTED: "黑名單",
};

export default function AnalyticsPage() {
  const [data, setData] = useState<Analytics | null>(null);
  const [period, setPeriod] = useState("week");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/analytics?period=${period}`)
      .then((r) => r.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [period]);

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const { overview } = data;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">數據分析</h1>
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
