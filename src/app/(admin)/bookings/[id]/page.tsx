"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { usePageTitle } from "@/lib/hooks/use-page-title";
import { adminHeaders } from "@/lib/auth/admin-fetch";

interface BookingDetail {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  slotsOccupied: number;
  status: string;
  source: string;
  notes: string | null;
  createdAt: string;
  service: {
    name: string;
    duration: number;
    price: number;
  };
  user: {
    displayName: string | null;
    lineUserId: string | null;
    phone: string | null;
    segment: string | null;
  };
  payment: {
    status: string;
    amount: number;
    method: string | null;
    screenshotUrl: string | null;
    receivedAt: string | null;
  } | null;
}

const STATUS_COLORS: Record<string, string> = {
  CONFIRMED: "bg-[var(--color-brand)]/10 text-[var(--color-brand)] border-[var(--color-brand)]/20",
  COMPLETED: "bg-[var(--color-success)]/15 text-[var(--color-success)] border-[var(--color-success)]/30",
  CANCELLED: "bg-destructive/15 text-destructive border-destructive/30",
  NO_SHOW: "bg-[var(--color-warning)]/15 text-[var(--color-warning)] border-[var(--color-warning)]/30",
};

const STATUS_LABELS: Record<string, string> = {
  CONFIRMED: "已確認",
  COMPLETED: "已完成",
  CANCELLED: "已取消",
  NO_SHOW: "未到店",
};

const SOURCE_LABELS: Record<string, string> = {
  LINE: "LINE 預約",
  PHONE: "電話預約",
  WALK_IN: "現場預約",
};

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  PENDING: "待付款",
  VERIFYING: "待對帳",
  RECEIVED: "已收款",
  WAIVED: "免收",
};

const SEGMENT_LABELS: Record<string, string> = {
  NEW: "新客",
  REGULAR: "常客",
  VIP: "VIP",
  INACTIVE: "沉睡客",
};

export default function BookingDetailPage() {
  usePageTitle("預約詳情");
  const params = useParams();
  const router = useRouter();
  const bookingId = params.id as string;

  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    action: string;
    label: string;
  } | null>(null);

  const fetchBooking = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch(`/api/bookings/${bookingId}`, { headers: adminHeaders() });
      if (!res.ok) {
        throw new Error(res.status === 404 ? "找不到此預約" : "載入預約資料失敗");
      }
      const data = await res.json();
      setBooking(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "發生未知錯誤");
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  useEffect(() => {
    fetchBooking();
  }, [fetchBooking]);

  const handleAction = async (action: string) => {
    setActionLoading(action);
    try {
      const res = await fetch(`/api/bookings/${bookingId}`, {
        method: "PATCH",
        headers: adminHeaders(),
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "操作失敗");
      }
      setConfirmAction(null);
      await fetchBooking();
    } catch (err) {
      alert(err instanceof Error ? err.message : "操作失敗，請稍後再試");
    } finally {
      setActionLoading(null);
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const weekdays = ["日", "一", "二", "三", "四", "五", "六"];
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}（${weekdays[d.getDay()]}）`;
  };

  const formatDateTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  // --- Loading State ---
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto" />
          <p className="mt-4 text-muted-foreground">載入中...</p>
        </div>
      </div>
    );
  }

  // --- Error State ---
  if (error || !booking) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="bg-card rounded-xl shadow-sm border p-8 max-w-md w-full text-center">
          <div className="text-destructive text-4xl mb-4">⚠</div>
          <h2 className="text-lg font-semibold text-foreground mb-2">
            {error || "找不到此預約"}
          </h2>
          <button
            onClick={() => router.push("/calendar")}
            className="mt-4 px-4 py-2 bg-secondary hover:bg-secondary rounded-lg text-sm text-foreground/80 transition-colors"
          >
            返回行事曆
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => router.push("/calendar")}
            className="p-2 hover:bg-secondary rounded-lg transition-colors"
            aria-label="返回"
          >
            <svg
              className="w-5 h-5 text-muted-foreground"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-foreground sm:text-2xl">
              預約詳情
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              #{booking.id.slice(0, 8)}
            </p>
          </div>
          <span
            className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${STATUS_COLORS[booking.status] || "bg-secondary text-foreground/80"}`}
          >
            {STATUS_LABELS[booking.status] || booking.status}
          </span>
        </div>

        {/* Service Info */}
        <section className="bg-card rounded-xl shadow-sm border p-5 mb-4">
          <h2 className="text-sm font-medium text-muted-foreground mb-3">服務項目</h2>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-lg font-semibold text-foreground">
                {booking.service.name}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {booking.service.duration} 分鐘 ・ {booking.slotsOccupied} 個時段
              </p>
            </div>
            <p className="text-xl font-bold text-foreground">
              NT${booking.service.price}
            </p>
          </div>
        </section>

        {/* Date & Time */}
        <section className="bg-card rounded-xl shadow-sm border p-5 mb-4">
          <h2 className="text-sm font-medium text-muted-foreground mb-3">
            預約時間
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">日期</p>
              <p className="text-base font-medium text-foreground mt-0.5">
                {formatDate(booking.date)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">時段</p>
              <p className="text-base font-medium text-foreground mt-0.5">
                {booking.startTime} - {booking.endTime}
              </p>
            </div>
          </div>
        </section>

        {/* Customer Info */}
        <section className="bg-card rounded-xl shadow-sm border p-5 mb-4">
          <h2 className="text-sm font-medium text-muted-foreground mb-3">顧客資訊</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">姓名</p>
              <p className="text-base font-medium text-foreground mt-0.5">
                {booking.user.displayName || "未提供"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">電話</p>
              <p className="text-base font-medium text-foreground mt-0.5">
                {booking.user.phone || "未提供"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">客群</p>
              <p className="text-base font-medium text-foreground mt-0.5">
                {booking.user.segment
                  ? SEGMENT_LABELS[booking.user.segment] || booking.user.segment
                  : "未分類"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">預約來源</p>
              <p className="text-base font-medium text-foreground mt-0.5">
                {SOURCE_LABELS[booking.source] || booking.source}
              </p>
            </div>
          </div>
        </section>

        {/* Notes */}
        {booking.notes && (
          <section className="bg-card rounded-xl shadow-sm border p-5 mb-4">
            <h2 className="text-sm font-medium text-muted-foreground mb-2">備註</h2>
            <p className="text-foreground/80 whitespace-pre-wrap">{booking.notes}</p>
          </section>
        )}

        {/* Payment */}
        <section className="bg-card rounded-xl shadow-sm border p-5 mb-4">
          <h2 className="text-sm font-medium text-muted-foreground mb-3">付款資訊</h2>
          {booking.payment ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">付款狀態</span>
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    booking.payment.status === "RECEIVED"
                      ? "bg-[var(--color-success)]/15 text-[var(--color-success)]"
                      : "bg-[var(--color-warning)]/15 text-[var(--color-warning)]"
                  }`}
                >
                  {PAYMENT_STATUS_LABELS[booking.payment.status] ||
                    booking.payment.status}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">金額</span>
                <span className="font-medium text-foreground">
                  NT${booking.payment.amount}
                </span>
              </div>
              {booking.payment.method && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">付款方式</span>
                  <span className="text-foreground">
                    {booking.payment.method === "CASH" ? "現金" : "轉帳"}
                  </span>
                </div>
              )}
              {booking.payment.status === "RECEIVED" &&
                booking.payment.receivedAt && (
                  <div className="mt-2 pt-3 border-t border-border/50">
                    <p className="text-xs text-muted-foreground">
                      確認時間：{formatDateTime(booking.payment.receivedAt)}
                    </p>
                  </div>
                )}
              {booking.payment.screenshotUrl && (
                <div className="mt-2 pt-3 border-t border-border/50">
                  <a
                    href={booking.payment.screenshotUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-[var(--color-brand)] hover:text-[var(--color-brand)] underline"
                  >
                    查看轉帳截圖
                  </a>
                </div>
              )}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">尚無付款紀錄</p>
          )}
        </section>

        {/* Booking History */}
        <section className="bg-card rounded-xl shadow-sm border p-5 mb-4">
          <h2 className="text-sm font-medium text-muted-foreground mb-3">預約紀錄</h2>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 rounded-full bg-gray-400 mt-1.5 shrink-0" />
              <div>
                <p className="text-sm text-foreground/80">建立預約</p>
                <p className="text-xs text-muted-foreground">
                  {formatDateTime(booking.createdAt)}
                </p>
              </div>
            </div>
            {booking.status === "COMPLETED" && (
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-green-500 mt-1.5 shrink-0" />
                <div>
                  <p className="text-sm text-foreground/80">服務完成</p>
                </div>
              </div>
            )}
            {booking.status === "CANCELLED" && (
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-destructive/100 mt-1.5 shrink-0" />
                <div>
                  <p className="text-sm text-foreground/80">預約已取消</p>
                </div>
              </div>
            )}
            {booking.status === "NO_SHOW" && (
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-[var(--color-warning)] mt-1.5 shrink-0" />
                <div>
                  <p className="text-sm text-foreground/80">顧客未到店</p>
                </div>
              </div>
            )}
            {booking.payment?.status === "CONFIRMED" &&
              booking.payment.receivedAt && (
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-green-500 mt-1.5 shrink-0" />
                  <div>
                    <p className="text-sm text-foreground/80">付款已確認</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(booking.payment.receivedAt)}
                    </p>
                  </div>
                </div>
              )}
          </div>
        </section>

        {/* Action Buttons */}
        {booking.status === "CONFIRMED" && (
          <section className="bg-card rounded-xl shadow-sm border p-5 mb-4">
            <h2 className="text-sm font-medium text-muted-foreground mb-3">操作</h2>

            {/* Confirmation Dialog */}
            {confirmAction && (
              <div className="mb-4 p-4 bg-[var(--color-warning)]/10 border border-[var(--color-warning)]/30 rounded-lg">
                <p className="text-sm text-[var(--color-warning)] mb-3">
                  確定要「{confirmAction.label}」嗎？此操作無法復原。
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleAction(confirmAction.action)}
                    disabled={actionLoading !== null}
                    className="px-4 py-2 bg-[var(--color-warning)] hover:bg-[var(--color-warning)]/90 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                  >
                    {actionLoading === confirmAction.action
                      ? "處理中..."
                      : "確認"}
                  </button>
                  <button
                    onClick={() => setConfirmAction(null)}
                    disabled={actionLoading !== null}
                    className="px-4 py-2 bg-secondary hover:bg-secondary text-foreground/80 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                  >
                    取消
                  </button>
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() =>
                  setConfirmAction({ action: "complete", label: "標記完成" })
                }
                disabled={actionLoading !== null}
                className="flex-1 px-4 py-2.5 bg-[var(--color-success)] hover:bg-[var(--color-success)]/90 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                標記完成
              </button>
              <button
                onClick={() =>
                  setConfirmAction({ action: "no_show", label: "標記未到" })
                }
                disabled={actionLoading !== null}
                className="flex-1 px-4 py-2.5 bg-[var(--color-warning)] hover:bg-[var(--color-warning)]/90 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                標記未到
              </button>
              <button
                onClick={() =>
                  setConfirmAction({
                    action: "admin_cancel",
                    label: "取消預約",
                  })
                }
                disabled={actionLoading !== null}
                className="flex-1 px-4 py-2.5 bg-destructive/100 hover:bg-destructive/90 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                取消預約
              </button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
