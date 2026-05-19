/**
 * Single source of truth for "which booking is the customer paying for right now?"
 *
 * Used by:
 *   - LINE webhook `payment` intent       (paymentGuideMessage Flex shown to customer)
 *   - LINE webhook `payment-last5` intent (writes Payment.transferLastFive)
 *
 * Both MUST agree on the target booking, otherwise:
 *   - Customer sees "NT$ 1,000 男性剪髮 今天" in Flex
 *   - But 5-digit gets recorded against tomorrow's 漂髮 NT$ 2,600
 *   ← real bug observed 2026-04-29
 *
 * Rules:
 *   - Booking status: CONFIRMED OR COMPLETED
 *     (V3.7 P3 5/19 bug fix: admin checkout sets COMPLETED + payment RECEIVED
 *      immediately even for BANK_TRANSFER without last5 → customer types 5 碼
 *      later → lookup must still find the booking)
 *   - Window: -3 days to +7 days from now
 *   - Eligible when payment is null OR (method=BANK_TRANSFER AND transferLastFive=null)
 *     i.e. waiting for the customer to report 後 5 碼; we DON'T gate on
 *     payment.status because admin checkout flows set RECEIVED prematurely.
 *   - Tie-break: closest endTime to "now"
 */

import { prisma } from "@/lib/prisma";
import { TIMEZONE } from "@/lib/utils/constants";

const PAST_WINDOW_DAYS = 3;
const FUTURE_WINDOW_DAYS = 7;

export interface EligibleBooking {
  id: string;
  tenantId: string;
  date: Date;
  startTime: string;
  endTime: string;
  service: { name: string; price: number };
  payment: { status: string; transferLastFive: string | null; method: string | null } | null;
}

export interface PickResult {
  /** The eligible booking, if any */
  eligible: EligibleBooking | null;
  /** True when there ARE confirmed bookings in the window but ALL have terminal payment status */
  hasOnlyPaidBookings: boolean;
  /** True when no bookings in the window at all (truly no recent activity) */
  hasNoBookings: boolean;
}

/**
 * Pick the booking the customer is most likely paying for right now.
 *
 * @param userId — the User.id (NOT lineUserId)
 * @param tenantId
 * @returns PickResult — see fields above
 */
export async function pickEligibleBookingForPayment(
  userId: string,
  tenantId: string,
): Promise<PickResult> {
  const now = new Date();
  const pastCutoff = new Date(now.getTime() - PAST_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const futureCutoff = new Date(now.getTime() + FUTURE_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const candidates = await prisma.booking.findMany({
    where: {
      userId,
      tenantId,
      // V3.7 P3 (5/19) — also include COMPLETED bookings because admin checkout
      // for BANK_TRANSFER marks booking COMPLETED + payment RECEIVED immediately
      // (even without last5). Customer types 5 碼 later — still need to match.
      status: { in: ["CONFIRMED", "COMPLETED"] },
      date: { gte: pastCutoff, lte: futureCutoff },
    },
    include: {
      service: { select: { name: true, price: true } },
      payment: { select: { status: true, transferLastFive: true, method: true } },
    },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
    take: 20,
  });

  // V3.7 P3 (5/19) — eligibility shifts from "payment status non-terminal" to
  // "waiting for last5 input". Admin checkout sets RECEIVED + null transferLastFive,
  // that's STILL waiting on the customer.
  const eligible = candidates.filter((b) => {
    if (!b.payment) return true; // no payment row → still need one
    if (b.payment.transferLastFive) return false; // already reported
    // Has payment row, no last5 → eligible IF this is a bank transfer flow.
    // CASH with no last5 = done (admin took cash, no 5-digit step expected).
    if (b.payment.method === "CASH") return false;
    return true;
  });

  if (eligible.length === 0) {
    return {
      eligible: null,
      hasOnlyPaidBookings: candidates.length > 0,
      hasNoBookings: candidates.length === 0,
    };
  }

  // Score each by abs distance from now (using endTime in Taipei).
  // Closest = picked. Just-finished service usually wins over far-future booking.
  const scored = eligible.map((b) => {
    const dStr = b.date.toLocaleDateString("en-CA", { timeZone: TIMEZONE });
    const [y, m, d] = dStr.split("-").map(Number);
    const [eH] = b.endTime.split(":").map(Number);
    const endUtcMs = Date.UTC(y, m - 1, d, eH - 8, 0, 0);
    return { booking: b, distance: Math.abs(endUtcMs - now.getTime()) };
  });
  scored.sort((a, b) => a.distance - b.distance);

  return {
    eligible: scored[0].booking,
    hasOnlyPaidBookings: false,
    hasNoBookings: false,
  };
}
