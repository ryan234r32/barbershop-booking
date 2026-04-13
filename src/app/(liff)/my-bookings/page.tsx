"use client";

import { useState, useEffect } from "react";
import { useLiff } from "@/lib/liff/provider";
import { useToast } from "@/components/ui/toast";
import { IconClose, IconCalendar, IconClock } from "@/components/liff/icons";

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

const STATUS_BADGE: Record<string, { label: string; style: string }> = {
  CONFIRMED: {
    label: "即將到來",
    style: "bg-[#003D2B] text-[#FFF8F1]",
  },
  COMPLETED: {
    label: "已完成",
    style: "bg-[#003D2B]/10 text-[#003D2B]",
  },
  CANCELLED: {
    label: "已取消",
    style: "bg-[#003D2B]/10 text-[#003D2B]/60",
  },
  NO_SHOW: {
    label: "未到店",
    style: "bg-[#A84A3B]/10 text-[#A84A3B]",
  },
  CANCELLED_BY_ADMIN: {
    label: "店家取消",
    style: "bg-[#003D2B]/10 text-[#003D2B]/60",
  },
};

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}/${d.getDate()} (週${WEEKDAYS[d.getDay()]})`;
}

export default function MyBookingsPage() {
  const { isReady, error, userId, liff } = useLiff();
  const { toast } = useToast();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"upcoming" | "history">("upcoming");

  useEffect(() => {
    if (!isReady || !userId) return;

    fetch(`/api/bookings?lineUserId=${userId}`)
      .then((r) => r.json())
      .then((data) => setBookings(data.bookings || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [isReady, userId]);

  const handleCancel = async (bookingId: string) => {
    if (!window.confirm("確定要取消這個預約嗎？")) return;

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
          toast({ message: `${data.error}\n請致電：${data.phoneNumber}`, type: "error" });
        } else {
          toast({ message: data.error || "取消失敗", type: "error" });
        }
        return;
      }

      if (data.cancellation?.isViolation) {
        toast({ message: "取消成功，但此次取消已記錄為一次違規", type: "info" });
      } else {
        toast({ message: "預約已取消", type: "success" });
      }

      setBookings((prev) =>
        prev.map((b) =>
          b.id === bookingId ? { ...b, status: "CANCELLED" } : b
        )
      );
    } catch {
      toast({ message: "網路錯誤，請稍後再試", type: "error" });
    } finally {
      setCancelling(null);
    }
  };

  const upcoming = bookings.filter((b) => b.status === "CONFIRMED");
  const history = bookings.filter((b) =>
    ["COMPLETED", "CANCELLED", "NO_SHOW", "CANCELLED_BY_ADMIN"].includes(b.status)
  );
  const currentList = activeTab === "upcoming" ? upcoming : history;

  // --- Error state ---
  if (!isReady && error) {
    return (
      <div className="min-h-screen bg-[#FFF8F1] flex items-center justify-center p-6">
        <p className="text-[#A84A3B] text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FFF8F1]" style={{ fontFamily: "'Manrope', 'Noto Sans TC', sans-serif" }}>
      {/* Fixed header */}
      <header className="fixed top-0 w-full z-50 bg-[#FFF8F1]/80 backdrop-blur-xl">
        <div className="flex items-center justify-between px-6 h-16">
          <h1 className="text-xl font-bold text-[#003D2B] tracking-tight">我的預約</h1>
          <button
            onClick={() => liff?.closeWindow()}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-[#F3ECE4] transition-colors"
          >
            <IconClose className="w-5 h-5 text-[#003D2B]" />
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="pt-20 px-6 pb-12 max-w-md mx-auto">
        {/* Tab bar */}
        <div className="flex space-x-8 mb-10">
          <button
            onClick={() => setActiveTab("upcoming")}
            className={`pb-2 text-base transition-colors ${
              activeTab === "upcoming"
                ? "text-[#003D2B] font-bold border-b-2 border-[#003D2B]"
                : "text-[#404944]/60 font-medium"
            }`}
          >
            即將到來
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`pb-2 text-base transition-colors ${
              activeTab === "history"
                ? "text-[#003D2B] font-bold border-b-2 border-[#003D2B]"
                : "text-[#404944]/60 font-medium"
            }`}
          >
            歷史記錄
          </button>
        </div>

        {/* Loading skeleton */}
        {(loading || !isReady) && (
          <div className="space-y-8">
            {[1, 2].map((i) => (
              <div key={i} className="bg-[#F3ECE4] rounded-lg p-6 h-48 animate-pulse" />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && isReady && currentList.length === 0 && (
          <div className="flex items-center justify-center py-24">
            <p className="text-[#003D2B]/40 text-sm font-medium tracking-wide">
              目前沒有預約記錄
            </p>
          </div>
        )}

        {/* Booking cards */}
        {!loading && isReady && currentList.length > 0 && (
          <div className="space-y-8">
            {currentList.map((booking) => {
              const badge = STATUS_BADGE[booking.status] || {
                label: booking.status,
                style: "bg-[#003D2B]/10 text-[#003D2B]",
              };
              const isUpcoming = booking.status === "CONFIRMED";

              return (
                <article
                  key={booking.id}
                  className="bg-[#F3ECE4] rounded-lg p-6 flex flex-col space-y-6 relative overflow-hidden"
                >
                  {/* Left color bar */}
                  <div
                    className={`absolute top-0 left-0 w-1 h-full ${
                      isUpcoming ? "bg-[#003D2B]" : "bg-[#003D2B]/20"
                    }`}
                  />

                  {/* Status badge + service name + price */}
                  <div className="pl-2">
                    <span
                      className={`inline-block text-[0.65rem] font-bold px-2 py-0.5 rounded tracking-widest uppercase ${badge.style}`}
                    >
                      {badge.label}
                    </span>
                    <div className="flex items-start justify-between mt-2">
                      <h3 className="text-2xl font-bold text-[#003D2B] tracking-tight">
                        {booking.service.name}
                      </h3>
                      <span className="text-xl font-bold text-[#1a503c] shrink-0 ml-4">
                        NT${booking.service.price.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {/* Info section */}
                  <div className="border-t border-[#c0c9c2]/20 py-6 flex flex-wrap gap-y-4 gap-x-10 pl-2">
                    {/* Date */}
                    <div className="flex items-start gap-3">
                      <IconCalendar className="w-5 h-5 text-[#003D2B]/60 mt-0.5" />
                      <div>
                        <p className="text-[0.7rem] text-[#003D2B]/40 font-bold uppercase tracking-widest">
                          日期
                        </p>
                        <p className="font-bold text-[#1e1b17] mt-0.5">
                          {formatDate(booking.date)}
                        </p>
                      </div>
                    </div>
                    {/* Time */}
                    <div className="flex items-start gap-3">
                      <IconClock className="w-5 h-5 text-[#003D2B]/60 mt-0.5" />
                      <div>
                        <p className="text-[0.7rem] text-[#003D2B]/40 font-bold uppercase tracking-widest">
                          時間
                        </p>
                        <p className="font-bold text-[#1e1b17] mt-0.5">
                          {booking.startTime} — {booking.endTime}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Action buttons (upcoming only) */}
                  {isUpcoming && (
                    <div className="pl-2 space-y-3">
                      <div className="flex space-x-3">
                        <button
                          onClick={() => handleCancel(booking.id)}
                          disabled={cancelling === booking.id}
                          className="flex-1 py-3 text-[0.75rem] font-bold tracking-[0.1em] border-[1.5px] border-[#C88B3B]/40 text-[#C88B3B] uppercase rounded disabled:opacity-50 transition-colors hover:bg-[#C88B3B]/5"
                        >
                          {cancelling === booking.id ? "取消中..." : "取消"}
                        </button>
                      </div>
                      <a
                        href={`/payment/${booking.id}`}
                        className="block w-full py-4 bg-[#003D2B] text-[#FFF8F1] text-[0.8rem] font-bold tracking-[0.15em] text-center rounded transition-colors hover:bg-[#003D2B]/90"
                      >
                        前往付款
                      </a>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}

        <div className="text-center py-8 text-sm text-[#003D2B]/50">
          <p>需要協助？</p>
          <a href="tel:02-2396-2306" className="text-[#003D2B] font-semibold underline underline-offset-2">
            02-2396-2306
          </a>
        </div>
      </main>
    </div>
  );
}
