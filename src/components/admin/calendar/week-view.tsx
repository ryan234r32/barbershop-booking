"use client";

/**
 * Week timeline view (PRD-v3 §4 — week view).
 * Owns:
 *  - 7-day column layout (Mon-start)
 *  - HTML5 drag-to-reschedule (Wave 3.A sub-5; will be unified with day-view's
 *    PointerEvent state machine in A3)
 *  - Per-week summary strip
 *  - Cross-column current-time line (only when today is in the visible week)
 *
 * Extracted from calendar/page.tsx in Wave 3.A / A1 — behavior unchanged.
 */

import { memo, useCallback, useMemo, useRef, useState } from "react";
import { adminHeaders } from "@/lib/auth/admin-fetch";
import { useToast } from "@/components/ui/toast";
import { useAutoFit } from "./use-auto-fit";
import {
  HOURS,
  WEEKDAYS,
  abbreviateService,
  buildBookingIndex,
  chipClassForStatus,
  formatDate,
  indexBookingAtSlot,
  indexIsSlotOccupied,
  isPaid,
  truncateCustomerName,
} from "./utils";
import type { Booking } from "./types";

import type { RescheduleResult } from "./reschedule-undo-toast";

interface Props {
  weekDates: Date[];
  bookings: Booking[];
  now: Date;
  isToday: (d: Date) => boolean;
  holidayDates: Set<string>;
  setCurrentDate: (d: Date) => void;
  setView: (v: "day" | "week" | "month") => void;
  onOpenBookingDetail: (b: Booking) => void;
  mutateBookings: () => void;
  /** Notifies parent of a successful drag-reschedule so the undo toast can show. */
  onRescheduled: (r: RescheduleResult) => void;
}

const WEEK_THEAD_HEIGHT = 34;
const WEEK_ROW_MIN_PX = 44;
const WEEK_ROW_MAX_PX = 64; // designer cap — narrower than day to keep 7 columns readable

function WeekViewBase({
  weekDates,
  bookings,
  now,
  isToday,
  holidayDates,
  setCurrentDate,
  setView,
  onOpenBookingDetail,
  mutateBookings,
  onRescheduled,
}: Props) {
  const { toast } = useToast();
  const gridRef = useRef<HTMLDivElement>(null);
  // Auto-fit row sizing — replaces useZoom (B1).
  // Subtracting THEAD height because the observed container also includes the
  // sticky weekday header, but row math is for the body only.
  const slotHeight = useAutoFit(gridRef, 9, WEEK_ROW_MIN_PX, WEEK_ROW_MAX_PX);

  const [draggedBooking, setDraggedBooking] = useState<Booking | null>(null);
  const [dragOverSlot, setDragOverSlot] = useState<{ date: string; hour: string } | null>(null);
  const [rescheduleSubmitting, setRescheduleSubmitting] = useState(false);

  const handleDropReschedule = useCallback(
    async (newDate: string, newStartTime: string) => {
      if (!draggedBooking || rescheduleSubmitting) return;
      const oldDate = draggedBooking.date.slice(0, 10);
      const oldStartTime = draggedBooking.startTime;
      const customerName = draggedBooking.user.displayName || "顧客";
      if (oldDate === newDate && oldStartTime === newStartTime) {
        setDraggedBooking(null);
        setDragOverSlot(null);
        return;
      }
      if (holidayDates.has(newDate)) {
        toast({ type: "error", message: "公休日不可改期到此日" });
        setDraggedBooking(null);
        setDragOverSlot(null);
        return;
      }
      setRescheduleSubmitting(true);
      try {
        // Idempotency key (PRD-v3 E-5): same target on the same booking
        // collapses to one operation if the user double-taps.
        const idempotencyKey = `${draggedBooking.id}-${newDate}-${newStartTime}`;
        const res = await fetch(`/api/bookings/${draggedBooking.id}/reschedule`, {
          method: "POST",
          headers: adminHeaders(),
          body: JSON.stringify({ date: newDate, startTime: newStartTime, idempotencyKey }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "改期失敗");
        }
        // Hand off to the parent for the undo toast — replaces the inline
        // success toast which can't be undone.
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
        setDragOverSlot(null);
      }
    },
    [draggedBooking, rescheduleSubmitting, holidayDates, toast, mutateBookings, onRescheduled],
  );

  // PRD-v3 A7 perf: precompute lookup index — saves 7×9×3 array scans/render.
  const bookingIndex = useMemo(() => buildBookingIndex(bookings), [bookings]);

  const liveBookings = useMemo(
    () =>
      bookings.filter(
        (b) => b.status !== "CANCELLED" && b.status !== "CANCELLED_BY_ADMIN",
      ),
    [bookings],
  );

  return (
    <>
      {/* Drag-to-reschedule hint banner — only when actively dragging */}
      {draggedBooking && (
        <div className="mb-2 px-3 py-2 rounded-lg bg-[var(--color-brand)]/10 border border-[var(--color-brand)]/30 text-[12px] text-[var(--color-brand)] flex items-center justify-between">
          <span>
            正在改期 <strong>{draggedBooking.user.displayName || "顧客"}</strong> ·{" "}
            {draggedBooking.startTime} — 拖到目標時段放開
          </span>
          <button
            onClick={() => {
              setDraggedBooking(null);
              setDragOverSlot(null);
            }}
            className="text-[11px] underline"
          >
            取消
          </button>
        </div>
      )}

      {/* Compact summary — single line */}
      <div className="text-[11px] text-[var(--color-text-muted)] mb-2 flex items-center justify-between">
        <span>
          本週{" "}
          <span className="font-semibold text-[var(--color-text-primary)]">
            {liveBookings.length}
          </span>{" "}
          預約
        </span>
        <span>
          NT$
          <span className="font-semibold text-[var(--color-text-primary)]">
            {liveBookings.reduce((s, b) => s + (b.service?.price || 0), 0).toLocaleString()}
          </span>
        </span>
      </div>

      {/* Scrollable grid — Fresha/夯客 style. Auto-fit row sizing (B1). */}
      <div
        ref={gridRef}
        className="rounded-lg overflow-y-auto relative"
        style={{ height: "calc(100dvh - 270px)" }}
      >
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
                      onClick={() => {
                        setCurrentDate(d);
                        setView("day");
                      }}
                      className="flex flex-col items-center gap-0.5 w-full"
                    >
                      <span
                        className={`text-[11px] leading-none ${isWeekend ? "text-[var(--color-danger)]" : "text-[var(--color-text-muted)]"}`}
                      >
                        {WEEKDAYS[wdIndex]}
                      </span>
                      <span
                        className={`text-[12px] font-semibold w-6 h-6 rounded-full inline-flex items-center justify-center transition-colors ${
                          today
                            ? "bg-[var(--color-brand)] text-[var(--color-bg)]"
                            : isWeekend
                              ? "text-[var(--color-danger)]"
                              : "text-[var(--color-text-primary)]"
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
              <tr key={hour} style={{ height: slotHeight }}>
                <td className="p-0 text-[11px] text-[var(--color-text-muted)] font-mono align-top pt-1 text-center border-t border-[var(--color-surface)]/60">
                  {hour.slice(0, 2)}
                </td>
                {weekDates.map((d) => {
                  const dateStr = formatDate(d);
                  const booking = indexBookingAtSlot(bookingIndex, dateStr, hour);
                  const occupied = indexIsSlotOccupied(bookingIndex, dateStr, hour);
                  const isContinuation = occupied && !booking;

                  if (isContinuation) return null;

                  const isHoliday = holidayDates.has(dateStr);

                  if (booking) {
                    const paid = isPaid(booking);
                    // B2 redesign: chip colour = STATUS (paid/needs-settlement/
                    // confirmed); service type is shown via the 剪/燙/染/漂 prefix
                    // added in the chip body (B3). Pre-attentive scan answers
                    // "any unpaid?" by colour alone — no legend lookup needed.
                    const compact = slotHeight < 40;
                    const chipColors = chipClassForStatus(booking);
                    const fullName = booking.user.displayName || "顧客";
                    const truncatedName = truncateCustomerName(
                      fullName,
                      compact ? 2 : 3,
                    );
                    const serviceAbbr = abbreviateService(booking.service.name);
                    const isDragging = draggedBooking?.id === booking.id;
                    const tooltip = `${booking.startTime.slice(0, 5)} ${booking.service.name} · ${fullName}${paid ? " (已付款)" : ""}`;
                    return (
                      <td
                        key={dateStr + hour}
                        rowSpan={booking.slotsOccupied > 1 ? booking.slotsOccupied : 1}
                        className="p-0.5 align-top border-t border-[var(--color-surface)]/60"
                      >
                        <div
                          draggable={!compact}
                          onDragStart={(e) => {
                            if (compact) return;
                            setDraggedBooking(booking);
                            e.dataTransfer.effectAllowed = "move";
                            e.dataTransfer.setData("text/plain", booking.id);
                          }}
                          onDragEnd={() => {
                            setDraggedBooking(null);
                            setDragOverSlot(null);
                          }}
                          onClick={() => onOpenBookingDetail(booking)}
                          className={`relative w-full h-full rounded p-1 transition-all flex flex-col overflow-hidden ${chipColors} ${compact ? "cursor-pointer" : "cursor-grab active:cursor-grabbing"} ${isDragging ? "opacity-40 ring-2 ring-[var(--color-brand)]" : ""}`}
                          title={tooltip}
                          aria-label={tooltip}
                        >
                          {!booking.adminAcknowledgedAt && (
                            <span
                              className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-[var(--color-danger)] ring-1 ring-[var(--color-bg)]"
                              aria-label="未讀新預約"
                              title="未讀 — 點擊查看詳情即標記為已讀"
                            />
                          )}
                          {compact ? (
                            // 32px row: service letter + 2-char name on one line
                            <p className="text-[11px] font-semibold leading-none truncate">
                              <span className="opacity-75">{serviceAbbr}</span> {truncatedName}
                            </p>
                          ) : (
                            <>
                              <p className="text-[10px] font-mono leading-none mb-0.5 truncate opacity-75">
                                {booking.startTime.slice(0, 5)}
                              </p>
                              {/* Service letter prefix (B3) — integrated with name
                                  saves a row vs the old separate pill */}
                              <p className="text-[11px] font-semibold leading-tight truncate">
                                <span className="opacity-70 mr-0.5">{serviceAbbr}</span>
                                {truncatedName}
                              </p>
                            </>
                          )}
                        </div>
                      </td>
                    );
                  }

                  const isDropTarget =
                    draggedBooking !== null &&
                    dragOverSlot?.date === dateStr &&
                    dragOverSlot?.hour === hour;
                  return (
                    <td
                      key={dateStr + hour}
                      className={`p-0.5 border-t border-[var(--color-surface)]/60 ${
                        isHoliday ? "bg-[var(--color-text-muted)]/8" : ""
                      }`}
                    >
                      <div
                        className={`w-full h-full rounded transition-colors ${
                          isHoliday
                            ? "cursor-not-allowed bg-[repeating-linear-gradient(45deg,transparent,transparent_4px,var(--color-text-muted)_4px,var(--color-text-muted)_5px)] opacity-30"
                            : isDropTarget
                              ? "bg-[var(--color-brand)]/30 ring-2 ring-[var(--color-brand)] cursor-pointer"
                              : draggedBooking
                                ? "hover:bg-[var(--color-brand)]/15 cursor-pointer"
                                : "hover:bg-[var(--color-surface)]/50 cursor-pointer"
                        }`}
                        title={isHoliday ? "公休日 — 不可預約" : undefined}
                        aria-disabled={isHoliday}
                        onClick={() => {
                          if (draggedBooking) return;
                          if (isHoliday) return;
                          setCurrentDate(d);
                          setView("day");
                        }}
                        onDragOver={(e) => {
                          if (!draggedBooking) return;
                          if (isHoliday) return; // PRD-v3 D-5 — reject drop on closed days
                          e.preventDefault();
                          e.dataTransfer.dropEffect = "move";
                          if (
                            dragOverSlot?.date !== dateStr ||
                            dragOverSlot?.hour !== hour
                          ) {
                            setDragOverSlot({ date: dateStr, hour });
                          }
                        }}
                        onDragLeave={() => {
                          if (
                            dragOverSlot?.date === dateStr &&
                            dragOverSlot?.hour === hour
                          ) {
                            setDragOverSlot(null);
                          }
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          if (!draggedBooking) return;
                          handleDropReschedule(dateStr, hour);
                        }}
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
          const top = WEEK_THEAD_HEIGHT + (h - 11 + m / 60) * slotHeight;
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
  );
}

export const WeekView = memo(WeekViewBase);
