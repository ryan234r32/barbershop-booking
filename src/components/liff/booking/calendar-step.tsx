"use client";

import { useState, useMemo, useCallback } from "react";

// Monday-first weekday labels
const WEEKDAY_NAMES = ["一", "二", "三", "四", "五", "六", "日"];

interface AvailableSlot {
  time: string;
  available: boolean;
  recommended: boolean;
}

export function CalendarStep({
  selectedDate,
  selectedTime,
  availableSlots,
  slotsLoading,
  serviceDuration,
  serviceSlotsNeeded,
  onDateSelect,
  onTimeSelect,
}: {
  selectedDate: string;
  selectedTime: string;
  availableSlots: AvailableSlot[];
  slotsLoading: boolean;
  serviceDuration: number;
  serviceSlotsNeeded: number;
  onDateSelect: (date: string) => void;
  onTimeSelect: (time: string) => void;
}) {
  const today = useMemo(() => new Date(), []);
  const todayStart = useMemo(
    () => new Date(today.getFullYear(), today.getMonth(), today.getDate()),
    [today]
  );

  const [viewMonth, setViewMonth] = useState(
    new Date(today.getFullYear(), today.getMonth(), 1)
  );

  // Build calendar cells for Monday-first grid
  const days = useMemo(() => {
    const year = viewMonth.getFullYear();
    const month = viewMonth.getMonth();
    const firstDayOfMonth = new Date(year, month, 1);
    // getDay() returns 0=Sun..6=Sat. Convert to Monday-first: Mon=0..Sun=6
    let startOffset = firstDayOfMonth.getDay() - 1;
    if (startOffset < 0) startOffset = 6; // Sunday wraps to index 6
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const cells: (number | null)[] = [];
    for (let i = 0; i < startOffset; i++) cells.push(null);
    for (let i = 1; i <= daysInMonth; i++) cells.push(i);
    return cells;
  }, [viewMonth]);

  const maxDate = useMemo(() => {
    const d = new Date(todayStart);
    d.setDate(d.getDate() + 30);
    return d;
  }, [todayStart]);

  const getDayInfo = useCallback(
    (day: number | null) => {
      if (day === null) return { selectable: false, isToday: false, isPast: false, isMonday: false };
      const date = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), day);
      const isPast = date <= todayStart;
      const isMonday = date.getDay() === 1; // Monday = closed
      const isBeyondMax = date > maxDate;
      const isToday =
        day === today.getDate() &&
        viewMonth.getMonth() === today.getMonth() &&
        viewMonth.getFullYear() === today.getFullYear();

      return {
        selectable: !isPast && !isMonday && !isBeyondMax,
        isToday,
        isPast: isPast || isBeyondMax,
        isMonday,
      };
    },
    [viewMonth, today, todayStart, maxDate]
  );

  const formatDateStr = useCallback(
    (day: number) => {
      const y = viewMonth.getFullYear();
      const m = (viewMonth.getMonth() + 1).toString().padStart(2, "0");
      const d = day.toString().padStart(2, "0");
      return `${y}-${m}-${d}`;
    },
    [viewMonth]
  );

  const isSelectedDay = useCallback(
    (day: number) => {
      if (!selectedDate) return false;
      return selectedDate === formatDateStr(day);
    },
    [selectedDate, formatDateStr]
  );

  const prevMonth = () => {
    setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1));
  };

  const goToToday = () => {
    setViewMonth(new Date(today.getFullYear(), today.getMonth(), 1));
  };

  const monthLabel = `${viewMonth.getMonth() + 1} 月 ${viewMonth.getFullYear()}`;

  // Compute end time for duration hint
  const endTime = useMemo(() => {
    if (!selectedTime) return "";
    const startHour = parseInt(selectedTime.split(":")[0]);
    const endHour = startHour + serviceSlotsNeeded;
    return `${endHour.toString().padStart(2, "0")}:00`;
  }, [selectedTime, serviceSlotsNeeded]);

  // Split available slots into morning / afternoon
  const morningSlots = useMemo(
    () => availableSlots.filter((s) => parseInt(s.time.split(":")[0]) < 12),
    [availableSlots]
  );
  const afternoonSlots = useMemo(
    () => availableSlots.filter((s) => parseInt(s.time.split(":")[0]) >= 12),
    [availableSlots]
  );

  // Display date for time slot panel title
  const slotPanelDate = useMemo(() => {
    if (!selectedDate) return "";
    const parts = selectedDate.split("-");
    return `${parseInt(parts[1])}/${parseInt(parts[2])}`;
  }, [selectedDate]);

  return (
    <div>
      {/* Step label */}
      <span className="font-headline text-[10px] tracking-[0.15em] font-semibold text-[#003D2B]/60 uppercase">
        STEP 02
      </span>
      <h2 className="font-headline font-bold text-[2rem] text-[#003D2B] mt-2 mb-8">
        選擇日期與時段
      </h2>

      {/* Month navigation */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-1">
          <button
            onClick={prevMonth}
            className="p-1 text-[#003D2B]/40 hover:text-[#003D2B] transition-colors"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
              chevron_left
            </span>
          </button>
          <span className="font-headline font-semibold text-sm text-[#003D2B] min-w-[120px] text-center">
            {monthLabel}
          </span>
          <button
            onClick={nextMonth}
            className="p-1 text-[#003D2B]/40 hover:text-[#003D2B] transition-colors"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
              chevron_right
            </span>
          </button>
        </div>
        <button
          onClick={goToToday}
          className="text-sm font-bold text-[#003D2B]"
        >
          今天
        </button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 mb-1">
        {WEEKDAY_NAMES.map((name) => (
          <div
            key={name}
            className="text-center text-xs font-semibold text-[#003D2B]/50 py-2"
          >
            {name}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7">
        {days.map((day, i) => {
          if (day === null) {
            return <div key={`empty-${i}`} />;
          }

          const { selectable, isToday, isPast, isMonday } = getDayInfo(day);
          const selected = isSelectedDay(day);
          const dimmed = isPast || isMonday;

          return (
            <button
              key={day}
              disabled={!selectable}
              onClick={() => selectable && onDateSelect(formatDateStr(day))}
              className={`
                relative text-center py-3 text-sm flex flex-col items-center justify-center
                ${dimmed ? "text-[#003D2B]/25 cursor-not-allowed" : "text-[#003D2B] cursor-pointer"}
                ${isToday && !selected ? "font-bold" : ""}
              `}
            >
              {selected ? (
                <span className="w-10 h-10 bg-[#003D2B] rounded-full flex items-center justify-center text-white font-bold text-sm">
                  {day}
                </span>
              ) : (
                <span>{day}</span>
              )}
              {/* Today dot */}
              {isToday && !selected && (
                <span className="absolute bottom-1.5 w-1 h-1 bg-[#003D2B] rounded-full" />
              )}
            </button>
          );
        })}
      </div>

      {/* Time slots panel */}
      {selectedDate && (
        <div className="bg-[#faf2ea] rounded-xl p-4 mt-6 mb-6">
          <span className="text-xs font-medium text-[#003D2B]/40 block mb-4">
            {slotPanelDate} 可預約時間
          </span>

          {slotsLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-5 h-5 border-2 border-[#003D2B]/20 border-t-[#003D2B] rounded-full animate-spin" />
            </div>
          ) : availableSlots.length === 0 ? (
            <p className="text-sm text-[#003D2B]/50 text-center py-4">
              這天沒有可用的時段，請選擇其他日期
            </p>
          ) : (
            <div className="space-y-5">
              {/* Morning slots */}
              {morningSlots.length > 0 && (
                <div>
                  <span className="text-[10px] tracking-[0.15em] font-bold text-[#003D2B]/50 block mb-3 uppercase">
                    上午
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {morningSlots.map((slot) => (
                      <TimeSlotButton
                        key={slot.time}
                        slot={slot}
                        isSelected={selectedTime === slot.time}
                        onSelect={onTimeSelect}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Afternoon slots */}
              {afternoonSlots.length > 0 && (
                <div>
                  <span className="text-[10px] tracking-[0.15em] font-bold text-[#003D2B]/50 block mb-3 uppercase">
                    下午
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {afternoonSlots.map((slot) => (
                      <TimeSlotButton
                        key={slot.time}
                        slot={slot}
                        isSelected={selectedTime === slot.time}
                        onSelect={onTimeSelect}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Duration hint box */}
      {selectedTime && (
        <div className="bg-[#FFF8F1] p-4 border-l-[3px] border-[#003D2B] shadow-sm mb-12">
          <span className="text-xs text-[#003D2B]/60 block">
            預約時長：{serviceDuration} 分鐘
          </span>
          <span className="text-sm text-[#003D2B] font-bold mt-1 block">
            你的預約時間：{selectedTime} — {endTime}
          </span>
        </div>
      )}
    </div>
  );
}

/** Individual time slot button */
function TimeSlotButton({
  slot,
  isSelected,
  onSelect,
}: {
  slot: AvailableSlot;
  isSelected: boolean;
  onSelect: (time: string) => void;
}) {
  if (!slot.available) return null;

  return (
    <div className="relative">
      {/* Recommended badge */}
      {slot.recommended && !isSelected && (
        <span className="absolute -top-2 -right-2 bg-[#003D2B] text-[8px] text-[#FFF8F1] px-1.5 py-0.5 rounded-sm font-bold z-10">
          推薦
        </span>
      )}
      <button
        onClick={() => onSelect(slot.time)}
        className={`
          px-6 py-2.5 text-sm font-bold rounded-lg transition-all duration-200
          ${
            isSelected
              ? "bg-[#003D2B] text-[#FFF8F1] shadow-md"
              : "border-[1.5px] border-[#c0c9c2] text-[#003D2B]/70 hover:border-[#003D2B]/40"
          }
        `}
      >
        {slot.time}
      </button>
    </div>
  );
}
