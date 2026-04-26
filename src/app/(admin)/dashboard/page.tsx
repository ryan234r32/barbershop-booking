"use client";

import { useState, useEffect } from "react";
import { usePageTitle } from "@/lib/hooks/use-page-title";
import { PastDueModal } from "@/components/admin/past-due-modal";
import { adminHeaders } from "@/lib/auth/admin-fetch";
import { useToast } from "@/components/ui/toast";

interface Booking {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  service: { name: string; duration: number; price: number };
  user: { displayName: string | null; phone: string | null };
  payment: {
    status: "PENDING" | "VERIFYING" | "RECEIVED" | "WAIVED";
    method: "CASH" | "BANK_TRANSFER";
    transferLastFive: string | null;
  } | null;
}

const PAYMENT_BADGE: Record<string, { label: string; className: string }> = {
  PENDING: { label: "待付款", className: "bg-secondary text-muted-foreground" },
  VERIFYING: { label: "待對帳", className: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
  RECEIVED: { label: "已收款", className: "bg-[var(--color-brand)]/10 text-[var(--color-brand)]" },
  WAIVED: { label: "已豁免", className: "bg-secondary text-muted-foreground" },
};

const METHOD_LABEL: Record<string, string> = {
  CASH: "現金",
  BANK_TRANSFER: "轉帳",
};

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
  CONFIRMED: "bg-primary/15 text-primary",
  COMPLETED: "bg-[var(--color-brand)]/10 text-[var(--color-brand)]",
  CANCELLED: "bg-secondary text-muted-foreground",
  NO_SHOW: "bg-destructive/15 text-destructive",
};

const STATUS_LABELS: Record<string, string> = {
  CONFIRMED: "已確認",
  COMPLETED: "已完成",
  CANCELLED: "已取消",
  NO_SHOW: "未到店",
};

export default function DashboardPage() {
  usePageTitle("儀表板");
  const { toast } = useToast();
  const [todayBookings, setTodayBookings] = useState<Booking[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [exportingCSV, setExportingCSV] = useState(false);
  const [pastDueBookings, setPastDueBookings] = useState<Booking[]>([]);
  const [showPastDueModal, setShowPastDueModal] = useState(false);
  const [markingReceived, setMarkingReceived] = useState<string | null>(null);

  const loadData = () => {
    const today = new Date().toISOString().split("T")[0];

    Promise.all([
      fetch(`/api/bookings?date=${today}`).then((r) => r.json()),
      fetch("/api/admin/analytics?period=week").then((r) => r.json()),
      fetch("/api/bookings/past-due").then((r) => r.json()),
    ])
      .then(([bookingsData, analyticsData, pastDueData]) => {
        setTodayBookings(bookingsData.bookings || []);
        setAnalytics(analyticsData);
        const pastDue = pastDueData.bookings || [];
        setPastDueBookings(pastDue);
        if (pastDue.length > 0) setShowPastDueModal(true);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, []);

  const handleAction = async (bookingId: string, action: string) => {
    const res = await fetch(`/api/bookings/${bookingId}`, {
      method: "PATCH",
      headers: adminHeaders(),
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

  const handleMarkReceived = async (bookingId: string) => {
    setMarkingReceived(bookingId);
    try {
      const res = await fetch(`/api/payments/${bookingId}/mark-received`, {
        method: "PATCH",
        headers: adminHeaders(),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || `HTTP ${res.status}`);
      }
      toast({ type: "success", message: "已標記為收款" });
      loadData();
    } catch (err) {
      toast({
        type: "error",
        message: err instanceof Error ? err.message : "標記失敗",
      });
    } finally {
      setMarkingReceived(null);
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
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const stats = analytics?.overview;

  // V3.5 Phase 3 — today's settlement summary derived from todayBookings.
  // Owner runs this every 8pm: glance at 已收 / 待對 / 總額, click 標已收款
  // for any 待對帳 row directly without leaving 儀表板.
  const todaySettlement = (() => {
    const completed = todayBookings.filter(
      (b) => b.status === "COMPLETED" || b.status === "CONFIRMED",
    );
    const received = completed.filter((b) => b.payment?.status === "RECEIVED");
    const pending = completed.filter(
      (b) => b.payment?.status === "PENDING" || b.payment?.status === "VERIFYING",
    );
    const totalAmount = completed.reduce((s, b) => s + b.service.price, 0);
    const receivedAmount = received.reduce((s, b) => s + b.service.price, 0);
    return {
      total: completed.length,
      receivedCount: received.length,
      pendingCount: pending.length,
      totalAmount,
      receivedAmount,
    };
  })();

  return (
    <div>
      {/* Past-due booking confirmation modal */}
      {showPastDueModal && pastDueBookings.length > 0 && (
        <PastDueModal
          bookings={pastDueBookings}
          onProcessed={() => {
            setShowPastDueModal(false);
            setPastDueBookings([]);
            loadData(); // Refresh dashboard data
          }}
        />
      )}

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">儀表板</h1>
        <button
          onClick={exportBookingsCSV}
          disabled={exportingCSV}
          className="px-3 py-1.5 text-sm rounded-lg bg-card border border-border text-foreground/80 hover:bg-background disabled:opacity-50 transition-colors"
        >
          {exportingCSV ? "匯出中..." : "匯出預約 CSV"}
        </button>
      </div>

      {/* Stats cards — 2 cols on mobile so 「本週預約」 fits on one line and
          $12,800 doesn't overflow into the next card. 4 cols from sm+ where
          there's room. */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-8">
          <StatCard label="本週預約" value={stats.totalBookings} />
          <StatCard label="完成" value={stats.completedBookings} />
          <StatCard
            label="營收"
            value={`$${stats.revenue.toLocaleString()}`}
          />
          <StatCard label="佔用率" value={`${stats.occupancyRate}%`} />
        </div>
      )}

      {/* 今日對帳 — V3.5 owner's 8pm scenario lives here now (Phase 3). */}
      <div className="bg-card rounded-xl border border-border mb-6">
        <div className="px-6 py-4 border-b border-border/50 flex items-start justify-between gap-4">
          <div>
            <h2 className="font-semibold text-foreground">📋 今日對帳</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {todaySettlement.total} 筆 · 已收 {todaySettlement.receivedCount}
              {todaySettlement.pendingCount > 0 && ` · 待對 ${todaySettlement.pendingCount}`}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-xs text-muted-foreground">今日已收</p>
            <p className="text-lg font-bold text-[var(--color-brand)] tabular-nums">
              NT${todaySettlement.receivedAmount.toLocaleString()}
            </p>
            <p className="text-[11px] text-muted-foreground tabular-nums">
              / 總額 NT${todaySettlement.totalAmount.toLocaleString()}
            </p>
          </div>
        </div>

        {todayBookings.length === 0 ? (
          <div className="px-6 py-12 text-center text-muted-foreground">
            今天沒有預約
          </div>
        ) : (
          <div className="divide-y divide-border/30">
            {todayBookings.map((booking) => {
              const payStatus = booking.payment?.status ?? "PENDING";
              const payBadge = PAYMENT_BADGE[payStatus] ?? PAYMENT_BADGE.PENDING;
              const showMarkBtn =
                payStatus !== "RECEIVED" &&
                payStatus !== "WAIVED" &&
                booking.payment?.method === "BANK_TRANSFER";
              return (
                <div
                  key={booking.id}
                  className="px-6 py-4 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="text-center min-w-[60px]">
                      <p className="text-lg font-semibold text-foreground">
                        {booking.startTime}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {booking.endTime}
                      </p>
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-foreground truncate">
                        {booking.user.displayName || "未知顧客"}
                      </p>
                      <p className="text-sm text-muted-foreground truncate">
                        {booking.service.name} · NT${booking.service.price.toLocaleString()}
                        {booking.payment?.method && (
                          <span className="ml-1 text-[11px]">
                            · {METHOD_LABEL[booking.payment.method] ?? booking.payment.method}
                            {booking.payment?.transferLastFive && ` ${booking.payment.transferLastFive}`}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-xs px-2 py-1 rounded-full ${payBadge.className}`}>
                      {payBadge.label}
                    </span>
                    <span
                      className={`text-xs px-2 py-1 rounded-full ${
                        STATUS_COLORS[booking.status] || "bg-secondary"
                      }`}
                    >
                      {STATUS_LABELS[booking.status] || booking.status}
                    </span>

                    {showMarkBtn && (
                      <button
                        onClick={() => handleMarkReceived(booking.id)}
                        disabled={markingReceived === booking.id}
                        className="text-xs px-2 py-1 bg-[var(--color-brand)] text-white rounded hover:opacity-90 disabled:opacity-50"
                      >
                        {markingReceived === booking.id ? "..." : "✓ 已收款"}
                      </button>
                    )}

                    {booking.status === "CONFIRMED" && (
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleAction(booking.id, "complete")}
                          className="text-xs px-2 py-1 bg-[var(--color-brand)]/8 text-[var(--color-brand)] rounded hover:bg-[var(--color-brand)]/10"
                        >
                          完成
                        </button>
                        <button
                          onClick={() => handleAction(booking.id, "no_show")}
                          className="text-xs px-2 py-1 bg-destructive/10 text-destructive rounded hover:bg-destructive/15"
                        >
                          未到
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-card rounded-xl border border-border p-4 min-w-0">
      <p className="text-sm text-muted-foreground whitespace-nowrap">{label}</p>
      <p className="text-2xl font-bold text-foreground mt-1 tabular-nums truncate">
        {value}
      </p>
    </div>
  );
}
