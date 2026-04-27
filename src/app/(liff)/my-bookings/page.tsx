"use client";

import { useState, useEffect } from "react";
import { useLiff } from "@/lib/liff/provider";
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
  PAST_DUE: {
    label: "待結算",
    style: "bg-[#C88B3B]/15 text-[#8B4513]",
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

const PAYMENT_BADGE: Record<string, { label: string; style: string }> = {
  RECEIVED: { label: "已付款", style: "bg-[#1a503c]/10 text-[#1a503c]" },
  VERIFYING: { label: "核對中", style: "bg-[#C88B3B]/15 text-[#8B4513]" },
  PENDING: { label: "待付款", style: "bg-[#A84A3B]/10 text-[#A84A3B]" },
  WAIVED: { label: "免付款", style: "bg-[#003D2B]/10 text-[#003D2B]/60" },
};

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}/${d.getDate()} (週${WEEKDAYS[d.getDay()]})`;
}

const CACHE_KEY = "my-bookings:cache:v1";
const CACHE_TTL_MS = 5 * 60_000; // 5 minutes — stale-while-revalidate

interface CachedBookings {
  ts: number;
  userId: string;
  bookings: Booking[];
}

function readCache(userId: string): Booking[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedBookings;
    if (parsed.userId !== userId) return null;
    if (Date.now() - parsed.ts > CACHE_TTL_MS) return null;
    return parsed.bookings;
  } catch {
    return null;
  }
}

function writeCache(userId: string, bookings: Booking[]): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ ts: Date.now(), userId, bookings } satisfies CachedBookings),
    );
  } catch {
    /* quota exceeded — silent */
  }
}

export default function MyBookingsPage() {
  const { isReady, error, userId, liff, cachedIdToken } = useLiff();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"upcoming" | "history">("upcoming");

  // Stale-while-revalidate: paint cached bookings instantly, then refetch in background.
  // Combined with LiffProvider's sessionStorage cache, this means the second visit
  // in the same LINE session paints in <100ms (cache hit) instead of 2-5s (LIFF init).
  //
  // setState within effect is intentional for SWR — cached data is the synchronous
  // optimistic paint, fetch result overwrites with fresh data.
  useEffect(() => {
    if (!userId) return; // need user identity, but don't block on isReady

    const cached = readCache(userId);
    if (cached) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- SWR optimistic paint
      setBookings(cached);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- SWR optimistic paint
      setLoading(false);
    }

    // Use cachedIdToken (sessionStorage from previous LIFF init) so we can fetch
    // BEFORE the SDK fully boots. Fall back to live SDK if no cache.
    const idToken = cachedIdToken || liff?.getIDToken?.() || "";
    if (!idToken) return; // wait for LIFF init to provide token

    fetch(`/api/bookings`, {
      headers: { "X-LIFF-ID-Token": idToken },
    })
      .then((r) => r.json())
      .then((data) => {
        const next = data.bookings || [];
        setBookings(next);
        writeCache(userId, next);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [isReady, userId, liff, cachedIdToken]);

  const liffBaseUrl = typeof window !== "undefined"
    ? `https://liff.line.me/${process.env.NEXT_PUBLIC_LIFF_ID}`
    : "";

  // Prisma @db.Date serializes to full ISO string (e.g. "2026-04-14T00:00:00.000Z"),
  // not "YYYY-MM-DD". Slice to the date portion before composing Taipei datetime.
  const now = new Date();
  const isPastEnd = (b: Booking) => {
    const dateOnly = b.date.slice(0, 10);
    const bookingEnd = new Date(`${dateOnly}T${b.endTime}:00+08:00`);
    return bookingEnd <= now;
  };

  const upcoming = bookings.filter(
    (b) => b.status === "CONFIRMED" && !isPastEnd(b),
  );
  // History = settled statuses OR past-due CONFIRMED (admin hasn't marked it yet).
  const history = bookings.filter(
    (b) =>
      ["COMPLETED", "CANCELLED", "NO_SHOW", "CANCELLED_BY_ADMIN"].includes(b.status) ||
      (b.status === "CONFIRMED" && isPastEnd(b)),
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
              const isPastDue = booking.status === "CONFIRMED" && isPastEnd(booking);
              const badgeKey = isPastDue ? "PAST_DUE" : booking.status;
              const badge = STATUS_BADGE[badgeKey] || {
                label: booking.status,
                style: "bg-[#003D2B]/10 text-[#003D2B]",
              };
              const isUpcoming = booking.status === "CONFIRMED" && !isPastDue;
              const paymentBadge = booking.payment?.status
                ? PAYMENT_BADGE[booking.payment.status]
                : null;
              // 2026-04-27: paymentPicked / paymentReceived 已移除 — 「前往付款」流程裁掉，
              // 客人改用 Rich Menu「匯款資訊」處理。

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
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`inline-block text-[0.65rem] font-bold px-2 py-0.5 rounded tracking-widest uppercase ${badge.style}`}
                      >
                        {badge.label}
                      </span>
                      {paymentBadge && (
                        <span
                          className={`inline-block text-[0.65rem] font-bold px-2 py-0.5 rounded tracking-widest ${paymentBadge.style}`}
                        >
                          {paymentBadge.label}
                        </span>
                      )}
                    </div>
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
                      {/* Reschedule > Cancel > Payment — "改期優先於取消" */}
                      <div className="flex space-x-3">
                        <a
                          href={`${liffBaseUrl}/reschedule/${booking.id}`}
                          className="flex-1 py-3 text-[0.75rem] font-bold tracking-[0.1em] text-[#003D2B] underline underline-offset-2 text-center"
                        >
                          改期
                        </a>
                        <a
                          href={`${liffBaseUrl}/cancel/${booking.id}`}
                          className="flex-1 py-3 text-[0.75rem] font-bold tracking-[0.1em] text-[#C88B3B] text-center"
                        >
                          取消
                        </a>
                      </div>
                      {/* 2026-04-27: 「前往付款」按鈕已移除 — 客人於到店後用 Rich Menu「匯款資訊」一鍵複製帳號 + 傳末五碼即可。 */}
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
