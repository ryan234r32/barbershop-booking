"use client";

import { useState, useEffect } from "react";
import { useLiff } from "@/lib/liff/provider";
import { LoadingSpinner } from "@/components/liff/loading-spinner";

interface Booking {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  notes: string | null;
  service: { name: string; duration: number; price: number };
  payment: { status: string; method: string } | null;
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  CONFIRMED: { label: "已確認", color: "bg-[var(--color-success)]/15 text-[var(--color-success)]" },
  COMPLETED: { label: "已完成", color: "bg-[var(--color-brand)]/10 text-[var(--color-brand)]" },
  CANCELLED: { label: "已取消", color: "bg-secondary text-muted-foreground" },
  NO_SHOW: { label: "未到店", color: "bg-[var(--color-danger)]/15 text-[var(--color-danger)]" },
  CANCELLED_BY_ADMIN: { label: "店家取消", color: "bg-secondary text-muted-foreground" },
};

export default function MyBookingsPage() {
  const { isReady, error, userId } = useLiff();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState<string | null>(null);

  useEffect(() => {
    if (!isReady || !userId) return;

    fetch(`/api/bookings?lineUserId=${userId}`)
      .then((r) => r.json())
      .then((data) => setBookings(data.bookings || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [isReady, userId]);

  const handleCancel = async (bookingId: string) => {
    if (!confirm("確定要取消這個預約嗎？")) return;

    setCancelling(bookingId);
    try {
      const res = await fetch(`/api/bookings/${bookingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel" }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.phoneNumber) {
          alert(`${data.error}\n\n請致電：${data.phoneNumber}`);
        } else {
          alert(data.error || "取消失敗");
        }
        return;
      }

      // Show violation warning
      if (data.cancellation?.isViolation) {
        alert("取消成功，但此次取消已記錄為一次違規。");
      }

      // Refresh list
      setBookings((prev) =>
        prev.map((b) =>
          b.id === bookingId ? { ...b, status: "CANCELLED" } : b
        )
      );
    } catch {
      alert("網路錯誤，請稍後再試");
    } finally {
      setCancelling(null);
    }
  };

  if (!isReady) return <LoadingSpinner message="正在連接..." />;
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <p className="text-[var(--color-danger)]">{error}</p>
      </div>
    );
  }
  if (loading) return <LoadingSpinner message="載入預約記錄..." />;

  const upcoming = bookings.filter((b) => b.status === "CONFIRMED");
  const past = bookings.filter((b) => b.status !== "CONFIRMED");

  return (
    <div className="max-w-md mx-auto p-4">
      <h1 className="text-xl font-semibold mb-4">我的預約</h1>

      {bookings.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">還沒有預約記錄</p>
          <a
            href="/booking"
            className="inline-block px-6 py-2.5 bg-[var(--color-brand)] text-[var(--color-bg)] rounded-lg font-medium"
          >
            立即預約
          </a>
        </div>
      ) : (
        <>
          {/* Upcoming */}
          {upcoming.length > 0 && (
            <section className="mb-6">
              <h2 className="text-sm font-medium text-muted-foreground mb-2">
                即將到來
              </h2>
              <div className="space-y-3">
                {upcoming.map((booking) => (
                  <BookingCard
                    key={booking.id}
                    booking={booking}
                    onCancel={() => handleCancel(booking.id)}
                    cancelling={cancelling === booking.id}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Past */}
          {past.length > 0 && (
            <section>
              <h2 className="text-sm font-medium text-muted-foreground mb-2">
                歷史記錄
              </h2>
              <div className="space-y-3">
                {past.map((booking) => (
                  <BookingCard key={booking.id} booking={booking} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function BookingCard({
  booking,
  onCancel,
  cancelling,
}: {
  booking: Booking;
  onCancel?: () => void;
  cancelling?: boolean;
}) {
  const dateObj = new Date(booking.date);
  const weekdays = ["日", "一", "二", "三", "四", "五", "六"];
  const displayDate = `${dateObj.getMonth() + 1}/${dateObj.getDate()} (${weekdays[dateObj.getDay()]})`;
  const status = STATUS_MAP[booking.status] || { label: booking.status, color: "bg-secondary" };

  return (
    <div className="bg-[var(--color-surface)] rounded-lg p-4">
      <div className="flex justify-between items-start mb-2">
        <h3 className="font-medium">{booking.service.name}</h3>
        <span className={`text-xs px-2 py-0.5 rounded-full ${status.color}`}>
          {status.label}
        </span>
      </div>
      <div className="text-sm text-muted-foreground space-y-0.5">
        <p>{displayDate}</p>
        <p>
          {booking.startTime} - {booking.endTime}
        </p>
        <p className="text-[var(--color-brand)] font-medium">
          NT${booking.service.price.toLocaleString()}
        </p>
      </div>

      {booking.status === "CONFIRMED" && onCancel && (
        <button
          onClick={onCancel}
          disabled={cancelling}
          className="mt-3 w-full py-2 text-sm text-[var(--color-danger)] border border-[var(--color-danger)]/30 rounded-lg hover:bg-[var(--color-danger)]/10 transition-colors disabled:opacity-50"
        >
          {cancelling ? "取消中..." : "取消預約"}
        </button>
      )}

      {booking.status === "CONFIRMED" && (
        <a
          href={`/payment/${booking.id}`}
          className="mt-2 block w-full py-2 text-sm text-center text-[var(--color-brand)] border border-[var(--color-brand)]/30 rounded-lg hover:bg-secondary transition-colors"
        >
          {booking.payment ? "查看付款" : "前往付款"}
        </a>
      )}
    </div>
  );
}
