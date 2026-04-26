"use client";

/**
 * Single-day timeline view (PRD-v3 §4 — day view).
 * Owns:
 *  - HorizontalDateStrip at top
 *  - Long-press → drag-to-extend new-booking gesture machine
 *  - Auto-scroll to current time on mount / view change
 *  - Red current-time line indicator
 *  - Near-end booking banner
 *
 * Extracted from calendar/page.tsx in Wave 3.A / A1 — behavior unchanged.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SegmentBadge } from "./segment-badge";
import { HorizontalDateStrip } from "./horizontal-date-strip";
import {
  HOURS,
  cardBgClass,
  formatDate,
  getBookingAtSlot,
  getBookingsForDate,
  isPaid,
  isSlotOccupied,
} from "./utils";
import type { Booking } from "./types";

interface Props {
  currentDate: Date;
  setCurrentDate: (d: Date) => void;
  bookings: Booking[];
  now: Date;
  isToday: (d: Date) => boolean;
  nearEndBookings: Set<string>;
  onOpenBookingDetail: (b: Booking) => void;
  onOpenNewBooking: (date: string, time: string, duration?: number) => void;
  /** Row height in px — controlled by useZoom (PRD-v3 D-1). */
  slotHeight: number;
}

const LONG_PRESS_MS = 500;
const MOVE_THRESHOLD_PX = 15;

export function DayView({
  currentDate,
  setCurrentDate,
  bookings,
  now,
  isToday,
  nearEndBookings,
  onOpenBookingDetail,
  onOpenNewBooking,
  slotHeight,
}: Props) {
  const timelineRef = useRef<HTMLDivElement>(null);

  // Drag-to-create state
  const [dragState, setDragState] = useState<{
    startHour: number;
    endHour: number;
    active: boolean;
  } | null>(null);

  const todayBookings = getBookingsForDate(bookings, formatDate(currentDate));
  const todayRevenue = todayBookings.reduce((sum, b) => sum + (b.service?.price || 0), 0);

  const timeIndicatorTop = useMemo(() => {
    const h = now.getHours();
    const m = now.getMinutes();
    if (h < 11 || h >= 20) return null;
    return (h - 11 + m / 60) * slotHeight;
  }, [now, slotHeight]);

  // Auto-scroll to current time when view mounts / day changes.
  // Intentionally NOT depending on `slotHeight` — re-scrolling on every zoom
  // change would yank the user's scroll position. Only scroll on day switch.
  useEffect(() => {
    if (!timelineRef.current) return;
    const nowHour = now.getHours();
    const nowMin = now.getMinutes();
    if (nowHour >= 11 && nowHour < 20) {
      const offset = (nowHour - 11 + nowMin / 60) * slotHeight;
      timelineRef.current.scrollTo({
        top: Math.max(0, offset - slotHeight * 2),
        behavior: "smooth",
      });
    } else if (nowHour < 11) {
      timelineRef.current.scrollTo({ top: 0 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDate]);

  // ─── Drag-to-create gesture machine ───
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const dragModeActiveRef = useRef(false);
  const scrollModeActiveRef = useRef(false);
  const lastPointerYRef = useRef<number>(0);
  const velocitySamplesRef = useRef<Array<{ y: number; t: number }>>([]);
  const momentumRafRef = useRef<number | null>(null);

  const findMaxEndHour = useCallback(
    (startHour: number): number => {
      const dateStr = formatDate(currentDate);
      for (let h = startHour + 1; h <= 20; h++) {
        if (h === 20) return 20;
        const hourStr = `${String(h).padStart(2, "0")}:00`;
        if (isSlotOccupied(bookings, dateStr, hourStr)) return h;
      }
      return 20;
    },
    [bookings, currentDate],
  );

  const yToHour = useCallback(
    (y: number): number => {
      const row = Math.floor(y / slotHeight);
      return Math.max(11, Math.min(20, 11 + row));
    },
    [slotHeight],
  );

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
      if (isSlotOccupied(bookings, dateStr, hourStr)) return;

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
    [bookings, currentDate, cancelMomentum],
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
          const t = performance.now();
          velocitySamplesRef.current.push({ y: e.clientY, t });
          velocitySamplesRef.current = velocitySamplesRef.current.filter((s) => t - s.t <= 100);
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
    [findMaxEndHour, yToHour],
  );

  const runMomentum = useCallback(() => {
    const samples = velocitySamplesRef.current;
    if (samples.length < 2 || !timelineRef.current) return;
    const first = samples[0];
    const last = samples[samples.length - 1];
    const dt = last.t - first.t;
    if (dt <= 0) return;
    let velocity = -(last.y - first.y) / dt;
    if (Math.abs(velocity) < 0.3) return;

    const friction = 0.95;
    let lastTime = performance.now();
    const tick = () => {
      if (!timelineRef.current) return;
      const t = performance.now();
      const frameDt = t - lastTime;
      lastTime = t;
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

      if (scrollModeActiveRef.current) {
        scrollModeActiveRef.current = false;
        runMomentum();
        return;
      }

      if (dragModeActiveRef.current && dragState?.active) {
        const duration = dragState.endHour - dragState.startHour;
        const timeStr = `${String(dragState.startHour).padStart(2, "0")}:00`;
        dragModeActiveRef.current = false;
        setDragState(null);
        onOpenNewBooking(formatDate(currentDate), timeStr, duration);
        return;
      }

      dragModeActiveRef.current = false;
      setDragState(null);
      const timeStr = `${String(startHour).padStart(2, "0")}:00`;
      onOpenNewBooking(formatDate(currentDate), timeStr, 1);
    },
    [dragState, currentDate, runMomentum, onOpenNewBooking],
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

  return (
    <>
      {/* Horizontal date strip — smooth scroll, tap to select */}
      <HorizontalDateStrip currentDate={currentDate} onSelect={setCurrentDate} />

      {/* Near-End Banner */}
      {(() => {
        const nearEndList = todayBookings.filter(
          (b) => nearEndBookings.has(b.id) && b.status === "CONFIRMED",
        );
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
              onClick={() => nearEndList[0] && onOpenBookingDetail(nearEndList[0])}
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
          const booking = getBookingAtSlot(bookings, dateStr, hour);
          const occupied = isSlotOccupied(bookings, dateStr, hour);
          const isMultiSlotContinuation = occupied && !booking;

          if (isMultiSlotContinuation) return null;

          return (
            <div
              key={hour}
              className="flex"
              style={{
                height: booking && booking.slotsOccupied > 1
                  ? slotHeight * booking.slotsOccupied
                  : slotHeight,
              }}
            >
              <div className="w-14 shrink-0 pr-2 pt-2 text-right">
                <span className="text-xs text-[var(--color-text-muted)] font-mono">{hour}</span>
              </div>
              <div className="flex-1 border-t border-[var(--color-surface)] px-1 pt-1">
                {booking ? (
                  <div
                    onClick={() => onOpenBookingDetail(booking)}
                    className={`relative rounded-lg p-3 h-full cursor-pointer transition-colors hover:opacity-90 flex flex-col ${cardBgClass(booking)}`}
                  >
                    {!booking.adminAcknowledgedAt && (
                      <span
                        className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-[var(--color-danger)] ring-2 ring-[var(--color-bg)]"
                        aria-label="未讀新預約"
                        title="未讀 — 點擊查看詳情即標記為已讀"
                      />
                    )}

                    <p className="text-[11px] text-[var(--color-text-muted)] font-mono mb-1">
                      {booking.startTime} - {booking.endTime}
                    </p>

                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold text-[var(--color-text-primary)] text-[16px] leading-tight truncate flex-1">
                        {booking.user.displayName || "顧客"}
                      </p>
                      <SegmentBadge segment={booking.user.segment} />
                    </div>

                    <div className="mt-auto flex items-center gap-2 pt-2">
                      <span className="inline-block px-2 py-0.5 rounded bg-[var(--color-bg)]/60 text-[var(--color-text-body)] text-[11px] font-medium">
                        {booking.service.name}
                      </span>
                      {isPaid(booking) && (
                        <span className="inline-flex items-center gap-0.5 text-[11px] font-medium text-[var(--color-success)]">
                          <svg
                            width="10"
                            height="10"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <polyline points="20 6 9 17 4 12" />
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

        {/* Red current-time indicator */}
        {timeIndicatorTop !== null && isToday(currentDate) && (
          <>
            <div
              className="absolute left-0 pointer-events-none z-10 w-14 pr-2 text-right"
              style={{ top: timeIndicatorTop - 8 }}
            >
              <span className="text-xs font-semibold text-[var(--color-danger)] font-mono">
                {String(now.getHours()).padStart(2, "0")}:{String(now.getMinutes()).padStart(2, "0")}
              </span>
            </div>
            <div
              className="absolute left-14 right-0 h-px bg-[var(--color-danger)] pointer-events-none z-10"
              style={{ top: timeIndicatorTop }}
            />
          </>
        )}

        {/* Drag preview overlay */}
        {dragState?.active && (
          <div
            className="absolute left-[56px] right-1 pointer-events-none z-20 rounded-lg bg-[var(--color-brand)]/30 border-2 border-[var(--color-brand)] flex items-center justify-center"
            style={{
              top: (dragState.startHour - 11) * slotHeight,
              height: (dragState.endHour - dragState.startHour) * slotHeight,
            }}
          >
            <span className="text-sm font-bold text-[var(--color-brand)] bg-[var(--color-bg)] px-3 py-1 rounded-full shadow-md">
              {dragState.endHour - dragState.startHour} 小時
            </span>
          </div>
        )}
      </div>

      {todayBookings.length === 0 && (
        <p className="text-center text-sm text-[var(--color-text-muted)] mt-4 py-4">
          今天沒有預約，好好休息
        </p>
      )}
    </>
  );
}
