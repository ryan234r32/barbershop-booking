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

import { useCallback, useState } from "react";
import { adminHeaders } from "@/lib/auth/admin-fetch";
import { useToast } from "@/components/ui/toast";
import {
  HOURS,
  WEEKDAYS,
  formatDate,
  getBookingAtSlot,
  isPaid,
  isSlotOccupied,
} from "./utils";
import type { Booking } from "./types";

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
}

const WEEK_ROW_HEIGHT = 70;
const WEEK_THEAD_HEIGHT = 34;

export function WeekView({
  weekDates,
  bookings,
  now,
  isToday,
  holidayDates,
  setCurrentDate,
  setView,
  onOpenBookingDetail,
  mutateBookings,
}: Props) {
  const { toast } = useToast();

  const [draggedBooking, setDraggedBooking] = useState<Booking | null>(null);
  const [dragOverSlot, setDragOverSlot] = useState<{ date: string; hour: string } | null>(null);
  const [rescheduleSubmitting, setRescheduleSubmitting] = useState(false);

  const handleDropReschedule = useCallback(
    async (newDate: string, newStartTime: string) => {
      if (!draggedBooking || rescheduleSubmitting) return;
      const oldDate = draggedBooking.date.slice(0, 10);
      if (oldDate === newDate && draggedBooking.startTime === newStartTime) {
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
        const res = await fetch(`/api/bookings/${draggedBooking.id}/reschedule`, {
          method: "POST",
          headers: adminHeaders(),
          body: JSON.stringify({ date: newDate, startTime: newStartTime }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "改期失敗");
        }
        toast({
          type: "success",
          message: `已改期到 ${newDate.slice(5)} ${newStartTime}`,
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
    [draggedBooking, rescheduleSubmitting, holidayDates, toast, mutateBookings],
  );

  const liveBookings = bookings.filter(
    (b) => b.status !== "CANCELLED" && b.status !== "CANCELLED_BY_ADMIN",
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

      {/* Scrollable grid — Fresha/夯客 style */}
      <div
        className="rounded-lg overflow-y-auto relative"
        style={{ maxHeight: "calc(100vh - 260px)" }}
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
              <tr key={hour} style={{ height: WEEK_ROW_HEIGHT }}>
                <td className="p-0 text-[11px] text-[var(--color-text-muted)] font-mono align-top pt-1 text-center border-t border-[var(--color-surface)]/60">
                  {hour.slice(0, 2)}
                </td>
                {weekDates.map((d) => {
                  const dateStr = formatDate(d);
                  const booking = getBookingAtSlot(bookings, dateStr, hour);
                  const occupied = isSlotOccupied(bookings, dateStr, hour);
                  const isContinuation = occupied && !booking;

                  if (isContinuation) return null;

                  if (booking) {
                    const paid = isPaid(booking);
                    const cellBg = paid
                      ? "bg-[var(--color-success)]/20 hover:bg-[var(--color-success)]/30"
                      : "bg-[var(--color-brand)]/10 hover:bg-[var(--color-brand)]/20";
                    const name = booking.user.displayName || "顧客";
                    const serviceShort =
                      booking.service.name.length > 4
                        ? booking.service.name.slice(0, 4)
                        : booking.service.name;
                    const isDragging = draggedBooking?.id === booking.id;
                    return (
                      <td
                        key={dateStr + hour}
                        rowSpan={booking.slotsOccupied > 1 ? booking.slotsOccupied : 1}
                        className="p-0.5 align-top border-t border-[var(--color-surface)]/60"
                      >
                        <div
                          draggable
                          onDragStart={(e) => {
                            setDraggedBooking(booking);
                            e.dataTransfer.effectAllowed = "move";
                            e.dataTransfer.setData("text/plain", booking.id);
                          }}
                          onDragEnd={() => {
                            setDraggedBooking(null);
                            setDragOverSlot(null);
                          }}
                          onClick={() => onOpenBookingDetail(booking)}
                          className={`relative w-full h-full rounded p-1 cursor-grab active:cursor-grabbing transition-all flex flex-col overflow-hidden ${cellBg} ${isDragging ? "opacity-40 ring-2 ring-[var(--color-brand)]" : ""}`}
                          title="點擊查看詳情；拖曳到其他時段可改期"
                        >
                          {!booking.adminAcknowledgedAt && (
                            <span
                              className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-[var(--color-danger)] ring-1 ring-[var(--color-bg)]"
                              aria-label="未讀新預約"
                              title="未讀 — 點擊查看詳情即標記為已讀"
                            />
                          )}
                          <p className="text-[11px] text-[var(--color-text-muted)] font-mono leading-none mb-0.5 truncate">
                            {booking.startTime.slice(0, 5)}
                          </p>
                          <p className="text-[11px] font-semibold text-[var(--color-text-primary)] leading-tight truncate">
                            {name.length > 4 ? name.slice(0, 4) : name}
                          </p>
                          <span className="mt-auto inline-block px-1 py-px rounded bg-[var(--color-bg)]/70 text-[11px] text-[var(--color-text-body)] leading-tight truncate">
                            {serviceShort}
                          </span>
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
                      className="p-0.5 border-t border-[var(--color-surface)]/60"
                    >
                      <div
                        className={`w-full h-full rounded transition-colors cursor-pointer ${
                          isDropTarget
                            ? "bg-[var(--color-brand)]/30 ring-2 ring-[var(--color-brand)]"
                            : draggedBooking
                              ? "hover:bg-[var(--color-brand)]/15"
                              : "hover:bg-[var(--color-surface)]/50"
                        }`}
                        onClick={() => {
                          if (draggedBooking) return;
                          setCurrentDate(d);
                          setView("day");
                        }}
                        onDragOver={(e) => {
                          if (!draggedBooking) return;
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
          const top = WEEK_THEAD_HEIGHT + (h - 11 + m / 60) * WEEK_ROW_HEIGHT;
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
