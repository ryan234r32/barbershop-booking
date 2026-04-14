"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { usePageTitle } from "@/lib/hooks/use-page-title";
import useSWR from "swr";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { BookingDetailSheet } from "@/components/admin/booking-detail-sheet";
import { NewBookingSheet } from "@/components/admin/new-booking-sheet";
import { useCalendarPolling } from "@/lib/hooks/use-calendar-polling";

// ─── Types ───
interface Booking {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  slotsOccupied: number;
  service: { name: string; price: number; slotsNeeded: number };
  user: {
    id: string;
    displayName: string | null;
    phone: string | null;
    segment: string;
    totalVisits: number;
    notes: string | null;
    lastVisitAt: string | null;
  };
}

interface MonthlySummary {
  [date: string]: { count: number; revenue: number };
}

// ─── Constants ───
const HOURS = Array.from({ length: 9 }, (_, i) => `${(11 + i).toString().padStart(2, "0")}:00`);
const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];
const SLOT_HEIGHT = 72;

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function formatDate(d: Date) {
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Taipei" });
}

function toTaipeiDate(d: Date) {
  return new Date(d.toLocaleString("en-US", { timeZone: "Asia/Taipei" }));
}

// ─── Segment Badge ───
function SegmentBadge({ segment }: { segment: string }) {
  const styles: Record<string, string> = {
    VIP: "bg-[var(--color-warning)]/15 text-[var(--color-warning)]",
    REGULAR: "bg-[var(--color-success)]/15 text-[var(--color-success)]",
    NEW: "bg-[var(--color-brand)]/10 text-[var(--color-brand)]",
    AT_RISK: "bg-[var(--color-warning)]/15 text-[var(--color-warning)]",
    LAPSED: "bg-[var(--color-danger)]/15 text-[var(--color-danger)]",
  };
  const labels: Record<string, string> = {
    VIP: "VIP",
    REGULAR: "常客",
    NEW: "新客",
    AT_RISK: "流失中",
    LAPSED: "已流失",
  };
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium tracking-wider ${styles[segment] || styles.NEW}`}
    >
      {labels[segment] || segment}
    </span>
  );
}

// ─── Main Component ───
export default function CalendarPage() {
  usePageTitle("日曆");
  const [view, setView] = useState<"day" | "week" | "month">("day");
  const [currentDate, setCurrentDate] = useState(() => toTaipeiDate(new Date()));
  const timelineRef = useRef<HTMLDivElement>(null);

  // Bottom Sheet state
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);
  const [newBookingDate, setNewBookingDate] = useState("");
  const [newBookingTime, setNewBookingTime] = useState("");
  const [newSheetOpen, setNewSheetOpen] = useState(false);

  const openBookingDetail = (b: Booking) => {
    setSelectedBooking(b);
    setDetailSheetOpen(true);
  };

  const openNewBooking = (date: string, time: string) => {
    setNewBookingDate(date);
    setNewBookingTime(time);
    setNewSheetOpen(true);
  };

  // Near-end bookings state
  const [nearEndBookings, setNearEndBookings] = useState<Set<string>>(new Set());

  // ─── Date Calculations ───
  const weekDates = useMemo(() => {
    const start = new Date(currentDate);
    const day = start.getDay();
    start.setDate(start.getDate() - (day === 0 ? 6 : day - 1)); // Monday start
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [currentDate]);

  const monthYear = useMemo(() => {
    return { year: currentDate.getFullYear(), month: currentDate.getMonth() };
  }, [currentDate]);

  // ─── Data Fetching (SWR) ───
  const dateRange = useMemo(() => {
    if (view === "day") {
      const d = formatDate(currentDate);
      return { from: d, to: d };
    }
    if (view === "week") {
      return { from: formatDate(weekDates[0]), to: formatDate(weekDates[6]) };
    }
    // month: fetch summary
    return null;
  }, [view, currentDate, weekDates]);

  const { data: bookingsData, isLoading, mutate: mutateBookings } = useSWR(
    dateRange ? `/api/bookings?from=${dateRange.from}&to=${dateRange.to}` : null,
    fetcher,
    { refreshInterval: 30000, revalidateOnFocus: true }
  );

  const monthKey = `${monthYear.year}-${String(monthYear.month + 1).padStart(2, "0")}`;
  const { data: monthData } = useSWR(
    view === "month" ? `/api/bookings/monthly-summary?month=${monthKey}` : null,
    fetcher,
    { refreshInterval: 60000 }
  );

  const bookings: Booking[] = bookingsData?.bookings || [];
  const monthlySummary: MonthlySummary = monthData?.days || {};

  // ─── Polling: new booking toast + near-end detection ───
  useCalendarPolling({
    bookings,
    isLoading,
    onNearingEnd: useCallback((b: Booking) => {
      setNearEndBookings((prev) => {
        const next = new Set(prev);
        next.add(b.id);
        return next;
      });
    }, []),
  });

  // ─── Current Time Indicator ───
  const [now, setNow] = useState(() => toTaipeiDate(new Date()));
  useEffect(() => {
    const timer = setInterval(() => setNow(toTaipeiDate(new Date())), 60000);
    return () => clearInterval(timer);
  }, []);

  // Auto-scroll to current time on day view
  useEffect(() => {
    if (view !== "day" || !timelineRef.current) return;
    const nowHour = now.getHours();
    const nowMin = now.getMinutes();
    if (nowHour >= 11 && nowHour < 20) {
      const offset = (nowHour - 11 + nowMin / 60) * SLOT_HEIGHT;
      timelineRef.current.scrollTo({ top: Math.max(0, offset - SLOT_HEIGHT * 2), behavior: "smooth" });
    } else if (nowHour < 11) {
      timelineRef.current.scrollTo({ top: 0 });
    }
  }, [view, now, currentDate]);

  // ─── Helpers ───
  const getBookingsForDate = useCallback(
    (dateStr: string) => {
      return bookings.filter(
        (b) =>
          b.date.startsWith(dateStr) &&
          b.status !== "CANCELLED" &&
          b.status !== "CANCELLED_BY_ADMIN"
      );
    },
    [bookings]
  );

  const getBookingAtSlot = useCallback(
    (dateStr: string, hour: string) => {
      return bookings.find(
        (b) =>
          b.date.startsWith(dateStr) &&
          b.startTime === hour &&
          b.status !== "CANCELLED" &&
          b.status !== "CANCELLED_BY_ADMIN"
      );
    },
    [bookings]
  );

  const isSlotOccupied = useCallback(
    (dateStr: string, hour: string) => {
      return bookings.some(
        (b) =>
          b.date.startsWith(dateStr) &&
          b.startTime <= hour &&
          b.endTime > hour &&
          b.status !== "CANCELLED" &&
          b.status !== "CANCELLED_BY_ADMIN"
      );
    },
    [bookings]
  );

  const navigate = (delta: number) => {
    const d = new Date(currentDate);
    if (view === "month") d.setMonth(d.getMonth() + delta);
    else if (view === "week") d.setDate(d.getDate() + delta * 7);
    else d.setDate(d.getDate() + delta);
    setCurrentDate(d);
  };

  const todayStr = formatDate(toTaipeiDate(new Date()));
  const isToday = (d: Date) => formatDate(d) === todayStr;

  // ─── Summary Calculations ───
  const todayBookings = getBookingsForDate(formatDate(currentDate));
  const todayRevenue = todayBookings.reduce((sum, b) => sum + (b.service?.price || 0), 0);

  // ─── Time Indicator Position ───
  const timeIndicatorTop = useMemo(() => {
    const h = now.getHours();
    const m = now.getMinutes();
    if (h < 11 || h >= 20) return null;
    return (h - 11 + m / 60) * SLOT_HEIGHT;
  }, [now]);

  // ─── Header ───
  const headerText = useMemo(() => {
    if (view === "day") {
      const wd = WEEKDAYS[currentDate.getDay()];
      return `${currentDate.getFullYear()}/${String(currentDate.getMonth() + 1).padStart(2, "0")}/${String(currentDate.getDate()).padStart(2, "0")} (${wd})`;
    }
    if (view === "week") {
      const s = weekDates[0];
      const e = weekDates[6];
      return `${s.getMonth() + 1}/${s.getDate()} — ${e.getMonth() + 1}/${e.getDate()} 週`;
    }
    return `${currentDate.getFullYear()} 年 ${currentDate.getMonth() + 1} 月`;
  }, [view, currentDate, weekDates]);

  return (
    <div className="max-w-4xl mx-auto">
      {/* Top Bar */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate(-1)} className="p-1.5 rounded-lg hover:bg-[var(--color-surface)] transition-colors">
            <ChevronLeft size={20} className="text-[var(--color-text-body)]" />
          </button>
          <h1 className="text-base font-semibold text-[var(--color-text-primary)] tracking-wide min-w-0">
            {headerText}
          </h1>
          <button onClick={() => navigate(1)} className="p-1.5 rounded-lg hover:bg-[var(--color-surface)] transition-colors">
            <ChevronRight size={20} className="text-[var(--color-text-body)]" />
          </button>
        </div>
        <button
          onClick={() => setCurrentDate(toTaipeiDate(new Date()))}
          className="text-xs font-medium text-[var(--color-brand)] border border-[var(--color-brand)] px-3 py-1.5 rounded-lg hover:bg-[var(--color-brand)]/5 transition-colors"
        >
          今天
        </button>
      </div>

      {/* View Switcher */}
      <div className="flex mb-4 border border-[var(--color-brand)] rounded-lg overflow-hidden">
        {(["day", "week", "month"] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${
              view === v
                ? "bg-[var(--color-brand)] text-[var(--color-bg)]"
                : "text-[var(--color-brand)] hover:bg-[var(--color-brand)]/5"
            }`}
          >
            {{ day: "日", week: "週", month: "月" }[v]}
          </button>
        ))}
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex justify-center py-8">
          <div className="w-6 h-6 border-2 border-[var(--color-brand)] border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* ═══ DAY VIEW ═══ */}
      {view === "day" && !isLoading && (
        <>
          {/* Near-End Banner */}
          {(() => {
            const nearEndList = todayBookings.filter((b) => nearEndBookings.has(b.id) && b.status === "CONFIRMED");
            if (nearEndList.length === 0) return null;
            return (
              <div className="bg-[var(--color-warning)]/10 border border-[var(--color-warning)]/30 rounded-lg px-4 py-3 mb-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                    {nearEndList.length === 1
                      ? `${nearEndList[0].user.displayName || "顧客"} ${nearEndList[0].service.name} 即將結束`
                      : `${nearEndList.length} 筆預約即將結束`}
                  </p>
                </div>
                <button
                  onClick={() => nearEndList[0] && openBookingDetail(nearEndList[0])}
                  className="text-xs font-medium text-[var(--color-brand)] bg-[var(--color-brand)]/10 px-3 py-1.5 rounded-lg"
                >
                  確認結案
                </button>
              </div>
            );
          })()}

          {/* Summary Strip */}
          <div className="bg-[var(--color-surface)] rounded-lg px-4 py-2.5 mb-4 flex items-center justify-between text-sm">
            <span className="font-semibold text-[var(--color-text-primary)]">
              今日 {todayBookings.length} 預約
            </span>
            <span className="text-[var(--color-text-body)]">
              預估 NT${todayRevenue.toLocaleString()}
            </span>
          </div>

          {/* Timeline */}
          <div
            ref={timelineRef}
            className="relative overflow-y-auto"
            style={{ maxHeight: "calc(100vh - 280px)" }}
          >
            {HOURS.map((hour) => {
              const dateStr = formatDate(currentDate);
              const booking = getBookingAtSlot(dateStr, hour);
              const occupied = isSlotOccupied(dateStr, hour);
              const isMultiSlotContinuation = occupied && !booking;

              // Skip rendering continuation slots — the parent booking's card
              // already extends visually to cover those rows via its height.
              if (isMultiSlotContinuation) return null;

              return (
                <div key={hour} className="flex" style={{ height: booking && booking.slotsOccupied > 1 ? SLOT_HEIGHT * booking.slotsOccupied : SLOT_HEIGHT }}>
                  <div className="w-14 shrink-0 pr-2 pt-2 text-right">
                    <span className="text-xs text-[var(--color-text-muted)] font-mono">{hour}</span>
                  </div>
                  <div className="flex-1 border-t border-[var(--color-surface)] px-1 pt-1">
                    {booking ? (
                      <div
                        onClick={() => openBookingDetail(booking)}
                        className={`rounded-lg p-3 h-full cursor-pointer transition-colors hover:opacity-90 ${
                          booking.slotsOccupied > 1
                            ? "bg-[var(--color-brand)]/10"
                            : "bg-[var(--color-surface)]"
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="min-w-0">
                            <p className="font-semibold text-[var(--color-text-primary)] text-[15px] truncate">
                              {booking.user.displayName || "顧客"}
                            </p>
                            <p className="text-sm text-[var(--color-text-body)] mt-0.5">
                              {booking.service.name}
                            </p>
                          </div>
                          <SegmentBadge segment={booking.user.segment} />
                        </div>
                      </div>
                    ) : (
                      <div
                        onClick={() => openNewBooking(formatDate(currentDate), hour)}
                        className="h-full rounded-lg border border-dashed border-[var(--color-text-muted)]/20 flex items-center justify-center cursor-pointer hover:border-[var(--color-brand)]/40 hover:bg-[var(--color-brand)]/5 transition-colors"
                      >
                        <span className="text-xs text-[var(--color-text-muted)]">點擊新增預約</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Red Time Indicator */}
            {timeIndicatorTop !== null && isToday(currentDate) && (
              <div
                className="absolute left-0 right-0 pointer-events-none z-10 flex items-center"
                style={{ top: timeIndicatorTop }}
              >
                <div className="w-2.5 h-2.5 rounded-full bg-[var(--color-danger)] ml-[42px] -mr-1.5 shrink-0" />
                <div className="flex-1 h-[2px] bg-[var(--color-danger)]" />
              </div>
            )}
          </div>

          {/* Empty state */}
          {todayBookings.length === 0 && (
            <p className="text-center text-sm text-[var(--color-text-muted)] mt-4 py-4">
              今天沒有預約，好好休息
            </p>
          )}
        </>
      )}

      {/* ═══ WEEK VIEW ═══ */}
      {view === "week" && !isLoading && (
        <>
          {/* Week summary */}
          <div className="bg-[var(--color-surface)] rounded-lg px-4 py-2.5 mb-4 flex items-center justify-between text-sm">
            <span className="font-semibold text-[var(--color-text-primary)]">
              本週 {bookings.filter((b) => b.status !== "CANCELLED" && b.status !== "CANCELLED_BY_ADMIN").length} 預約
            </span>
            <span className="text-[var(--color-text-body)]">
              NT${bookings.filter((b) => b.status !== "CANCELLED" && b.status !== "CANCELLED_BY_ADMIN").reduce((s, b) => s + (b.service?.price || 0), 0).toLocaleString()}
            </span>
          </div>

          {/* Grid */}
          <div className="overflow-x-auto rounded-lg">
            <table className="w-full border-collapse text-center">
              <thead>
                <tr>
                  <th className="w-10 p-1 text-[10px] text-[var(--color-text-muted)]" />
                  {weekDates.map((d) => {
                    const today = isToday(d);
                    return (
                      <th key={formatDate(d)} className="p-1">
                        <span className="text-[10px] text-[var(--color-text-muted)] block">
                          {WEEKDAYS[d.getDay()]}
                        </span>
                        <button
                          onClick={() => { setCurrentDate(d); setView("day"); }}
                          className={`text-xs font-semibold w-7 h-7 rounded-full inline-flex items-center justify-center transition-colors ${
                            today
                              ? "bg-[var(--color-brand)] text-[var(--color-bg)]"
                              : "text-[var(--color-text-primary)] hover:bg-[var(--color-surface)]"
                          }`}
                        >
                          {d.getDate()}
                        </button>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {HOURS.map((hour) => (
                  <tr key={hour}>
                    <td className="p-0.5 text-[10px] text-[var(--color-text-muted)] font-mono align-top pt-1">
                      {hour.slice(0, 2)}
                    </td>
                    {weekDates.map((d) => {
                      const dateStr = formatDate(d);
                      const occupied = isSlotOccupied(dateStr, hour);
                      return (
                        <td key={dateStr + hour} className="p-0.5">
                          <div
                            className={`w-full h-8 rounded transition-colors cursor-pointer ${
                              occupied
                                ? "bg-[var(--color-brand)]/25 hover:bg-[var(--color-brand)]/35"
                                : "bg-[var(--color-bg)] hover:bg-[var(--color-surface)]"
                            }`}
                            onClick={() => { setCurrentDate(d); setView("day"); }}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ═══ MONTH VIEW ═══ */}
      {view === "month" && (
        <>
          {/* Month grid */}
          <div className="mb-4">
            {/* Weekday headers */}
            <div className="grid grid-cols-7 mb-1">
              {WEEKDAYS.map((wd) => (
                <div key={wd} className="text-center text-xs font-medium text-[var(--color-text-muted)] py-1">
                  {wd}
                </div>
              ))}
            </div>

            {/* Date cells */}
            <div className="grid grid-cols-7 gap-0.5">
              {(() => {
                const { year, month } = monthYear;
                const firstDay = new Date(year, month, 1).getDay();
                const daysInMonth = new Date(year, month + 1, 0).getDate();
                const cells: React.ReactNode[] = [];

                // Empty cells before first day
                for (let i = 0; i < firstDay; i++) {
                  cells.push(<div key={`empty-${i}`} className="h-14" />);
                }

                // Day cells
                for (let day = 1; day <= daysInMonth; day++) {
                  const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                  const summary = monthlySummary[dateStr];
                  const count = summary?.count || 0;
                  const today = dateStr === todayStr;

                  // Busy bar opacity
                  const barOpacity = count === 0 ? 0 : count <= 3 ? 0.2 : count <= 6 ? 0.5 : 0.8;

                  cells.push(
                    <button
                      key={day}
                      onClick={() => { setCurrentDate(new Date(year, month, day)); setView("day"); }}
                      className={`h-14 rounded-lg flex flex-col items-center justify-center relative transition-colors hover:bg-[var(--color-surface)] ${
                        today ? "ring-2 ring-[var(--color-brand)]" : ""
                      }`}
                    >
                      <span className={`text-sm font-semibold ${today ? "text-[var(--color-brand)]" : "text-[var(--color-text-primary)]"}`}>
                        {day}
                      </span>
                      {count > 0 && (
                        <span className="text-[10px] text-[var(--color-text-body)]">{count}</span>
                      )}
                      {barOpacity > 0 && (
                        <div
                          className="absolute bottom-1 left-2 right-2 h-1 rounded-full bg-[var(--color-brand)]"
                          style={{ opacity: barOpacity }}
                        />
                      )}
                    </button>
                  );
                }

                return cells;
              })()}
            </div>
          </div>

          {/* Month summary */}
          <div className="bg-[var(--color-surface)] rounded-lg px-4 py-2.5 text-sm flex items-center justify-between">
            <span className="font-semibold text-[var(--color-text-primary)]">
              本月 {Object.values(monthlySummary).reduce((s, d) => s + d.count, 0)} 預約
            </span>
            <span className="text-[var(--color-text-body)]">
              營收 NT${Object.values(monthlySummary).reduce((s, d) => s + d.revenue, 0).toLocaleString()}
            </span>
          </div>
        </>
      )}
      {/* Bottom Sheets */}
      <BookingDetailSheet
        booking={selectedBooking}
        open={detailSheetOpen}
        onOpenChange={setDetailSheetOpen}
        onAction={() => mutateBookings()}
      />
      <NewBookingSheet
        date={newBookingDate}
        time={newBookingTime}
        open={newSheetOpen}
        onOpenChange={setNewSheetOpen}
        onCreated={() => mutateBookings()}
      />
    </div>
  );
}
