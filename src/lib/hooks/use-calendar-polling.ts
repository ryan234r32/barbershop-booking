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
  isLoading: boolean;
  onNearingEnd: (booking: T) => void;
}

const SEEN_KEY = "admin-seen-booking-ids";
const SEEN_MAX = 500; // keep last 500 IDs, prune old

function loadSeen(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    if (!raw) return new Set();
    const ids: string[] = JSON.parse(raw);
    return new Set(ids);
  } catch {
    return new Set();
  }
}

function saveSeen(ids: Set<string>) {
  if (typeof window === "undefined") return;
  const arr = Array.from(ids);
  const trimmed = arr.length > SEEN_MAX ? arr.slice(arr.length - SEEN_MAX) : arr;
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify(trimmed));
  } catch {
    // localStorage may be full; silent
  }
}

/**
 * Detects new bookings (toast notification) and near-end bookings (callback).
 * Uses localStorage to persist "seen" booking IDs across sessions,
 * so the same booking only triggers a toast once ever.
 */
export function useCalendarPolling<T extends Booking>({
  bookings,
  isLoading,
  onNearingEnd,
}: UseCalendarPollingOptions<T>) {
  const { toast } = useToast();
  const seenRef = useRef<Set<string> | null>(null);
  const firstLoadRef = useRef(true);

  // Detect new bookings
  useEffect(() => {
    if (isLoading) return;

    // First load: seed seenRef from localStorage, and mark all currently-visible
    // bookings as seen without toasting (they already existed when user arrived).
    if (firstLoadRef.current) {
      const seen = loadSeen();
      for (const b of bookings) seen.add(b.id);
      saveSeen(seen);
      seenRef.current = seen;
      firstLoadRef.current = false;
      return;
    }

    if (!seenRef.current) return;

    // Subsequent updates — toast only truly new bookings
    let changed = false;
    for (const b of bookings) {
      if (!seenRef.current.has(b.id) && b.status === "CONFIRMED") {
        toast({
          type: "info",
          message: `新預約！${b.user.displayName || "顧客"} ${b.startTime} ${b.service.name}`,
        });
        seenRef.current.add(b.id);
        changed = true;
      }
    }

    if (changed) saveSeen(seenRef.current);
  }, [bookings, isLoading, toast]);

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
