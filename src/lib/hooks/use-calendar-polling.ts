"use client";

import { useEffect, useRef, useCallback } from "react";
import { useToast } from "@/components/ui/toast";

interface Booking {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  service: { name: string; slotsNeeded: number };
  user: { displayName: string | null };
}

interface UseCalendarPollingOptions<T extends Booking = Booking> {
  bookings: T[];
  onNearingEnd: (booking: T) => void;
}

/**
 * Detects new bookings (toast notification) and near-end bookings (callback).
 * Runs only on the calendar page. Pauses when page is hidden.
 */
export function useCalendarPolling<T extends Booking>({ bookings, onNearingEnd }: UseCalendarPollingOptions<T>) {
  const { toast } = useToast();
  const prevIdsRef = useRef<Set<string>>(new Set());
  const initializedRef = useRef(false);

  // Detect new bookings
  useEffect(() => {
    const currentIds = new Set(bookings.map((b) => b.id));

    if (!initializedRef.current) {
      prevIdsRef.current = currentIds;
      initializedRef.current = true;
      return;
    }

    // Find new bookings (in current but not in previous)
    for (const b of bookings) {
      if (!prevIdsRef.current.has(b.id) && b.status === "CONFIRMED") {
        // Check localStorage dedup (Web Push may have already notified)
        const dedupKey = `push-${b.id}`;
        const lastPush = localStorage.getItem(dedupKey);
        if (lastPush && Date.now() - parseInt(lastPush) < 5 * 60 * 1000) {
          continue; // Skip — Web Push already showed this within 5 min
        }

        toast({
          type: "info",
          message: `新預約！${b.user.displayName || "顧客"} ${b.startTime} ${b.service.name}`,
        });
      }
    }

    prevIdsRef.current = currentIds;
  }, [bookings, toast]);

  // Detect near-end bookings (endTime - 10min <= now)
  const checkNearEnd = useCallback(() => {
    const now = new Date();
    const taipeiNow = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Taipei" }));
    const todayStr = taipeiNow.toLocaleDateString("en-CA");
    const nowMinutes = taipeiNow.getHours() * 60 + taipeiNow.getMinutes();

    for (const b of bookings) {
      if (b.status !== "CONFIRMED") continue;
      if (!b.date.startsWith(todayStr)) continue;

      const [endH, endM] = b.endTime.split(":").map(Number);
      const endMinutes = endH * 60 + endM;
      const reminderMinutes = endMinutes - 10;

      if (nowMinutes >= reminderMinutes && nowMinutes < endMinutes + 120) {
        onNearingEnd(b);
      }
    }
  }, [bookings, onNearingEnd]);

  useEffect(() => {
    checkNearEnd();
    const interval = setInterval(checkNearEnd, 30000);
    return () => clearInterval(interval);
  }, [checkNearEnd]);
}
