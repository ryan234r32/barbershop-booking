"use client";

import { useState, useMemo } from "react";

const WEEKDAY_NAMES = ["日", "一", "二", "三", "四", "五", "六"];

export function CalendarStep({
  onSelect,
  onBack,
}: {
  onSelect: (date: string) => void;
  onBack: () => void;
}) {
  const today = new Date();
  const [viewMonth, setViewMonth] = useState(
    new Date(today.getFullYear(), today.getMonth(), 1)
  );

  const days = useMemo(() => {
    const year = viewMonth.getFullYear();
    const month = viewMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const cells: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let i = 1; i <= daysInMonth; i++) cells.push(i);
    return cells;
  }, [viewMonth]);

  const isSelectable = (day: number | null) => {
    if (day === null) return false;
    const date = new Date(
      viewMonth.getFullYear(),
      viewMonth.getMonth(),
      day
    );
    // Can't book today or past days
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    if (date <= todayStart) return false;
    // Allow up to 30 days ahead
    const maxDate = new Date(todayStart);
    maxDate.setDate(maxDate.getDate() + 30);
    return date <= maxDate;
  };

  const formatDateStr = (day: number) => {
    const y = viewMonth.getFullYear();
    const m = (viewMonth.getMonth() + 1).toString().padStart(2, "0");
    const d = day.toString().padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  const prevMonth = () => {
    setViewMonth(
      new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1)
    );
  };

  const nextMonth = () => {
    setViewMonth(
      new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1)
    );
  };

  const monthLabel = `${viewMonth.getFullYear()} 年 ${viewMonth.getMonth() + 1} 月`;

  return (
    <div>
      <button
        onClick={onBack}
        className="text-sm text-gray-500 mb-4 flex items-center gap-1"
      >
        ← 返回選擇服務
      </button>

      <h2 className="text-lg font-semibold mb-4">選擇日期</h2>

      {/* Month navigation */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={prevMonth}
          className="p-2 hover:bg-gray-100 rounded-lg"
        >
          ‹
        </button>
        <span className="font-medium">{monthLabel}</span>
        <button
          onClick={nextMonth}
          className="p-2 hover:bg-gray-100 rounded-lg"
        >
          ›
        </button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {WEEKDAY_NAMES.map((name) => (
          <div
            key={name}
            className="text-center text-xs text-gray-400 font-medium py-1"
          >
            {name}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((day, i) => {
          if (day === null) {
            return <div key={`empty-${i}`} />;
          }

          const selectable = isSelectable(day);
          const isToday =
            day === today.getDate() &&
            viewMonth.getMonth() === today.getMonth() &&
            viewMonth.getFullYear() === today.getFullYear();

          return (
            <button
              key={day}
              disabled={!selectable}
              onClick={() => onSelect(formatDateStr(day))}
              className={`
                aspect-square flex items-center justify-center rounded-lg text-sm
                ${selectable
                  ? "hover:bg-emerald-50 hover:text-emerald-700 active:bg-emerald-100 cursor-pointer"
                  : "text-gray-300 cursor-not-allowed"
                }
                ${isToday ? "ring-1 ring-emerald-300" : ""}
              `}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}
