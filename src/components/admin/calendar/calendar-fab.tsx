"use client";

/**
 * Floating "+" action button for quick new-booking creation.
 * Modeled after Google Calendar's FAB. New in Wave 3.A / A1.
 *
 * Position: bottom-right, sticking above the admin tab bar on mobile
 * (tab bar ≈ 64–72 px tall → bottom-20 = 80 px clears it).
 * Hidden when any sheet/modal is open so it doesn't overlap.
 *
 * Click → defers to parent which decides date/time defaults
 * (currently displayed date + next-on-the-hour slot, falling back
 * to today/tomorrow if past business hours — see CalendarPage.handleFabClick).
 */

import { Plus } from "lucide-react";

interface Props {
  onClick: () => void;
  /** When true, the FAB is hidden — typically when a sheet/modal is open. */
  hidden?: boolean;
  ariaLabel?: string;
}

export function CalendarFab({ onClick, hidden = false, ariaLabel = "新增預約" }: Props) {
  if (hidden) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className="
        fixed z-30
        bottom-20 right-4 md:bottom-6 md:right-6
        w-14 h-14 rounded-full
        bg-[var(--color-brand)] text-[var(--color-bg)]
        shadow-lg hover:shadow-xl
        flex items-center justify-center
        transition-all
        hover:scale-105 active:scale-95
        focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)] focus:ring-offset-2
      "
    >
      <Plus size={28} strokeWidth={2.5} />
    </button>
  );
}
