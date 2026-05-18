"use client";

/**
 * Month grid view (PRD-v3 §4 — month view).
 * Google Calendar-style chips per day with service-categorized colors,
 * unack indicator, holiday visual, "+N more" overflow.
 *
 * Extracted from calendar/page.tsx in Wave 3.A / A1 — behavior unchanged.
 */

import React, { memo } from "react";
import { WEEKDAYS, chipClassForStatus, getBookingServicesLabel } from "./utils";
import type { Booking, MonthlySummary } from "./types";

interface Props {
  monthYear: { year: number; month: number };
  bookings: Booking[];
  monthlySummary: MonthlySummary;
  holidayDates: Set<string>;
  todayStr: string;
  setCurrentDate: (d: Date) => void;
  setView: (v: "day" | "week" | "month") => void;
}

function MonthViewBase({
  monthYear,
  bookings,
  monthlySummary,
  holidayDates,
  todayStr,
  setCurrentDate,
  setView,
}: Props) {
  return (
    <>
      <div className="mb-4">
        {/* Weekday headers */}
        <div className="grid grid-cols-7 mb-1">
          {WEEKDAYS.map((wd) => (
            <div
              key={wd}
              className="text-center text-xs font-medium text-[var(--color-text-muted)] py-1"
            >
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

            for (let i = 0; i < firstDay; i++) {
              cells.push(<div key={`empty-${i}`} className="h-[108px]" />);
            }

            for (let day = 1; day <= daysInMonth; day++) {
              const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const summary = monthlySummary[dateStr];
              const count = summary?.count || 0;
              const today = dateStr === todayStr;

              const dayBookingsAll = bookings.filter(
                (b) =>
                  b.date.startsWith(dateStr) &&
                  b.status !== "CANCELLED" &&
                  b.status !== "CANCELLED_BY_ADMIN",
              );
              const unackCount = dayBookingsAll.filter((b) => !b.adminAcknowledgedAt).length;
              const dayBookings = dayBookingsAll
                .sort((a, b) => a.startTime.localeCompare(b.startTime))
                .slice(0, 3);
              const isHoliday = holidayDates.has(dateStr);

              // Density bar (B4 designer review): width = bookings / capacity (9).
              // Color shifts green → amber → red as the day fills up. A full
              // month's density is readable in one saccade — no counting.
              const densityRatio = Math.min(1, count / 9);
              const densityWidth = `${Math.round(densityRatio * 100)}%`;
              let densityColor = "bg-[var(--color-success)]";
              if (densityRatio >= 0.85) {
                densityColor = "bg-[var(--color-danger)]";
              } else if (densityRatio >= 0.55) {
                densityColor = "bg-[var(--color-warning)]";
              }

              // Chips: at 108px cell, max 2 fit comfortably with the date row,
              // density bar, and the "+N" overflow. Designer review.
              const visibleChips = dayBookings.slice(0, 2);
              const overflow = count - visibleChips.length;

              cells.push(
                <button
                  key={day}
                  onClick={() => {
                    setCurrentDate(new Date(year, month, day));
                    setView("day");
                  }}
                  className={`h-[108px] rounded-lg flex flex-col items-stretch p-1.5 relative transition-colors hover:bg-[var(--color-surface)] ${
                    isHoliday ? "bg-[var(--color-text-muted)]/10 opacity-70" : ""
                  }`}
                  title={isHoliday ? "公休日" : undefined}
                >
                  {/* Unack: 8px dot in top-right (B4 — designer prefers dot over numeric badge at this size) */}
                  {unackCount > 0 && (
                    <span
                      className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[var(--color-danger)]"
                      aria-label={`${unackCount} 筆未讀新預約`}
                      title={`${unackCount} 筆未讀新預約`}
                    />
                  )}

                  {/* Date row: today gets a filled brand-color circle (B4 — replaces ring outline) */}
                  <div className="flex items-center mb-1">
                    {today ? (
                      <span className="w-5 h-5 rounded-full bg-[var(--color-brand)] text-[var(--color-bg)] text-[12px] font-semibold leading-none inline-flex items-center justify-center">
                        {day}
                      </span>
                    ) : (
                      <span className="text-[13px] font-semibold leading-none text-[var(--color-text-primary)]">
                        {day}
                      </span>
                    )}
                  </div>

                  {/* Density bar (B4 — replaces "合計 N" text label).
                      1.5px tall coloured strip; width scales with count/9. */}
                  {count > 0 && (
                    <div className="h-[2px] w-full bg-[var(--color-surface)] rounded-full overflow-hidden mb-1">
                      <div
                        className={`h-full ${densityColor} transition-all`}
                        style={{ width: densityWidth }}
                        aria-label={`今日 ${count} 預約`}
                      />
                    </div>
                  )}

                  {/* Event chips — color = status (B2). Max 2 visible + overflow pill. */}
                  <div className="flex-1 flex flex-col gap-0.5 items-start w-full">
                    {visibleChips.map((b) => {
                      const chipColor = chipClassForStatus(b);
                      const svc = getBookingServicesLabel(b);
                      const svcAbbr = getBookingServicesLabel(b, { compact: true });
                      return (
                        <div
                          key={b.id}
                          className={`w-full px-1 py-px rounded text-[10px] font-medium leading-tight truncate flex items-center gap-1 ${chipColor}`}
                          title={`${b.startTime} ${svc} · ${b.user.displayName || "顧客"}`}
                        >
                          <span className="font-mono shrink-0">{b.startTime.slice(0, 5)}</span>
                          <span className="font-semibold shrink-0">{svcAbbr}</span>
                        </div>
                      );
                    })}
                    {overflow > 0 && (
                      <span className="text-[10px] text-[var(--color-text-muted)] leading-none pl-0.5">
                        +{overflow}
                      </span>
                    )}
                  </div>
                </button>,
              );
            }

            return cells;
          })()}
        </div>
      </div>

      {/* Status legend (B2 redesign — colour = status; service shown by 剪/燙/染/漂 prefix) */}
      <div className="bg-[var(--color-surface)] rounded-lg px-3 py-2 mb-3 flex items-center gap-3 flex-wrap text-[10px]">
        <span className="text-[var(--color-text-muted)] font-semibold">顏色：</span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded bg-[var(--color-brand)]/30" />
          <span className="text-[var(--color-text-body)]">未付款</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded bg-[var(--color-success)]/40" />
          <span className="text-[var(--color-text-body)]">已付款</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded bg-[var(--color-warning)]/40" />
          <span className="text-[var(--color-text-body)]">待對帳</span>
        </span>
      </div>

      {/* Month summary */}
      <div className="bg-[var(--color-surface)] rounded-lg px-4 py-2.5 text-sm flex items-center justify-between">
        <span className="font-semibold text-[var(--color-text-primary)]">
          本月 {Object.values(monthlySummary).reduce((s, d) => s + d.count, 0)} 預約
        </span>
        <span className="text-[var(--color-text-body)]">
          營收 NT$
          {Object.values(monthlySummary).reduce((s, d) => s + d.revenue, 0).toLocaleString()}
        </span>
      </div>
    </>
  );
}

export const MonthView = memo(MonthViewBase);
