"use client";

/**
 * Mini sheet shown when admin taps the FAB "+".
 *
 * Per 老闆 5/19 反饋：原本 FAB 用 currentDate + 11:00 default，
 * 不夠合理。改成：先讓老闆挑日期 / 時間 / 時長，確認後才開 NewBookingSheet。
 *
 * 行為：
 *  - default date = props.defaultDate (頁面當前日期，但若為公休/過去則跳今天)
 *  - default time = props.defaultTime (頁面 next-on-the-hour fallback to 11:00)
 *  - default duration = 1 (小時)
 *  - 阻擋：公休日(整天)無法選 — 顯示警示
 *  - LIFF 只能 HH:00；admin 手動可 HH:00 / HH:30 (V3.7 Tier 1.4)
 *
 * 不會 mutate parent 狀態，只在 onConfirm 時把選定的 date/time/duration 交回。
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import { Modal } from "@/components/ui/modal";

interface HolidayInfo {
  fullDay: boolean;
  startTime: string | null;
  endTime: string | null;
  reason: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  defaultDate: string;
  defaultTime: string;
  defaultDuration?: number;
  holidayMap: Map<string, HolidayInfo>;
  closedWeekdays: number[];
  onConfirm: (date: string, time: string, duration: number) => void;
}

// 11:00 - 19:30 inclusive (last slot must end ≤ 20:00 with 1hr duration).
// Half-hour slots allowed for admin manual booking (V3.7 Tier 1.4).
const HOURS_FULL = Array.from({ length: 18 }, (_, i) => {
  const h = 11 + Math.floor(i / 2);
  const m = i % 2 === 0 ? "00" : "30";
  return `${String(h).padStart(2, "0")}:${m}`;
});

const DURATION_OPTIONS = [1, 2, 3, 4];

function weekdayOf(dateStr: string): number {
  // dateStr is yyyy-mm-dd; treat as local Taipei midnight.
  const d = new Date(dateStr + "T00:00:00+08:00");
  return d.getDay();
}

export function DateTimePickerSheet({
  open,
  onClose,
  defaultDate,
  defaultTime,
  defaultDuration = 1,
  holidayMap,
  closedWeekdays,
  onConfirm,
}: Props) {
  const [date, setDate] = useState(defaultDate);
  const [time, setTime] = useState(defaultTime);
  const [duration, setDuration] = useState(defaultDuration);

  // Re-seed when the sheet opens so default reflects the *current* page state.
  // setState in useEffect IS intentional (rising-edge gate via lastOpenRef
  // prevents loops). The eslint rule trips on this safe pattern.
  const lastOpenRef = useRef(false);
  useEffect(() => {
    if (open && !lastOpenRef.current) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDate(defaultDate);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTime(defaultTime);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDuration(defaultDuration);
    }
    lastOpenRef.current = open;
  }, [open, defaultDate, defaultTime, defaultDuration]);

  const holiday = holidayMap.get(date);
  const isWeekdayClosed = closedWeekdays.includes(weekdayOf(date));
  const isFullDayClosed = (holiday?.fullDay ?? false) || isWeekdayClosed;

  // Partial closure conflict — if chosen time falls inside [startTime, endTime).
  const partialConflict = useMemo(() => {
    if (!holiday || holiday.fullDay) return false;
    if (!holiday.startTime || !holiday.endTime) return false;
    const t = parseInt(time.slice(0, 2), 10) + (time.endsWith(":30") ? 0.5 : 0);
    const cStart = parseInt(holiday.startTime.slice(0, 2), 10);
    const cEnd = parseInt(holiday.endTime.slice(0, 2), 10);
    return t >= cStart && t < cEnd;
  }, [holiday, time]);

  const canConfirm = !isFullDayClosed && !partialConflict;

  const handleConfirm = () => {
    if (!canConfirm) return;
    onConfirm(date, time, duration);
  };

  return (
    <Modal isOpen={open}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-[var(--color-text-primary)]">
          選擇預約時段
        </h2>
        <button
          onClick={onClose}
          aria-label="關閉"
          className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
        >
          <X size={20} />
        </button>
      </div>

      {/* Date picker */}
      <div className="mb-4">
        <label className="block text-xs font-semibold text-[var(--color-text-body)] mb-1.5">
          日期
        </label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full px-3 py-2.5 rounded-lg border border-[var(--color-text-muted)]/30 bg-[var(--color-bg)] text-[var(--color-text-primary)] text-base focus:border-[var(--color-brand)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]/30"
        />
        {isFullDayClosed && (
          <p className="mt-1.5 text-[12px] text-[var(--color-danger)] font-medium">
            {holiday?.reason
              ? `此日為公休（${holiday.reason}）— 請選擇其他日期`
              : holiday?.fullDay
                ? "此日為公休 — 請選擇其他日期"
                : "此週固定公休 — 請選擇其他日期"}
          </p>
        )}
      </div>

      {/* Time picker */}
      <div className="mb-4">
        <label className="block text-xs font-semibold text-[var(--color-text-body)] mb-1.5">
          時間
        </label>
        <select
          value={time}
          onChange={(e) => setTime(e.target.value)}
          disabled={isFullDayClosed}
          className="w-full px-3 py-2.5 rounded-lg border border-[var(--color-text-muted)]/30 bg-[var(--color-bg)] text-[var(--color-text-primary)] text-base focus:border-[var(--color-brand)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]/30 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {HOURS_FULL.map((h) => (
            <option key={h} value={h}>
              {h}
            </option>
          ))}
        </select>
        {!isFullDayClosed && holiday && !holiday.fullDay && holiday.startTime && holiday.endTime && (
          <p className="mt-1.5 text-[12px] text-[var(--color-warning)] font-medium">
            ⓘ 部分公休 {holiday.startTime}-{holiday.endTime}
            {holiday.reason ? `（${holiday.reason}）` : ""}
          </p>
        )}
        {partialConflict && (
          <p className="mt-1.5 text-[12px] text-[var(--color-danger)] font-medium">
            選定時間落在公休時段內 — 請改其他時間
          </p>
        )}
      </div>

      {/* Duration picker */}
      <div className="mb-5">
        <label className="block text-xs font-semibold text-[var(--color-text-body)] mb-1.5">
          時長（小時）
        </label>
        <div className="grid grid-cols-4 gap-2">
          {DURATION_OPTIONS.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDuration(d)}
              className={`py-2.5 rounded-lg text-sm font-semibold transition-colors border ${
                duration === d
                  ? "bg-[var(--color-brand)] text-[var(--color-bg)] border-[var(--color-brand)]"
                  : "bg-[var(--color-bg)] text-[var(--color-text-body)] border-[var(--color-text-muted)]/30 hover:border-[var(--color-brand)]/60"
              }`}
            >
              {d} 小時
            </button>
          ))}
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 py-3 rounded-lg text-sm font-semibold text-[var(--color-text-body)] bg-[var(--color-surface)] hover:bg-[var(--color-surface)]/80 transition-colors"
        >
          取消
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={!canConfirm}
          className="flex-1 py-3 rounded-lg text-sm font-semibold bg-[var(--color-brand)] text-[var(--color-bg)] hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
        >
          下一步
        </button>
      </div>
    </Modal>
  );
}

export type { HolidayInfo };
