"use client";

import { useState, useEffect } from "react";
import { usePageTitle } from "@/lib/hooks/use-page-title";

interface Booking {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  service: { name: string; duration: number; price: number };
  user: { displayName: string | null; phone: string | null };
  payment: { status: string } | null;
}

interface Analytics {
  overview: {
    totalBookings: number;
    completedBookings: number;
    cancelledBookings: number;
    noShowBookings: number;
    revenue: number;
    newCustomers: number;
    occupancyRate: number;
  };
}

const STATUS_COLORS: Record<string, string> = {
  CONFIRMED: "bg-emerald-100 text-emerald-700",
  COMPLETED: "bg-blue-100 text-blue-700",
  CANCELLED: "bg-gray-100 text-gray-500",
  NO_SHOW: "bg-red-100 text-red-700",
};

const STATUS_LABELS: Record<string, string> = {
  CONFIRMED: "已確認",
  COMPLETED: "已完成",
  CANCELLED: "已取消",
  NO_SHOW: "未到店",
};

export default function DashboardPage() {
  usePageTitle("儀表板");
  const [todayBookings, setTodayBookings] = useState<Booking[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [exportingCSV, setExportingCSV] = useState(false);

  useEffect(() => {
    const today = new Date().toISOString().split("T")[0];

    Promise.all([
      fetch(`/api/bookings?date=${today}`).then((r) => r.json()),
      fetch("/api/admin/analytics?period=week").then((r) => r.json()),
    ])
      .then(([bookingsData, analyticsData]) => {
        setTodayBookings(bookingsData.bookings || []);
        setAnalytics(analyticsData);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleAction = async (bookingId: string, action: string) => {
    const res = await fetch(`/api/bookings/${bookingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });

    if (res.ok) {
      setTodayBookings((prev) =>
        prev.map((b) =>
          b.id === bookingId
            ? { ...b, status: action === "complete" ? "COMPLETED" : action === "no_show" ? "NO_SHOW" : "CANCELLED_BY_ADMIN" }
            : b
        )
      );
    }
  };

  const exportBookingsCSV = async () => {
    setExportingCSV(true);
    try {
      const now = new Date();
      const from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      const to = now.toISOString().split("T")[0];
      const res = await fetch(`/api/admin/export?from=${from}&to=${to}`);
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `bookings_${from}_${to}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("CSV export error:", err);
    } finally {
      setExportingCSV(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const stats = analytics?.overview;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">儀表板</h1>
        <button
          onClick={exportBookingsCSV}
          disabled={exportingCSV}
          className="px-3 py-1.5 text-sm rounded-lg bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
        >
          {exportingCSV ? "匯出中..." : "匯出預約 CSV"}
        </button>
      </div>

      {/* Stats cards */}
      {stats && (
        <div className="grid grid-cols-4 gap-4 mb-8">
          <StatCard label="本週預約" value={stats.totalBookings} />
          <StatCard label="完成" value={stats.completedBookings} />
          <StatCard
            label="營收"
            value={`$${stats.revenue.toLocaleString()}`}
          />
          <StatCard label="佔用率" value={`${stats.occupancyRate}%`} />
        </div>
      )}

      {/* Today's schedule */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">今日時程表</h2>
          <p className="text-sm text-gray-500">
            {todayBookings.length} 筆預約
          </p>
        </div>

        {todayBookings.length === 0 ? (
          <div className="px-6 py-12 text-center text-gray-400">
            今天沒有預約
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {todayBookings.map((booking) => (
              <div
                key={booking.id}
                className="px-6 py-4 flex items-center justify-between"
              >
                <div className="flex items-center gap-4">
                  <div className="text-center min-w-[60px]">
                    <p className="text-lg font-semibold text-gray-900">
                      {booking.startTime}
                    </p>
                    <p className="text-xs text-gray-400">
                      {booking.endTime}
                    </p>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">
                      {booking.user.displayName || "未知顧客"}
                    </p>
                    <p className="text-sm text-gray-500">
                      {booking.service.name} · NT$
                      {booking.service.price.toLocaleString()}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs px-2 py-1 rounded-full ${
                      STATUS_COLORS[booking.status] || "bg-gray-100"
                    }`}
                  >
                    {STATUS_LABELS[booking.status] || booking.status}
                  </span>

                  {booking.status === "CONFIRMED" && (
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleAction(booking.id, "complete")}
                        className="text-xs px-2 py-1 bg-blue-50 text-blue-600 rounded hover:bg-blue-100"
                      >
                        完成
                      </button>
                      <button
                        onClick={() => handleAction(booking.id, "no_show")}
                        className="text-xs px-2 py-1 bg-red-50 text-red-500 rounded hover:bg-red-100"
                      >
                        未到
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
    </div>
  );
}
