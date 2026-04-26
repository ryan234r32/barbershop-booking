/**
 * Shared types for admin calendar views (PRD-v3 §4 / Wave 3.A).
 * Extracted from src/app/(admin)/calendar/page.tsx during the A1 refactor.
 */

export type CalendarView = "day" | "week" | "month";

export interface Booking {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  slotsOccupied: number;
  service: { name: string; price: number; slotsNeeded: number };
  user: {
    id: string;
    displayName: string | null;
    phone: string | null;
    segment: string;
    totalVisits: number;
    notes: string | null;
    lastVisitAt: string | null;
  };
  payment?: { status: string; method: string | null } | null;
  createdAt?: string;
  /// PRD-v3 §2 + 1.6b: NULL = admin hasn't seen this booking yet → 紅點 indicator
  adminAcknowledgedAt?: string | null;
}

export interface MonthlySummary {
  [date: string]: { count: number; revenue: number };
}

export interface HolidayInfo {
  date: string;
  reason?: string | null;
}
