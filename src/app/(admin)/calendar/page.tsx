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
  CONFIRMED: "bg-primary/20 border-primary text-primary",
  COMPLETED: "bg-[var(--color-brand)]/15 border-[var(--color-brand)]/30 text-[var(--color-brand)]",
  CANCELLED: "bg-secondary border-border text-muted-foreground",
  NO_SHOW: "bg-destructive/20 border-destructive/50 text-destructive",
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
        <h1 className="text-2xl font-bold text-foreground">
          行事曆
          {isPending && (
            <span className="ml-2 inline-block w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin align-middle" />
          )}
        </h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setView("day")}
            className={`px-3 py-1.5 text-sm rounded-lg ${view === "day" ? "bg-primary text-white" : "bg-secondary text-muted-foreground"}`}
          >
            日
          </button>
          <button
            onClick={() => setView("week")}
            className={`px-3 py-1.5 text-sm rounded-lg ${view === "week" ? "bg-primary text-white" : "bg-secondary text-muted-foreground"}`}
          >
            週
          </button>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-secondary rounded-lg">
          ‹ 上一{view === "week" ? "週" : "天"}
        </button>
        <button
          onClick={() => setCurrentDate(new Date())}
          className="text-sm text-primary font-medium"
        >
          今天
        </button>
        <button onClick={() => navigate(1)} className="p-2 hover:bg-secondary rounded-lg">
          下一{view === "week" ? "週" : "天"} ›
        </button>
      </div>

      {/* Grid */}
      <div className="bg-card rounded-xl border border-border overflow-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border/50">
              <th className="w-16 p-2 text-xs text-muted-foreground font-medium">時段</th>
              {displayDates.map((d) => {
                const isToday = d.toDateString() === new Date().toDateString();
                return (
                  <th
                    key={d.toISOString()}
                    className={`p-2 text-center text-sm ${isToday ? "bg-primary/10" : ""}`}
                  >
                    <span className="text-muted-foreground text-xs">{WEEKDAYS[d.getDay()]}</span>
                    <br />
                    <span className={`font-medium ${isToday ? "text-primary" : "text-foreground/80"}`}>
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
                <td className="p-2 text-xs text-muted-foreground text-center font-mono">
                  {hour}
                </td>
                {displayDates.map((d) => {
                  const cellBookings = getBookingAt(d, hour);
                  const isToday = d.toDateString() === new Date().toDateString();
                  return (
                    <td
                      key={d.toISOString() + hour}
                      className={`p-1 h-14 ${isToday ? "bg-primary/10/30" : ""}`}
                    >
                      {cellBookings.map((b) =>
                        b.startTime === hour ? (
                          <div
                            key={b.id}
                            className={`text-xs p-1 rounded border ${STATUS_BG[b.status] || "bg-secondary"} truncate`}
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
