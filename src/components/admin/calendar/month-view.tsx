"use client";

/**
 * Month grid view (PRD-v3 §4 — month view).
 * Google Calendar-style chips per day with service-categorized colors,
 * unack indicator, holiday visual, "+N more" overflow.
 *
 * Extracted from calendar/page.tsx in Wave 3.A / A1 — behavior unchanged.
 */

import React from "react";
import { WEEKDAYS, abbreviateService, chipClassForService, isPaid } from "./utils";
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

export function MonthView({
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

              cells.push(
                <button
                  key={day}
                  onClick={() => {
                    setCurrentDate(new Date(year, month, day));
                    setView("day");
                  }}
                  className={`h-[108px] rounded-lg flex flex-col items-stretch p-1.5 relative transition-colors hover:bg-[var(--color-surface)] ${
                    today ? "ring-2 ring-[var(--color-brand)]" : ""
                  } ${isHoliday ? "bg-[var(--color-text-muted)]/10 opacity-70" : ""}`}
                  title={isHoliday ? "公休日" : undefined}
                >
                  {unackCount > 0 && (
                    <span
                      className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-[var(--color-danger)] text-[10px] font-bold text-white flex items-center justify-center leading-none"
                      aria-label={`${unackCount} 筆未讀新預約`}
                      title={`${unackCount} 筆未讀新預約 — 點進日視圖查看`}
                    >
                      {unackCount > 9 ? "9+" : unackCount}
                    </span>
                  )}

                  <div className="flex items-center justify-between mb-0.5">
                    <span
                      className={`text-[13px] font-semibold leading-none ${today ? "text-[var(--color-brand)]" : "text-[var(--color-text-primary)]"}`}
                    >
                      {day}
                    </span>
                    {count > 0 && (
                      <span className="text-[11px] text-[var(--color-text-muted)] leading-none">
                        合計 {count}
                      </span>
                    )}
                  </div>

                  {/* Event chips Google Calendar style — service-categorized colors */}
                  <div className="flex-1 flex flex-col gap-0.5 items-start w-full">
                    {dayBookings.map((b) => {
                      const paid = isPaid(b);
                      const svc = b.service.name;
                      const chipColor = chipClassForService(svc, paid);
                      const initial = (b.user.displayName || "?").charAt(0);
                      const svcAbbr = abbreviateService(svc);
                      return (
                        <div
                          key={b.id}
                          className={`w-full px-1 py-px rounded text-[10px] font-medium leading-tight truncate flex items-center gap-1 ${chipColor}`}
                          title={`${b.startTime} ${svc} · ${b.user.displayName || "顧客"}`}
                        >
                          <span className="font-mono shrink-0">{b.startTime.slice(0, 5)}</span>
                          <span className="font-semibold shrink-0">{svcAbbr}</span>
                          <span className="truncate opacity-75">{initial}</span>
                        </div>
                      );
                    })}
                    {count > 3 && (
                      <span className="text-[10px] text-[var(--color-text-muted)] leading-none pl-0.5">
                        +{count - 3} more
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

      {/* Color legend */}
      <div className="bg-[var(--color-surface)] rounded-lg px-3 py-2 mb-3 flex items-center gap-3 flex-wrap text-[10px]">
        <span className="text-[var(--color-text-muted)] font-semibold">顏色：</span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded bg-[var(--color-success)]/40" />
          <span className="text-[var(--color-text-body)]">已付款</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded bg-[var(--color-brand)]/30" />
          <span className="text-[var(--color-text-body)]">剪</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded bg-[var(--color-service-perm)]/30" />
          <span className="text-[var(--color-text-body)]">燙</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded bg-[var(--color-service-color)]/30" />
          <span className="text-[var(--color-text-body)]">染</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded bg-[var(--color-warning)]/40" />
          <span className="text-[var(--color-text-body)]">漂</span>
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
