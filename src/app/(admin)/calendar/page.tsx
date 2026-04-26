"use client";

/**
 * Admin calendar — three-view container (day / week / month).
 * Owns: data fetching, deep-link handling, holidays, sheet/modal state,
 * unack queue, polling. View-specific logic lives in
 * src/components/admin/calendar/{day,week,month}-view.tsx.
 *
 * Refactored in Wave 3.A / A1 (PRD-v3 §4) — page reduced from ~1380 to ~270 LOC.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import useSWR from "swr";
import { usePageTitle } from "@/lib/hooks/use-page-title";
import { useCalendarPolling } from "@/lib/hooks/use-calendar-polling";
import { adminHeaders } from "@/lib/auth/admin-fetch";
import { useToast } from "@/components/ui/toast";
import { BookingDetailSheet } from "@/components/admin/booking-detail-sheet";
import { NewBookingSheet } from "@/components/admin/new-booking-sheet";
import { UnacknowledgedModal } from "@/components/admin/unacknowledged-modal";
import { DayView } from "@/components/admin/calendar/day-view";
import { WeekView } from "@/components/admin/calendar/week-view";
import { MonthView } from "@/components/admin/calendar/month-view";
import { ViewToggle } from "@/components/admin/calendar/view-toggle";
import { CalendarFab } from "@/components/admin/calendar/calendar-fab";
import { ZoomControls } from "@/components/admin/calendar/zoom-controls";
import { useViewPersistence } from "@/components/admin/calendar/use-view-persistence";
import { useZoom } from "@/components/admin/calendar/use-zoom";
import {
  RescheduleUndoToast,
  type RescheduleResult,
} from "@/components/admin/calendar/reschedule-undo-toast";
import { fetcher, formatDate, toTaipeiDate, WEEKDAYS } from "@/components/admin/calendar/utils";
import type { Booking, MonthlySummary } from "@/components/admin/calendar/types";

/**
 * Compute next sensible default time for the FAB:
 *   - if `forDate` is today and now < 20:00 → next-on-the-hour from now
 *   - if `forDate` is today and now >= 20:00 → tomorrow 11:00
 *   - else (a future date) → 11:00
 *   - else (a past date) → today + next hour (or tomorrow 11:00 if past hours)
 */
function nextSlotForFab(forDate: Date): { date: string; time: string } {
  const now = toTaipeiDate(new Date());
  const todayStr = formatDate(now);
  const forStr = formatDate(forDate);

  // Past date selected → bump to today/tomorrow logic
  if (forStr < todayStr) return nextSlotForFab(now);

  // Future date selected → just open at 11:00
  if (forStr > todayStr) return { date: forStr, time: "11:00" };

  // Same day = today
  const nextHour = now.getMinutes() === 0 ? now.getHours() : now.getHours() + 1;
  if (nextHour < 11) return { date: todayStr, time: "11:00" };
  if (nextHour >= 20) {
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return { date: formatDate(tomorrow), time: "11:00" };
  }
  return { date: todayStr, time: `${String(nextHour).padStart(2, "0")}:00` };
}

export default function CalendarPage() {
  usePageTitle("日曆");
  const [view, setView] = useViewPersistence();
  const [currentDate, setCurrentDate] = useState(() => toTaipeiDate(new Date()));
  const {
    slotHeight: zoomSlotHeight,
    stopIndex: zoomStopIndex,
    zoomIn,
    zoomOut,
    containerRef: zoomContainerRef,
    onWheel: onZoomWheel,
    onPointerDown: onZoomPointerDown,
    onPointerMove: onZoomPointerMove,
    onPointerUp: onZoomPointerUp,
    onPointerCancel: onZoomPointerCancel,
  } = useZoom();

  // ─── Sheet/modal state ───
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);
  const [newBookingDate, setNewBookingDate] = useState("");
  const [newBookingTime, setNewBookingTime] = useState("");
  const [newBookingDuration, setNewBookingDuration] = useState(1);
  const [newSheetOpen, setNewSheetOpen] = useState(false);

  const openBookingDetail = useCallback((b: Booking) => {
    setSelectedBooking(b);
    setDetailSheetOpen(true);
  }, []);

  // ─── Unacknowledged-bookings queue ───
  const { data: unackData, mutate: refreshUnack } = useSWR(
    "/api/bookings/unacknowledged",
    (url) => fetch(url, { headers: adminHeaders() }).then((r) => r.json()),
    { refreshInterval: 30_000, revalidateOnFocus: true },
  );
  const unackBookings = unackData?.bookings || [];

  // ─── Notification deep-link (?date=&ack=) ───
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  // Ref instead of state — deep-link is a one-shot side effect; we don't need
  // a re-render when it completes, and a state setter inside an effect would
  // trip react-hooks/set-state-in-effect.
  const deepLinkHandledRef = useRef(false);
  useEffect(() => {
    if (deepLinkHandledRef.current) return;
    const dateParam = searchParams.get("date");
    const ackParam = searchParams.get("ack");
    if (!dateParam && !ackParam) {
      deepLinkHandledRef.current = true;
      return;
    }
    if (dateParam) {
      const d = new Date(dateParam + "T00:00:00+08:00");
      if (!Number.isNaN(d.getTime())) {
        // Deep-link is a one-shot URL handler; setState here is intentional
        // and guarded by deepLinkHandledRef so it can't loop.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setCurrentDate(d);
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setView("day");
      }
    }
    if (ackParam) {
      fetch(`/api/bookings/${ackParam}`, { headers: adminHeaders() })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data?.booking) openBookingDetail(data.booking);
        })
        .catch(() => {
          /* booking might be cancelled — ignore */
        });
    }
    router.replace(pathname);
    deepLinkHandledRef.current = true;
  }, [searchParams, router, pathname, openBookingDetail, setView]);

  // ─── Holidays ───
  const { data: holidaysData } = useSWR(
    "/api/admin/holidays",
    (url: string) =>
      fetch(url, { headers: adminHeaders() }).then((r) => (r.ok ? r.json() : { holidays: [] })),
    { revalidateOnFocus: false, dedupingInterval: 5 * 60_000 },
  );
  const holidayDates = useMemo(() => {
    const set = new Set<string>();
    for (const h of holidaysData?.holidays || []) {
      const d = String(h.date).slice(0, 10);
      set.add(d);
    }
    return set;
  }, [holidaysData]);

  const { toast } = useToast();

  const openNewBooking = useCallback(
    (date: string, time: string, duration: number = 1) => {
      if (holidayDates.has(date)) {
        const reason = (holidaysData?.holidays || []).find(
          (h: { date: string; reason?: string | null }) =>
            String(h.date).slice(0, 10) === date,
        )?.reason;
        toast({
          type: "error",
          message: reason ? `公休日（${reason}）— 不可新增預約` : "公休日 — 不可新增預約",
        });
        return;
      }
      setNewBookingDate(date);
      setNewBookingTime(time);
      setNewBookingDuration(duration);
      setNewSheetOpen(true);
    },
    [holidayDates, holidaysData, toast],
  );

  const [nearEndBookings, setNearEndBookings] = useState<Set<string>>(new Set());

  // Most recent reschedule, surfaces as the undo toast (Wave 3.A / A3 / E-5).
  const [lastReschedule, setLastReschedule] = useState<RescheduleResult | null>(null);

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

  const monthYear = useMemo(
    () => ({ year: currentDate.getFullYear(), month: currentDate.getMonth() }),
    [currentDate],
  );

  // ─── Data Fetching (SWR) ───
  const dateRange = useMemo(() => {
    if (view === "day") {
      const d = formatDate(currentDate);
      return { from: d, to: d };
    }
    if (view === "week") {
      return { from: formatDate(weekDates[0]), to: formatDate(weekDates[6]) };
    }
    const { year, month } = monthYear;
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    return { from: formatDate(firstDay), to: formatDate(lastDay) };
  }, [view, currentDate, weekDates, monthYear]);

  const { data: bookingsData, isLoading, mutate: mutateBookings } = useSWR(
    dateRange ? `/api/bookings?from=${dateRange.from}&to=${dateRange.to}` : null,
    fetcher,
    { refreshInterval: 30000, revalidateOnFocus: true },
  );

  const monthKey = `${monthYear.year}-${String(monthYear.month + 1).padStart(2, "0")}`;
  const { data: monthData } = useSWR(
    view === "month" ? `/api/bookings/monthly-summary?month=${monthKey}` : null,
    fetcher,
    { refreshInterval: 60000 },
  );

  const bookings: Booking[] = useMemo(
    () => bookingsData?.bookings || [],
    [bookingsData],
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

  const navigate = (delta: number) => {
    const d = new Date(currentDate);
    if (view === "month") d.setMonth(d.getMonth() + delta);
    else if (view === "week") d.setDate(d.getDate() + delta * 7);
    else d.setDate(d.getDate() + delta);
    setCurrentDate(d);
  };

  const todayStr = formatDate(toTaipeiDate(new Date()));
  const isToday = (d: Date) => formatDate(d) === todayStr;

  // ─── Header text ───
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

  // ─── FAB handler — quick create ───
  const handleFabClick = useCallback(() => {
    const { date, time } = nextSlotForFab(currentDate);
    openNewBooking(date, time, 1);
  }, [currentDate, openNewBooking]);

  return (
    <div className="max-w-4xl mx-auto">
      {/* Top Bar */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(-1)}
            className="p-1.5 rounded-lg hover:bg-[var(--color-surface)] transition-colors"
          >
            <ChevronLeft size={20} className="text-[var(--color-text-body)]" />
          </button>
          <h1 className="text-base font-semibold text-[var(--color-text-primary)] tracking-wide min-w-0">
            {headerText}
          </h1>
          <button
            onClick={() => navigate(1)}
            className="p-1.5 rounded-lg hover:bg-[var(--color-surface)] transition-colors"
          >
            <ChevronRight size={20} className="text-[var(--color-text-body)]" />
          </button>
        </div>
        <div className="flex items-center gap-2">
          {/* Zoom controls — only visible for time-axis views */}
          {(view === "day" || view === "week") && (
            <ZoomControls
              stopIndex={zoomStopIndex}
              onZoomIn={zoomIn}
              onZoomOut={zoomOut}
            />
          )}
          <button
            onClick={() => setCurrentDate(toTaipeiDate(new Date()))}
            className="text-xs font-medium text-[var(--color-brand)] border border-[var(--color-brand)] px-3 py-1.5 rounded-lg hover:bg-[var(--color-brand)]/5 transition-colors"
          >
            今天
          </button>
        </div>
      </div>

      {/* View toggle */}
      <ViewToggle view={view} onChange={setView} />

      {/* Loading */}
      {isLoading && (
        <div className="flex justify-center py-8">
          <div className="w-6 h-6 border-2 border-[var(--color-brand)] border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Zoomable wrapper for day/week — Ctrl+wheel + 2-pointer pinch */}
      {(view === "day" || view === "week") && !isLoading && (
        <div
          ref={zoomContainerRef}
          onWheel={onZoomWheel}
          onPointerDown={onZoomPointerDown}
          onPointerMove={onZoomPointerMove}
          onPointerUp={onZoomPointerUp}
          onPointerCancel={onZoomPointerCancel}
          className="touch-pan-y"
          style={{ touchAction: "pan-y" }}
        >
          {view === "day" && (
            <DayView
              currentDate={currentDate}
              setCurrentDate={setCurrentDate}
              bookings={bookings}
              now={now}
              isToday={isToday}
              nearEndBookings={nearEndBookings}
              onOpenBookingDetail={openBookingDetail}
              onOpenNewBooking={openNewBooking}
              slotHeight={zoomSlotHeight}
              holidayDates={holidayDates}
              mutateBookings={mutateBookings}
              onRescheduled={setLastReschedule}
            />
          )}
          {view === "week" && (
            <WeekView
              weekDates={weekDates}
              bookings={bookings}
              now={now}
              isToday={isToday}
              holidayDates={holidayDates}
              setCurrentDate={setCurrentDate}
              setView={setView}
              onOpenBookingDetail={openBookingDetail}
              mutateBookings={mutateBookings}
              slotHeight={zoomSlotHeight}
              onRescheduled={setLastReschedule}
            />
          )}
        </div>
      )}

      {view === "month" && (
        <MonthView
          monthYear={monthYear}
          bookings={bookings}
          monthlySummary={monthlySummary}
          holidayDates={holidayDates}
          todayStr={todayStr}
          setCurrentDate={setCurrentDate}
          setView={setView}
        />
      )}

      {/* Reschedule undo toast — 5s window after a successful drag-reschedule */}
      <RescheduleUndoToast
        result={lastReschedule}
        onDismiss={() => setLastReschedule(null)}
        onUndone={() => {
          setLastReschedule(null);
          mutateBookings();
        }}
      />

      {/* FAB: quick new booking. Hidden when any sheet/modal is open. */}
      <CalendarFab
        onClick={handleFabClick}
        hidden={detailSheetOpen || newSheetOpen || unackBookings.length > 0}
      />

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
      {!detailSheetOpen && !newSheetOpen && unackBookings.length > 0 && (
        <UnacknowledgedModal
          bookings={unackBookings}
          onAllAcknowledged={() => {
            refreshUnack();
            mutateBookings();
          }}
        />
      )}
    </div>
  );
}
