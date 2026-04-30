/**
 * V3.7 §E (老闆 confirm 5.4) — append a correction note to Payment.notes.
 *
 * Per old-boss decision: original `transferLastFive` is locked (audit trail).
 * If the customer typed the wrong 5-digit, the admin writes a correction
 * reason here ("實際末五是 67890") and we append it to Payment.notes with a
 * timestamp + adminId prefix. Reads stay 5-min-cached on the client.
 *
 * PATCH /api/payment-notes/[paymentId]
 *   body: { reason: string }   (1-500 chars)
 *   appends `[YYYY-MM-DD HH:MM admin=<id>] <reason>` to Payment.notes
 *   never overwrites previous notes; never touches transferLastFive.
 *
 * NOTE: This used to live at /api/payments/[paymentId]/note but Next.js
 * forbids two different dynamic slug names ([bookingId] vs [paymentId]) on
 * the same path level. The /api/payments/[bookingId]/* family is older +
 * larger, so the note route moved out into its own /payment-notes/ tree.
 * The conflict caused INTERNAL_FUNCTION_INVOCATION_TIMEOUT 504s on every
 * /api/* route in prod — this rename is the hotfix.
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminFromCookie } from "@/lib/auth/jwt";
import { errorResponse, AppError, UnauthorizedError } from "@/lib/utils/errors";

type RouteParams = { params: Promise<{ paymentId: string }> };

const MAX_REASON_LEN = 500;

function nowTaipeiStamp(): string {
  return new Date().toLocaleString("sv-SE", { timeZone: "Asia/Taipei" }).replace(/-(\d{2})$/, "-$1");
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const admin = await getAdminFromCookie(request);
    if (!admin) throw new UnauthorizedError();

    const { paymentId } = await params;
    const body = (await request.json().catch(() => ({}))) as { reason?: unknown };
    const raw = typeof body.reason === "string" ? body.reason.trim() : "";
    if (!raw) {
      throw new AppError("修正原因為必填", 400, "EMPTY_REASON");
    }
    if (raw.length > MAX_REASON_LEN) {
      throw new AppError(
        `修正原因過長（最多 ${MAX_REASON_LEN} 字）`,
        400,
        "REASON_TOO_LONG",
      );
    }

    // Tenant-scoped fetch — payment must belong to a booking in admin's tenant.
    const payment = await prisma.payment.findFirst({
      where: { id: paymentId, booking: { tenantId: admin.tenantId } },
      select: { id: true, notes: true },
    });
    if (!payment) {
      throw new AppError("找不到付款記錄", 404, "PAYMENT_NOT_FOUND");
    }

    const stamp = nowTaipeiStamp().slice(0, 16); // "YYYY-MM-DD HH:MM"
    const entry = `[${stamp} admin=${admin.adminId}] ${raw}`;
    const nextNotes = payment.notes
      ? `${payment.notes}\n${entry}`.slice(0, 4000) // hard cap to prevent runaway
      : entry;

    const updated = await prisma.payment.update({
      where: { id: paymentId },
      data: { notes: nextNotes },
      select: { id: true, notes: true },
    });

    return Response.json({ ok: true, payment: updated });
  } catch (err) {
    return errorResponse(err);
  }
}
