"use client";

/**
 * Persists the admin's last-selected calendar view to localStorage (PRD-v3 D-4).
 * Default = "day" (most-used view per Phase 2 decision).
 * Key: `admin.calendar.lastView` — namespaced for future calendar prefs.
 *
 * Uses useSyncExternalStore so:
 *  - SSR-safe (server snapshot returns DEFAULT_VIEW)
 *  - Cross-tab sync via the native `storage` event
 *  - No setState-in-effect lint surface
 */

import { useCallback, useSyncExternalStore } from "react";
import type { CalendarView } from "./types";

const STORAGE_KEY = "admin.calendar.lastView";
const DEFAULT_VIEW: CalendarView = "day";

function isValidView(v: string | null): v is CalendarView {
  return v === "day" || v === "week" || v === "month";
}

function getSnapshot(): CalendarView {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (isValidView(stored)) return stored;
  } catch {
    // localStorage unavailable (private mode / quota / SSR) — fall through
  }
  return DEFAULT_VIEW;
}

function getServerSnapshot(): CalendarView {
  return DEFAULT_VIEW;
}

function subscribe(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

export function useViewPersistence(): [CalendarView, (v: CalendarView) => void] {
  const view = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setView = useCallback((v: CalendarView) => {
    try {
      localStorage.setItem(STORAGE_KEY, v);
    } catch {
      // ignore — best-effort persistence
    }
    // The native `storage` event only fires in *other* tabs, so dispatch
    // a synthetic one to trigger our own subscriber in this tab.
    if (typeof window !== "undefined") {
      window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY, newValue: v }));
    }
  }, []);

  return [view, setView];
}
