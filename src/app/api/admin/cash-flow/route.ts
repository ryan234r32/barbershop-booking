import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminFromCookie } from "@/lib/auth/jwt";
import { errorResponse, UnauthorizedError } from "@/lib/utils/errors";
import { todayInTaipei } from "@/lib/utils/time";

// Keep in sync with PaymentMethod enum in prisma/schema.prisma.
// Phase 2 will add CREDIT_CARD / LINE_PAY / JKO / OTHER.
type MethodKey = "CASH" | "BANK_TRANSFER" | "ECPAY_ATM";

/**
 * GET /api/admin/cash-flow?date=YYYY-MM-DD
 *
 * V3.5 §1.1.5 每日現金流頁面 — answers 「今天收了多少 + 怎麼來的」.
 *
 * Returns receipts (status = RECEIVED) bucketed by:
 *   - source: fromCheckout (booking status = COMPLETED) vs fromDeposit (any
 *     other status, e.g. CONFIRMED with ECPay pre-pay or future bookings)
 *   - method: CASH / BANK_TRANSFER / ECPAY_ATM (enum-driven; Phase 2 will
 *     add CREDIT_CARD / LINE_PAY / etc.)
 *
 * Date semantics: filters on Payment.receivedAt converted to Asia/Taipei
 * day boundaries. A booking received at 23:30 UTC on 4/26 = 7:30 Taipei on
 * 4/27 → counts under 4/27.
 *
 * Admin-only. Tenant-scoped via booking.tenantId.
 */
export async function GET(request: NextRequest) {
  try {
    const admin = await getAdminFromCookie(request);
    if (!admin) throw new UnauthorizedError();

    const { searchParams } = request.nextUrl;
    const dateParam = searchParams.get("date");

    // Default: today (Taipei). Uses todayInTaipei() — nowTaipei() has a UTC-server
    // day-shift bug that defaults this to tomorrow during Taipei afternoon.
    const targetDateStr = dateParam || todayInTaipei();

    // Validate YYYY-MM-DD format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDateStr)) {
      return Response.json(
        { error: "invalid_date", message: "date must be YYYY-MM-DD" },
        { status: 400 },
      );
    }

    // Build [start, end) window in UTC corresponding to the Taipei calendar day.
    // Taipei is UTC+8 with no DST → simple offset.
    const [y, m, d] = targetDateStr.split("-").map(Number);
    const start = new Date(Date.UTC(y, m - 1, d, -8, 0, 0)); // 00:00 Taipei
    const end = new Date(Date.UTC(y, m - 1, d + 1, -8, 0, 0)); // 24:00 Taipei

    // Pull all RECEIVED payments in the window for this tenant. Tenant scope
    // is enforced via the nested booking relation. We deliberately don't read
    // booking.status here — see the source-classification comment below.
    const payments = await prisma.payment.findMany({
      where: {
        status: "RECEIVED",
        receivedAt: { gte: start, lt: end },
        booking: { tenantId: admin.tenantId },
      },
      select: {
        amount: true,
        method: true,
        receivedAt: true,
      },
    });

    // Initialize per-method buckets so the response shape is stable even
    // when no rows exist for a given method.
    type MethodBucket = { fromCheckout: number; fromDeposit: number; total: number };
    const byMethod: Record<MethodKey, MethodBucket> = {
      CASH: { fromCheckout: 0, fromDeposit: 0, total: 0 },
      BANK_TRANSFER: { fromCheckout: 0, fromDeposit: 0, total: 0 },
      ECPAY_ATM: { fromCheckout: 0, fromDeposit: 0, total: 0 },
    };

    let totalReceived = 0;
    let fromCheckout = 0;
    let fromDeposit = 0;

    // Source classification — method-based, not status-based.
    //
    // The intuition: in this shop today, only ECPay produces a "deposit" (Tier
    // S virtual ATM account = pre-pay before the service). CASH + BANK_TRANSFER
    // are recorded by the admin at checkout time. So `method === "ECPAY_ATM"`
    // is the deterministic signal for "this is a deposit".
    //
    // Why not the original `booking.status === "COMPLETED"` heuristic? It was
    // unstable: a deposit collected for a CONFIRMED booking would silently
    // reclassify into `fromCheckout` once the booking flipped to COMPLETED at
    // checkout time, retroactively rewriting an old day's report even though
    // `receivedAt` never moved. (Codex P1, 2026-04-27.)
    //
    // If/when the shop starts accepting bank-transfer deposits separately
    // from on-site checkout, switch to a persisted `Payment.source` enum.
    for (const p of payments) {
      const bucket = byMethod[p.method as MethodKey];
      if (!bucket) continue; // unknown enum value (forward compat) — skip
      const isDeposit = p.method === "ECPAY_ATM";
      if (isDeposit) {
        bucket.fromDeposit += p.amount;
        fromDeposit += p.amount;
      } else {
        bucket.fromCheckout += p.amount;
        fromCheckout += p.amount;
      }
      bucket.total += p.amount;
      totalReceived += p.amount;
    }

    return Response.json({
      date: targetDateStr,
      totalReceived,
      fromCheckout,
      fromDeposit,
      byMethod,
      count: payments.length,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
