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
    /** "manual-{adminId}-{uuid}" 表示 admin 手動建單但客人尚未綁 LINE。
     *  CheckoutFullPage 會偵測這個前綴跳出 QR 邀請流程。 */
    lineUserId: string;
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
  /// V3.5 夯客 §1.2: NULL = 尚未到來；NOT NULL = 已報到。
  /// (status=NO_SHOW for 爽約; status=COMPLETED for 已結帳.)
  checkedInAt?: string | null;
  updatedAt?: string;
}

export interface MonthlySummary {
  [date: string]: { count: number; revenue: number };
}

export interface HolidayInfo {
  date: string;
  reason?: string | null;
}
