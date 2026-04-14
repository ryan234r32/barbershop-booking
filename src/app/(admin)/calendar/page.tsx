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
  payment?: { status: string; method: string | null } | null;
  createdAt?: string;
}

function isPaid(b: Booking): boolean {
  return b.payment?.status === "RECEIVED";
}

/** Returns the card background class based on completion/payment status. */
function cardBgClass(b: Booking): string {
  if (b.status === "COMPLETED" || isPaid(b)) {
    return "bg-[var(--color-success)]/15"; // paid / completed — moss green
  }
  if (b.slotsOccupied > 1) {
    return "bg-[var(--color-brand)]/10"; // multi-slot unpaid — subtle brand tint
  }
  return "bg-[var(--color-surface)]"; // single-slot unpaid — sand
}

interface MonthlySummary {
  [date: string]: { count: number; revenue: number };
}

// ─── Constants ───
const HOURS = Array.from({ length: 9 }, (_, i) => `${(11 + i).toString().padStart(2, "0")}:00`);
const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];
const SLOT_HEIGHT = 96;

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
      className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium tracking-wider ${styles[segment] || styles.NEW}`}
    >
      {labels[segment] || segment}
    </span>
  );
}

// ─── Horizontal Date Strip (smooth scroll + tap to select) ───
function HorizontalDateStrip({
  currentDate,
  onSelect,
}: {
  currentDate: Date;
  onSelect: (d: Date) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const DAYS_BEFORE = 30;
  const DAYS_AFTER = 30;
  const VISIBLE_DAYS = 7;

  // Dynamic cell width — divide container width by 7 so exactly 7 days fit
  const [cellWidth, setCellWidth] = useState(52);
  useEffect(() => {
    const update = () => {
      const el = containerRef.current;
      if (!el || el.clientWidth <= 0) return;
      setCellWidth(Math.floor(el.clientWidth / VISIBLE_DAYS));
    };
    update();
    // Re-measure on resize
    window.addEventListener("resize", update);
    // Also re-measure on next frame to catch initial layout
    const raf = requestAnimationFrame(update);
    return () => {
      window.removeEventListener("resize", update);
      cancelAnimationFrame(raf);
    };
  }, []);

  // Generate strip dates: 30 before + current + 30 after = 61 days
  const dates = useMemo(() => {
    const list: Date[] = [];
    for (let offset = -DAYS_BEFORE; offset <= DAYS_AFTER; offset++) {
      const d = new Date(currentDate);
      d.setDate(d.getDate() + offset);
      list.push(d);
    }
    return list;
  }, [currentDate]);

  // Center the selected date in the visible 7-day window
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const selectedIndex = DAYS_BEFORE;
    const targetScroll =
      selectedIndex * cellWidth - container.clientWidth / 2 + cellWidth / 2;
    container.scrollTo({ left: Math.max(0, targetScroll), behavior: "auto" });
  }, [currentDate, cellWidth]);

  const todayStr = formatDate(toTaipeiDate(new Date()));
  const currentStr = formatDate(currentDate);

  return (
    <div
      ref={containerRef}
      className="flex items-stretch mb-3 select-none overflow-x-auto scrollbar-hide pb-1 w-full"
      style={{ WebkitOverflowScrolling: "touch" }}
    >
      {dates.map((d) => {
        const dStr = formatDate(d);
        const selected = dStr === currentStr;
        const isToday = dStr === todayStr;
        const wdIndex = d.getDay();
        const isWeekend = wdIndex === 0 || wdIndex === 6;
        return (
          <button
            key={dStr}
            onClick={() => onSelect(d)}
            className={`shrink-0 flex flex-col items-center gap-0.5 py-2 rounded-lg transition-colors ${
              selected
                ? "bg-[var(--color-brand)]"
                : "hover:bg-[var(--color-surface)]"
            }`}
            style={{ width: cellWidth }}
          >
            <span
              className={`text-[11px] leading-none ${
                selected
                  ? "text-[var(--color-bg)]/80"
                  : isWeekend
                    ? "text-[var(--color-danger)]"
                    : "text-[var(--color-text-muted)]"
              }`}
            >
              {WEEKDAYS[wdIndex]}
            </span>
            <span
              className={`text-[15px] font-semibold leading-tight ${
                selected
                  ? "text-[var(--color-bg)]"
                  : isWeekend
                    ? "text-[var(--color-danger)]"
                    : "text-[var(--color-text-primary)]"
              }`}
            >
              {d.getDate()}
            </span>
            {isToday && !selected && (
              <span className="w-1 h-1 rounded-full bg-[var(--color-brand)]" />
            )}
          </button>
        );
      })}
    </div>
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
  const [newBookingDuration, setNewBookingDuration] = useState(1);
  const [newSheetOpen, setNewSheetOpen] = useState(false);

  const openBookingDetail = (b: Booking) => {
    setSelectedBooking(b);
    setDetailSheetOpen(true);
  };

  const openNewBooking = (date: string, time: string, duration: number = 1) => {
    setNewBookingDate(date);
    setNewBookingTime(time);
    setNewBookingDuration(duration);
    setNewSheetOpen(true);
  };

  // Near-end bookings state
  const [nearEndBookings, setNearEndBookings] = useState<Set<string>>(new Set());

  // Drag-to-create state
  const [dragState, setDragState] = useState<{
    startHour: number;
    endHour: number; // exclusive — end time shown to user
    active: boolean;
  } | null>(null);

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
    // month: fetch full month of bookings (for mini time bars)
    const { year, month } = monthYear;
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    return { from: formatDate(firstDay), to: formatDate(lastDay) };
  }, [view, currentDate, weekDates, monthYear]);

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

  // Memoize the bookings array so downstream useCallback dependencies don't
  // change identity on every render. Without this, getBookingsForDate/Time/etc
  // re-allocate every render, cascading grid re-renders and feeling janky.
  const bookings: Booking[] = useMemo(
    () => bookingsData?.bookings || [],
    [bookingsData]
  );
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

  // ─── Drag-to-create logic ───
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragStartPosRef = useRef<{ x: number; y: number } | null>(null);

  const findMaxEndHour = useCallback(
    (startHour: number): number => {
      const dateStr = formatDate(currentDate);
      for (let h = startHour + 1; h <= 20; h++) {
        if (h === 20) return 20;
        const hourStr = `${String(h).padStart(2, "0")}:00`;
        if (isSlotOccupied(dateStr, hourStr)) return h;
      }
      return 20;
    },
    [currentDate, isSlotOccupied]
  );

  const yToHour = useCallback((y: number): number => {
    const row = Math.floor(y / SLOT_HEIGHT);
    return Math.max(11, Math.min(20, 11 + row));
  }, []);

  // Gesture state: three exclusive modes on empty slots — tap, scroll-forward, drag-to-extend.
  // Slot keeps touch-action: none permanently (iOS Safari ignores mid-gesture changes),
  // so we forward vertical movement to the timeline's scrollTop ourselves.
  const dragModeActiveRef = useRef(false);
  const scrollModeActiveRef = useRef(false);
  const lastPointerYRef = useRef<number>(0);
  // Simple velocity tracker for scroll momentum after release
  const velocitySamplesRef = useRef<Array<{ y: number; t: number }>>([]);
  const momentumRafRef = useRef<number | null>(null);

  const LONG_PRESS_MS = 500;
  const MOVE_THRESHOLD_PX = 15;

  const cancelMomentum = useCallback(() => {
    if (momentumRafRef.current !== null) {
      cancelAnimationFrame(momentumRafRef.current);
      momentumRafRef.current = null;
    }
  }, []);

  const handleSlotPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>, startHour: number) => {
      const dateStr = formatDate(currentDate);
      const hourStr = `${String(startHour).padStart(2, "0")}:00`;
      if (isSlotOccupied(dateStr, hourStr)) return;

      cancelMomentum();

      const target = e.currentTarget;
      try {
        target.setPointerCapture(e.pointerId);
      } catch {
        // silent
      }

      dragStartPosRef.current = { x: e.clientX, y: e.clientY };
      lastPointerYRef.current = e.clientY;
      velocitySamplesRef.current = [{ y: e.clientY, t: performance.now() }];
      dragModeActiveRef.current = false;
      scrollModeActiveRef.current = false;

      longPressTimerRef.current = setTimeout(() => {
        dragModeActiveRef.current = true;
        setDragState({ startHour, endHour: startHour + 1, active: true });
        if ("vibrate" in navigator) navigator.vibrate?.(30);
      }, LONG_PRESS_MS);
    },
    [currentDate, isSlotOccupied, cancelMomentum]
  );

  const handleSlotPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>, startHour: number) => {
      // Drag mode: extend duration
      if (dragModeActiveRef.current) {
        if (timelineRef.current) {
          e.preventDefault();
          const rect = timelineRef.current.getBoundingClientRect();
          const y = e.clientY - rect.top + timelineRef.current.scrollTop;
          const hour = yToHour(y);
          const maxEnd = findMaxEndHour(startHour);
          const newEnd = Math.max(startHour + 1, Math.min(maxEnd, hour + 1));
          setDragState((prev) => {
            if (!prev || prev.endHour === newEnd) return prev;
            return { ...prev, endHour: newEnd };
          });
        }
        return;
      }

      // Scroll forwarding mode: translate finger delta into timeline scrollTop
      if (scrollModeActiveRef.current) {
        if (timelineRef.current) {
          const dy = e.clientY - lastPointerYRef.current;
          timelineRef.current.scrollTop -= dy;
          lastPointerYRef.current = e.clientY;
          // Track velocity (keep last 100ms of samples)
          const now = performance.now();
          velocitySamplesRef.current.push({ y: e.clientY, t: now });
          velocitySamplesRef.current = velocitySamplesRef.current.filter((s) => now - s.t <= 100);
        }
        return;
      }

      // Pre-decision: exceeded move threshold → enter scroll mode
      if (longPressTimerRef.current && dragStartPosRef.current) {
        const dx = Math.abs(e.clientX - dragStartPosRef.current.x);
        const dy = Math.abs(e.clientY - dragStartPosRef.current.y);
        if (dx > MOVE_THRESHOLD_PX || dy > MOVE_THRESHOLD_PX) {
          clearTimeout(longPressTimerRef.current);
          longPressTimerRef.current = null;
          scrollModeActiveRef.current = true;
          lastPointerYRef.current = e.clientY;
        }
      }
    },
    [findMaxEndHour, yToHour]
  );

  const runMomentum = useCallback(() => {
    const samples = velocitySamplesRef.current;
    if (samples.length < 2 || !timelineRef.current) return;
    const first = samples[0];
    const last = samples[samples.length - 1];
    const dt = last.t - first.t;
    if (dt <= 0) return;
    let velocity = -(last.y - first.y) / dt; // px per ms, positive = scroll down
    if (Math.abs(velocity) < 0.3) return; // below noise floor

    const friction = 0.95;
    let lastTime = performance.now();
    const tick = () => {
      if (!timelineRef.current) return;
      const now = performance.now();
      const frameDt = now - lastTime;
      lastTime = now;
      timelineRef.current.scrollTop += velocity * frameDt;
      velocity *= Math.pow(friction, frameDt / 16);
      if (Math.abs(velocity) > 0.05) {
        momentumRafRef.current = requestAnimationFrame(tick);
      } else {
        momentumRafRef.current = null;
      }
    };
    momentumRafRef.current = requestAnimationFrame(tick);
  }, []);

  const handleSlotPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>, startHour: number) => {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // silent
      }

      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
      dragStartPosRef.current = null;

      // Scroll mode: add momentum, don't open sheet
      if (scrollModeActiveRef.current) {
        scrollModeActiveRef.current = false;
        runMomentum();
        return;
      }

      // Drag mode: open sheet with extended duration
      if (dragModeActiveRef.current && dragState?.active) {
        const duration = dragState.endHour - dragState.startHour;
        const timeStr = `${String(dragState.startHour).padStart(2, "0")}:00`;
        dragModeActiveRef.current = false;
        setDragState(null);
        openNewBooking(formatDate(currentDate), timeStr, duration);
        return;
      }

      // Quick tap → 1h
      dragModeActiveRef.current = false;
      setDragState(null);
      const timeStr = `${String(startHour).padStart(2, "0")}:00`;
      openNewBooking(formatDate(currentDate), timeStr, 1);
    },
    [dragState, currentDate, runMomentum]
  );

  const handleSlotPointerCancel = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    dragStartPosRef.current = null;
    dragModeActiveRef.current = false;
    scrollModeActiveRef.current = false;
    setDragState(null);
  }, []);

  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
      if (momentumRafRef.current !== null) cancelAnimationFrame(momentumRafRef.current);
    };
  }, []);

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

      {/* View Switcher — 3 equal buttons */}
      <div className="grid grid-cols-3 mb-4 border border-[var(--color-brand)] rounded-lg overflow-hidden w-full">
        {(["day", "week", "month"] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`py-2 text-sm font-medium transition-colors min-w-0 ${
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
          {/* Horizontal date strip — smooth scroll, tap to select */}
          <HorizontalDateStrip
            currentDate={currentDate}
            onSelect={setCurrentDate}
          />

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
            style={{ maxHeight: "calc(100vh - 280px)", touchAction: "pan-y" }}
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
                        className={`rounded-lg p-3 h-full cursor-pointer transition-colors hover:opacity-90 flex flex-col ${cardBgClass(booking)}`}
                      >
                        {/* Time range */}
                        <p className="text-[11px] text-[var(--color-text-muted)] font-mono mb-1">
                          {booking.startTime} - {booking.endTime}
                        </p>

                        {/* Customer name + segment */}
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-semibold text-[var(--color-text-primary)] text-[16px] leading-tight truncate flex-1">
                            {booking.user.displayName || "顧客"}
                          </p>
                          <SegmentBadge segment={booking.user.segment} />
                        </div>

                        {/* Service pill + paid indicator */}
                        <div className="mt-auto flex items-center gap-2 pt-2">
                          <span className="inline-block px-2 py-0.5 rounded bg-[var(--color-bg)]/60 text-[var(--color-text-body)] text-[11px] font-medium">
                            {booking.service.name}
                          </span>
                          {isPaid(booking) && (
                            <span className="inline-flex items-center gap-0.5 text-[11px] font-medium text-[var(--color-success)]">
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12"/>
                              </svg>
                              已付款
                            </span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div
                        onPointerDown={(e) => handleSlotPointerDown(e, parseInt(hour.split(":")[0]))}
                        onPointerMove={(e) => handleSlotPointerMove(e, parseInt(hour.split(":")[0]))}
                        onPointerUp={(e) => handleSlotPointerUp(e, parseInt(hour.split(":")[0]))}
                        onPointerCancel={handleSlotPointerCancel}
                        style={{ touchAction: "none" }}
                        className="h-full rounded-lg border border-dashed border-[var(--color-text-muted)]/20 flex items-center justify-center cursor-pointer hover:border-[var(--color-brand)]/40 hover:bg-[var(--color-brand)]/5 transition-colors select-none"
                      >
                        <span className="text-xs text-[var(--color-text-muted)]">點擊新增・長按拖拉</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Red Time Indicator (current time) */}
            {timeIndicatorTop !== null && isToday(currentDate) && (
              <>
                {/* Time label on left */}
                <div
                  className="absolute left-0 pointer-events-none z-10 w-14 pr-2 text-right"
                  style={{ top: timeIndicatorTop - 8 }}
                >
                  <span className="text-xs font-semibold text-[var(--color-danger)] font-mono">
                    {String(now.getHours()).padStart(2, "0")}:{String(now.getMinutes()).padStart(2, "0")}
                  </span>
                </div>
                {/* Red horizontal line */}
                <div
                  className="absolute left-14 right-0 h-px bg-[var(--color-danger)] pointer-events-none z-10"
                  style={{ top: timeIndicatorTop }}
                />
              </>
            )}

            {/* Drag Preview Overlay */}
            {dragState?.active && (
              <div
                className="absolute left-[56px] right-1 pointer-events-none z-20 rounded-lg bg-[var(--color-brand)]/30 border-2 border-[var(--color-brand)] flex items-center justify-center"
                style={{
                  top: (dragState.startHour - 11) * SLOT_HEIGHT,
                  height: (dragState.endHour - dragState.startHour) * SLOT_HEIGHT,
                }}
              >
                <span className="text-sm font-bold text-[var(--color-brand)] bg-[var(--color-bg)] px-3 py-1 rounded-full shadow-md">
                  {dragState.endHour - dragState.startHour} 小時
                </span>
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
          {/* Compact summary — single line */}
          <div className="text-[11px] text-[var(--color-text-muted)] mb-2 flex items-center justify-between">
            <span>
              本週 <span className="font-semibold text-[var(--color-text-primary)]">
                {bookings.filter((b) => b.status !== "CANCELLED" && b.status !== "CANCELLED_BY_ADMIN").length}
              </span> 預約
            </span>
            <span>
              NT$<span className="font-semibold text-[var(--color-text-primary)]">
                {bookings.filter((b) => b.status !== "CANCELLED" && b.status !== "CANCELLED_BY_ADMIN").reduce((s, b) => s + (b.service?.price || 0), 0).toLocaleString()}
              </span>
            </span>
          </div>

          {/* Scrollable grid — Fresha/夯客 style */}
          <div className="rounded-lg overflow-y-auto relative" style={{ maxHeight: "calc(100vh - 260px)" }}>
            <table className="w-full border-collapse" style={{ tableLayout: "fixed" }}>
              <thead className="sticky top-0 bg-[var(--color-bg)] z-10 shadow-sm">
                <tr>
                  <th className="w-8 p-0" />
                  {weekDates.map((d) => {
                    const today = isToday(d);
                    const wdIndex = d.getDay();
                    const isWeekend = wdIndex === 0 || wdIndex === 6;
                    return (
                      <th key={formatDate(d)} className="p-1 pb-1.5 text-center">
                        <button
                          onClick={() => { setCurrentDate(d); setView("day"); }}
                          className="flex flex-col items-center gap-0.5 w-full"
                        >
                          <span className={`text-[11px] leading-none ${isWeekend ? "text-[var(--color-danger)]" : "text-[var(--color-text-muted)]"}`}>
                            {WEEKDAYS[wdIndex]}
                          </span>
                          <span
                            className={`text-[12px] font-semibold w-6 h-6 rounded-full inline-flex items-center justify-center transition-colors ${
                              today
                                ? "bg-[var(--color-brand)] text-[var(--color-bg)]"
                                : isWeekend ? "text-[var(--color-danger)]" : "text-[var(--color-text-primary)]"
                            }`}
                          >
                            {d.getDate()}
                          </span>
                        </button>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {HOURS.map((hour) => (
                  <tr key={hour} style={{ height: 70 }}>
                    <td className="p-0 text-[11px] text-[var(--color-text-muted)] font-mono align-top pt-1 text-center border-t border-[var(--color-surface)]/60">
                      {hour.slice(0, 2)}
                    </td>
                    {weekDates.map((d) => {
                      const dateStr = formatDate(d);
                      const booking = getBookingAtSlot(dateStr, hour);
                      const occupied = isSlotOccupied(dateStr, hour);
                      const isContinuation = occupied && !booking;

                      if (isContinuation) return null;

                      if (booking) {
                        const paid = isPaid(booking);
                        const cellBg = paid
                          ? "bg-[var(--color-success)]/20 hover:bg-[var(--color-success)]/30"
                          : "bg-[var(--color-brand)]/10 hover:bg-[var(--color-brand)]/20";
                        const name = booking.user.displayName || "顧客";
                        const serviceShort = booking.service.name.length > 4
                          ? booking.service.name.slice(0, 4)
                          : booking.service.name;
                        return (
                          <td
                            key={dateStr + hour}
                            rowSpan={booking.slotsOccupied > 1 ? booking.slotsOccupied : 1}
                            className="p-0.5 align-top border-t border-[var(--color-surface)]/60"
                          >
                            <div
                              onClick={() => openBookingDetail(booking)}
                              className={`w-full h-full rounded p-1 cursor-pointer transition-colors flex flex-col overflow-hidden ${cellBg}`}
                            >
                              {/* Time range */}
                              <p className="text-[11px] text-[var(--color-text-muted)] font-mono leading-none mb-0.5 truncate">
                                {booking.startTime.slice(0, 5)}
                              </p>
                              {/* Customer name */}
                              <p className="text-[11px] font-semibold text-[var(--color-text-primary)] leading-tight truncate">
                                {name.length > 4 ? name.slice(0, 4) : name}
                              </p>
                              {/* Service pill */}
                              <span className="mt-auto inline-block px-1 py-px rounded bg-[var(--color-bg)]/70 text-[11px] text-[var(--color-text-body)] leading-tight truncate">
                                {serviceShort}
                              </span>
                            </div>
                          </td>
                        );
                      }

                      return (
                        <td key={dateStr + hour} className="p-0.5 border-t border-[var(--color-surface)]/60">
                          <div
                            className="w-full h-full rounded transition-colors cursor-pointer hover:bg-[var(--color-surface)]/50"
                            onClick={() => { setCurrentDate(d); setView("day"); }}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Current time indicator (red line across all columns) */}
            {(() => {
              const h = now.getHours();
              const m = now.getMinutes();
              if (h < 11 || h >= 20) return null;
              if (!weekDates.some((d) => isToday(d))) return null;
              // 34 = thead height, 70 = week row height
              const top = 34 + (h - 11 + m / 60) * 70;
              return (
                <div
                  className="absolute left-0 right-0 pointer-events-none z-20 flex items-center"
                  style={{ top }}
                >
                  <span className="text-[11px] font-semibold text-[var(--color-danger)] font-mono w-8 text-center">
                    {String(h).padStart(2, "0")}:{String(m).padStart(2, "0")}
                  </span>
                  <div className="flex-1 h-px bg-[var(--color-danger)]" />
                </div>
              );
            })()}
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
                  cells.push(<div key={`empty-${i}`} className="h-[72px]" />);
                }

                // Day cells
                for (let day = 1; day <= daysInMonth; day++) {
                  const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                  const summary = monthlySummary[dateStr];
                  const count = summary?.count || 0;
                  const today = dateStr === todayStr;

                  // Get first 2 bookings for mini time bars
                  const dayBookings = bookings
                    .filter((b) =>
                      b.date.startsWith(dateStr) &&
                      b.status !== "CANCELLED" &&
                      b.status !== "CANCELLED_BY_ADMIN"
                    )
                    .sort((a, b) => a.startTime.localeCompare(b.startTime))
                    .slice(0, 2);

                  cells.push(
                    <button
                      key={day}
                      onClick={() => { setCurrentDate(new Date(year, month, day)); setView("day"); }}
                      className={`h-[72px] rounded-lg flex flex-col items-stretch p-1 relative transition-colors hover:bg-[var(--color-surface)] ${
                        today ? "ring-2 ring-[var(--color-brand)]" : ""
                      }`}
                    >
                      {/* Date + count */}
                      <div className="flex items-center justify-between mb-0.5">
                        <span className={`text-[13px] font-semibold leading-none ${today ? "text-[var(--color-brand)]" : "text-[var(--color-text-primary)]"}`}>
                          {day}
                        </span>
                        {count > 0 && (
                          <span className="text-[11px] text-[var(--color-text-muted)] leading-none">
                            合計 {count}
                          </span>
                        )}
                      </div>

                      {/* Mini time bars (first 2 bookings) */}
                      <div className="flex-1 flex flex-col gap-0.5 items-start">
                        {dayBookings.map((b) => {
                          const paid = isPaid(b);
                          const barBg = paid
                            ? "bg-[var(--color-success)]/30 text-[var(--color-success)]"
                            : "bg-[var(--color-brand)]/15 text-[var(--color-brand)]";
                          return (
                            <div
                              key={b.id}
                              className={`w-full px-1 py-px rounded text-[11px] font-mono leading-none truncate ${barBg}`}
                            >
                              {b.startTime.slice(0, 5)}
                            </div>
                          );
                        })}
                        {count > 2 && (
                          <span className="text-[11px] text-[var(--color-text-muted)] leading-none">+{count - 2}</span>
                        )}
                      </div>
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
        duration={newBookingDuration}
        open={newSheetOpen}
        onOpenChange={setNewSheetOpen}
        onCreated={() => mutateBookings()}
      />
    </div>
  );
}
