"use client";

import { useState, useEffect, useMemo, useTransition } from "react";
import { usePageTitle } from "@/lib/hooks/use-page-title";

interface Booking {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  slotsOccupied: number;
  service: { name: string; price: number };
  user: { displayName: string | null; phone: string | null };
}

const HOURS = Array.from({ length: 9 }, (_, i) => `${(11 + i).toString().padStart(2, "0")}:00`);
const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

const STATUS_BG: Record<string, string> = {
  CONFIRMED: "bg-emerald-200 border-emerald-400 text-emerald-800",
  COMPLETED: "bg-blue-200 border-blue-400 text-blue-800",
  CANCELLED: "bg-gray-200 border-gray-300 text-gray-500",
  NO_SHOW: "bg-red-200 border-red-400 text-red-800",
};

export default function CalendarPage() {
  usePageTitle("行事曆");
  const [view, setView] = useState<"day" | "week">("week");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isPending, startTransition] = useTransition();

  // Get week range
  const weekDates = useMemo(() => {
    const start = new Date(currentDate);
    const day = start.getDay();
    start.setDate(start.getDate() - day + 1); // Monday
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [currentDate]);

  const dateRange = view === "week"
    ? {
        start: weekDates[0].toISOString().split("T")[0],
        end: weekDates[6].toISOString().split("T")[0],
      }
    : {
        start: currentDate.toISOString().split("T")[0],
        end: currentDate.toISOString().split("T")[0],
      };

  useEffect(() => {
    startTransition(async () => {
      try {
        // Fetch all bookings in range
        const dates = view === "week" ? weekDates : [currentDate];
        const fetches = dates.map((d) =>
          fetch(`/api/bookings?date=${d.toISOString().split("T")[0]}`).then((r) => r.json())
        );
        const results = await Promise.all(fetches);
        const all = results.flatMap((r) => r.bookings || []);
        setBookings(all);
      } catch (err) {
        console.error(err);
      }
    });
  }, [dateRange.start, dateRange.end, view, weekDates, currentDate]);

  const getBookingAt = (date: Date, hour: string) => {
    const dateStr = date.toISOString().split("T")[0];
    return bookings.filter(
      (b) =>
        b.date.startsWith(dateStr) &&
        b.startTime <= hour &&
        b.endTime > hour &&
        b.status !== "CANCELLED" &&
        b.status !== "CANCELLED_BY_ADMIN"
    );
  };

  const navigate = (delta: number) => {
    const d = new Date(currentDate);
    if (view === "week") d.setDate(d.getDate() + delta * 7);
    else d.setDate(d.getDate() + delta);
    setCurrentDate(d);
  };

  const displayDates = view === "week" ? weekDates : [currentDate];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          行事曆
          {isPending && (
            <span className="ml-2 inline-block w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin align-middle" />
          )}
        </h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setView("day")}
            className={`px-3 py-1.5 text-sm rounded-lg ${view === "day" ? "bg-emerald-500 text-white" : "bg-gray-100 text-gray-600"}`}
          >
            日
          </button>
          <button
            onClick={() => setView("week")}
            className={`px-3 py-1.5 text-sm rounded-lg ${view === "week" ? "bg-emerald-500 text-white" : "bg-gray-100 text-gray-600"}`}
          >
            週
          </button>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-lg">
          ‹ 上一{view === "week" ? "週" : "天"}
        </button>
        <button
          onClick={() => setCurrentDate(new Date())}
          className="text-sm text-emerald-600 font-medium"
        >
          今天
        </button>
        <button onClick={() => navigate(1)} className="p-2 hover:bg-gray-100 rounded-lg">
          下一{view === "week" ? "週" : "天"} ›
        </button>
      </div>

      {/* Grid */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="w-16 p-2 text-xs text-gray-400 font-medium">時段</th>
              {displayDates.map((d) => {
                const isToday = d.toDateString() === new Date().toDateString();
                return (
                  <th
                    key={d.toISOString()}
                    className={`p-2 text-center text-sm ${isToday ? "bg-emerald-50" : ""}`}
                  >
                    <span className="text-gray-400 text-xs">{WEEKDAYS[d.getDay()]}</span>
                    <br />
                    <span className={`font-medium ${isToday ? "text-emerald-600" : "text-gray-700"}`}>
                      {d.getDate()}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {HOURS.map((hour) => (
              <tr key={hour} className="border-b border-gray-50">
                <td className="p-2 text-xs text-gray-400 text-center font-mono">
                  {hour}
                </td>
                {displayDates.map((d) => {
                  const cellBookings = getBookingAt(d, hour);
                  const isToday = d.toDateString() === new Date().toDateString();
                  return (
                    <td
                      key={d.toISOString() + hour}
                      className={`p-1 h-14 ${isToday ? "bg-emerald-50/30" : ""}`}
                    >
                      {cellBookings.map((b) =>
                        b.startTime === hour ? (
                          <div
                            key={b.id}
                            className={`text-xs p-1 rounded border ${STATUS_BG[b.status] || "bg-gray-100"} truncate`}
                            title={`${b.user.displayName || "顧客"} - ${b.service.name}`}
                          >
                            <span className="font-medium">
                              {b.user.displayName?.slice(0, 4) || "顧客"}
                            </span>
                            <br />
                            <span className="opacity-70">{b.service.name}</span>
                          </div>
                        ) : null
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
