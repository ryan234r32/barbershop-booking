"use client";

/**
 * Keyboard shortcuts for the admin calendar (PRD-v3 D-12 a11y baseline).
 * Only active when the calendar page is mounted; ignored while typing in
 * inputs / textareas / contenteditable so we don't hijack the user.
 *
 *   D / W / M  → switch view (Day / Week / Month)
 *   T          → jump to today
 *   J / →      → next day / week / month
 *   K / ←      → previous day / week / month
 *   C          → open new-booking sheet (FAB equivalent)
 *   ?          → show a help banner (handled by parent if desired)
 */

import { useEffect } from "react";
import type { CalendarView } from "./types";

interface Options {
  enabled?: boolean;
  setView: (v: CalendarView) => void;
  goToday: () => void;
  navigate: (delta: 1 | -1) => void;
  openCreate: () => void;
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

export function useCalendarShortcuts({
  enabled = true,
  setView,
  goToday,
  navigate,
  openCreate,
}: Options) {
  useEffect(() => {
    if (!enabled) return;
    const handler = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTypingTarget(e.target)) return;

      switch (e.key) {
        case "d":
        case "D":
          setView("day");
          break;
        case "w":
        case "W":
          setView("week");
          break;
        case "m":
        case "M":
          setView("month");
          break;
        case "t":
        case "T":
          goToday();
          break;
        case "j":
        case "J":
        case "ArrowRight":
          navigate(1);
          break;
        case "k":
        case "K":
        case "ArrowLeft":
          navigate(-1);
          break;
        case "c":
        case "C":
          openCreate();
          break;
        default:
          return;
      }
      e.preventDefault();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [enabled, setView, goToday, navigate, openCreate]);
}
