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

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { adminHeaders } from "@/lib/auth/admin-fetch";
import { useToast } from "@/components/ui/toast";
import { SegmentBadge } from "./segment-badge";
import { HorizontalDateStrip } from "./horizontal-date-strip";
import { useAutoFit } from "./use-auto-fit";
import {
  HOURS,
  buildBookingIndex,
  cardBgClass,
  formatDate,
  getBookingServicesLabel,
  indexBookingAtSlot,
  indexBookingsForDate,
  indexIsSlotOccupied,
  isPaid,
} from "./utils";
import type { Booking } from "./types";
import type { RescheduleResult } from "./reschedule-undo-toast";

interface Props {
  currentDate: Date;
  setCurrentDate: (d: Date) => void;
  bookings: Booking[];
  now: Date;
  isToday: (d: Date) => boolean;
  nearEndBookings: Set<string>;
  onOpenBookingDetail: (b: Booking) => void;
  onOpenNewBooking: (date: string, time: string, duration?: number) => void;
  holidayDates: Set<string>;
  mutateBookings: () => void;
  /** Notifies parent of a successful drag-reschedule so the undo toast can show. */
  onRescheduled: (r: RescheduleResult) => void;
}

const DAY_ROW_MIN_PX = 44; // Apple HIG touch target
const DAY_ROW_MAX_PX = 72; // designer cap — above this, multi-slot wastes pixels

const LONG_PRESS_MS = 500;
const MOVE_THRESHOLD_PX = 15;

function DayViewBase({
  currentDate,
  setCurrentDate,
  bookings,
  now,
  isToday,
  nearEndBookings,
  onOpenBookingDetail,
  onOpenNewBooking,
  holidayDates,
  mutateBookings,
  onRescheduled,
}: Props) {
  const timelineRef = useRef<HTMLDivElement>(null);
  // Auto-fit replaces the old useZoom slot-height knob (B1 redesign).
  // Row height is computed from container height ÷ 9, clamped 44–72 px.
  const slotHeight = useAutoFit(timelineRef, 9, DAY_ROW_MIN_PX, DAY_ROW_MAX_PX);
  const { toast } = useToast();

  // Drag-to-create state
  const [dragState, setDragState] = useState<{
    startHour: number;
    endHour: number;
    active: boolean;
  } | null>(null);

  // Drag-to-reschedule state (Wave 3.A / A3 — PRD-v3 §4 + E-5/E-6)
  const [draggedBooking, setDraggedBooking] = useState<Booking | null>(null);
  const [dragOverHour, setDragOverHour] = useState<string | null>(null);
  const [rescheduleSubmitting, setRescheduleSubmitting] = useState(false);

  const handleDropReschedule = useCallback(
    async (newDate: string, newStartTime: string) => {
      if (!draggedBooking || rescheduleSubmitting) return;
      const oldDate = draggedBooking.date.slice(0, 10);
      if (oldDate === newDate && draggedBooking.startTime === newStartTime) {
        setDraggedBooking(null);
        setDragOverHour(null);
        return;
      }
      if (holidayDates.has(newDate)) {
        toast({ type: "error", message: "公休日不可改期到此日" });
        setDraggedBooking(null);
        setDragOverHour(null);
        return;
      }
      const oldStartTime = draggedBooking.startTime;
      const customerName = draggedBooking.user.displayName || "顧客";
      setRescheduleSubmitting(true);
      try {
        const idempotencyKey = `${draggedBooking.id}-${newDate}-${newStartTime}`;
        const res = await fetch(`/api/bookings/${draggedBooking.id}/reschedule`, {
          method: "POST",
          headers: adminHeaders(),
          body: JSON.stringify({ date: newDate, startTime: newStartTime, idempotencyKey }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "改期失敗");
        onRescheduled({
          bookingId: draggedBooking.id,
          oldDate,
          oldStartTime,
          newDate,
          newStartTime,
          customerName,
        });
        mutateBookings();
      } catch (err) {
        toast({
          type: "error",
          message: err instanceof Error ? err.message : "改期失敗",
        });
      } finally {
        setRescheduleSubmitting(false);
        setDraggedBooking(null);
        setDragOverHour(null);
      }
    },
    [draggedBooking, rescheduleSubmitting, holidayDates, toast, mutateBookings, onRescheduled],
  );

  // Pre-built lookup index: 1 pass over bookings, then O(1) lookups in the
  // 9-hour render loop instead of 9× filter/find/some scans (PRD-v3 A7 perf).
  const bookingIndex = useMemo(() => buildBookingIndex(bookings), [bookings]);
  const todayBookings = indexBookingsForDate(bookingIndex, formatDate(currentDate));
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
        if (indexIsSlotOccupied(bookingIndex, dateStr, hourStr)) return h;
      }
      return 20;
    },
    [bookingIndex, currentDate],
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
      // Don't start a new-booking gesture while a reschedule drag is in flight
      // — the empty slot doubles as a drop target (review finding P3).
      if (draggedBooking) return;
      const dateStr = formatDate(currentDate);
      const hourStr = `${String(startHour).padStart(2, "0")}:00`;
      if (indexIsSlotOccupied(bookingIndex, dateStr, hourStr)) return;

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
    [bookingIndex, currentDate, cancelMomentum, draggedBooking],
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
                  ? `${nearEndList[0].user.displayName || "顧客"} ${getBookingServicesLabel(nearEndList[0])} 即將結束`
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
      <div className="bg-[var(--color-surface)] rounded-lg px-3 py-1.5 mb-1.5 flex items-center justify-between text-[13px]">
        <span className="font-semibold text-[var(--color-text-primary)]">
          今日 {todayBookings.length} 預約
        </span>
        <span className="text-[var(--color-text-body)]">
          預估 NT${todayRevenue.toLocaleString()}
        </span>
      </div>

      {/* Timeline */}
      {/* Timeline fills remaining viewport height. 220px subtraction for:
          status bar + admin shell header + page top bar + view toggle +
          date strip + summary + bottom tab bar. Tightened progressively
          (280→250→220) so all 9 hours (11–20) fit on iPhone without scroll. */}
      <div
        ref={timelineRef}
        className="relative overflow-y-auto"
        style={{ height: "calc(100dvh - 330px)", touchAction: "pan-y" }}
      >
        {HOURS.map((hour) => {
          const dateStr = formatDate(currentDate);
          const booking = indexBookingAtSlot(bookingIndex, dateStr, hour);
          const occupied = indexIsSlotOccupied(bookingIndex, dateStr, hour);
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
                  // Compact card layout (B5 fix): row height now 44-72px (auto-fit
                  // clamp), down from old fixed 96px. Content must fit + overflow-hidden
                  // to prevent leaking into adjacent rows. Multi-slot bookings get a
                  // third line with the full service name since they have more height.
                  <div
                    draggable
                    onDragStart={(e) => {
                      setDraggedBooking(booking);
                      e.dataTransfer.effectAllowed = "move";
                      e.dataTransfer.setData("text/plain", booking.id);
                    }}
                    onDragEnd={() => {
                      setDraggedBooking(null);
                      setDragOverHour(null);
                    }}
                    onClick={() => onOpenBookingDetail(booking)}
                    className={`relative rounded-lg px-2 py-1.5 h-full cursor-grab active:cursor-grabbing transition-all hover:opacity-90 flex flex-col gap-0.5 overflow-hidden ${cardBgClass(booking)} ${draggedBooking?.id === booking.id ? "opacity-40 ring-2 ring-[var(--color-brand)]" : ""}`}
                    title={`${booking.startTime}-${booking.endTime} ${getBookingServicesLabel(booking)} · ${booking.user.displayName || "顧客"}${isPaid(booking) ? " (已付款)" : ""}`}
                  >
                    {!booking.adminAcknowledgedAt && (
                      <span
                        className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[var(--color-danger)]"
                        aria-label="未讀新預約"
                        title="未讀 — 點擊查看詳情即標記為已讀"
                      />
                    )}

                    {/* Line 1: time range + paid checkmark (small, muted) */}
                    <div className="flex items-center gap-1 text-[10px] text-[var(--color-text-muted)] font-mono leading-none">
                      <span className="truncate">
                        {booking.startTime}-{booking.endTime}
                      </span>
                      {isPaid(booking) && (
                        <span className="ml-auto inline-flex items-center gap-0.5 text-[var(--color-success)] pr-3">
                          <svg
                            width="9"
                            height="9"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                          已付
                        </span>
                      )}
                    </div>

                    {/* Line 2: service prefix + customer name + segment badge (B3 pattern) */}
                    <div className="flex items-center justify-between gap-1.5 min-h-0">
                      <p className="font-semibold text-[var(--color-text-primary)] text-[13px] leading-tight truncate flex-1">
                        <span className="opacity-65 mr-1">{getBookingServicesLabel(booking, { compact: true })}</span>
                        {booking.user.displayName || "顧客"}
                      </p>
                      <SegmentBadge segment={booking.user.segment} />
                    </div>

                    {/* Line 3 (multi-slot only): full service name pill */}
                    {booking.slotsOccupied > 1 && (
                      <span className="mt-auto inline-block self-start px-1.5 py-0.5 rounded bg-[var(--color-bg)]/60 text-[var(--color-text-body)] text-[11px] font-medium leading-none truncate max-w-full">
                        {getBookingServicesLabel(booking)}
                      </span>
                    )}
                  </div>
                ) : (
                  <div
                    onPointerDown={(e) => handleSlotPointerDown(e, parseInt(hour.split(":")[0]))}
                    onPointerMove={(e) => handleSlotPointerMove(e, parseInt(hour.split(":")[0]))}
                    onPointerUp={(e) => handleSlotPointerUp(e, parseInt(hour.split(":")[0]))}
                    onPointerCancel={handleSlotPointerCancel}
                    onDragOver={(e) => {
                      if (!draggedBooking) return;
                      e.preventDefault();
                      e.dataTransfer.dropEffect = "move";
                      if (dragOverHour !== hour) setDragOverHour(hour);
                    }}
                    onDragLeave={() => {
                      if (dragOverHour === hour) setDragOverHour(null);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (!draggedBooking) return;
                      handleDropReschedule(formatDate(currentDate), hour);
                    }}
                    style={{ touchAction: "none" }}
                    className={`h-full rounded-lg border border-dashed transition-colors select-none flex items-center justify-center cursor-pointer ${
                      draggedBooking && dragOverHour === hour
                        ? "border-[var(--color-brand)] bg-[var(--color-brand)]/20 ring-2 ring-[var(--color-brand)]"
                        : draggedBooking
                          ? "border-[var(--color-brand)]/30 hover:bg-[var(--color-brand)]/10"
                          : "border-[var(--color-text-muted)]/20 hover:border-[var(--color-brand)]/40 hover:bg-[var(--color-brand)]/5"
                    }`}
                  >
                    <span className="text-xs text-[var(--color-text-muted)]">
                      {draggedBooking ? "放這裡改期" : "點擊新增・長按拖拉"}
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Red current-time indicator — line only, no text label.
            (Per UX feedback: red text overlapped the slot's hour gutter when
             the minute fell near :00.) */}
        {timeIndicatorTop !== null && isToday(currentDate) && (
          <div
            className="absolute left-0 right-0 h-px bg-[var(--color-danger)] pointer-events-none z-10"
            style={{ top: timeIndicatorTop }}
          />
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

// PRD-v3 A7 perf: parent re-renders that don't change the props (e.g. SWR
// poll returning identical bookings) shouldn't re-render the whole grid.
export const DayView = memo(DayViewBase);
