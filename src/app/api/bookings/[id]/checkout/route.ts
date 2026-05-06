import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAdminFromCookie } from "@/lib/auth/jwt";
import { errorResponse, UnauthorizedError } from "@/lib/utils/errors";
import { scheduleThankYou, scheduleFollowUp } from "@/lib/notifications/scheduler";
import { issueCouponForCompletedBooking } from "@/lib/coupons/issue";
import { logger } from "@/lib/utils/logger";
import { invalidateReportsCache } from "@/lib/cache/invalidate";
import { getLineClient } from "@/lib/line/client";
import { paymentGuideMessage } from "@/lib/line/messages";
import { TIMEZONE } from "@/lib/utils/constants";

type RouteParams = { params: Promise<{ id: string }> };

const checkoutSchema = z.object({
  /**
   * Phase 1: single payment method per checkout. Phase 2 will switch to
   * `entries: [{ method, amount }, ...]` for multi-method checkout (e.g.
   * 現金 + 信用卡 split). For now we keep the schema flat to avoid a
   * migration on the Payment table.
   */
  method: z.enum(["CASH", "BANK_TRANSFER", "ECPAY_ATM"]),
  /**
   * Override amount when admin grants a discount or adds tip. Defaults to
   * the service price if not provided. `nonnegative` (not `positive`) so
   * a fully-comped visit (NT$0, e.g. friend / 100% discount) goes through
   * — the UI lets admins enter 0 and we don't want a 400 mismatch
   * (Codex P2, 2026-04-27).
   */
  amount: z.number().int().nonnegative().optional(),
  notes: z.string().max(500).optional(),
  /**
   * 老闆 walk-in 結帳時，若客人現場給後 5 碼可直接填（避免之後對不到帳）。
   * 5 位純數字格式驗證；空字串視為未填。
   */
  transferLastFive: z.string().regex(/^\d{5}$/).optional(),
  expectedUpdatedAt: z.string().datetime().optional(),
});

/**
 * POST /api/bookings/[id]/checkout — V3.5 admin completes a booking with payment.
 *
 * This is the V3.5 successor to PATCH /api/bookings/[id] action="complete".
 * Differences from the legacy action:
 *   - Auto-checkin: if booking.checkedInAt is NULL, set it to now() before
 *     completing (per plan §1.2 「結帳前自動補已報到」).
 *   - Always treats the click as a fresh checkout — does not assume an
 *     existing VERIFYING transfer (legacy auto-promotion path remains in
 *     PATCH route for past-due modal).
 *   - Will support multi-method `entries` in Phase 2.
 *
 * Side effects (best-effort, never blocks the response):
 *   - schedule thank-you notification (30 min)
 *   - schedule 7-day follow-up for perm/color services
 *   - issue repurchase coupon (Wave 4c, no-op if tenant flag off)
 *
 * Admin-only.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const admin = await getAdminFromCookie(request);
    if (!admin) throw new UnauthorizedError();

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const input = checkoutSchema.parse(body);

    const booking = await prisma.booking.findFirst({
      where: { id, tenantId: admin.tenantId },
      include: {
        user: { select: { id: true, lineUserId: true, firstVisitAt: true } },
        service: { select: { name: true, price: true } },
      },
    });
    if (!booking) {
      return Response.json({ error: "Booking not found" }, { status: 404 });
    }

    if (booking.status === "COMPLETED") {
      return Response.json(
        {
          ok: true,
          booking: {
            id: booking.id,
            status: booking.status,
            checkedInAt: booking.checkedInAt,
            updatedAt: booking.updatedAt,
          },
          wasNoOp: true,
        },
      );
    }

    if (booking.status !== "CONFIRMED") {
      return Response.json(
        {
          error: "invalid_status",
          message: `只能對「已確認」的預約進行結帳（目前狀態：${booking.status}）`,
        },
        { status: 400 },
      );
    }

    if (
      input.expectedUpdatedAt &&
      new Date(input.expectedUpdatedAt).getTime() !== booking.updatedAt.getTime()
    ) {
      return Response.json(
        {
          error: "stale_write",
          message: "此預約已更新，請重新整理後再試",
          current: { status: booking.status, updatedAt: booking.updatedAt },
        },
        { status: 409 },
      );
    }

    const finalAmount = input.amount ?? booking.service.price;
    const now = new Date();
    const checkedInAt = booking.checkedInAt ?? now; // 結帳前自動補已報到

    const result = await prisma.$transaction(async (tx) => {
      // OCC fence — bail (and roll back) if the row moved.
      const updateResult = await tx.booking.updateMany({
        where: {
          id,
          tenantId: admin.tenantId,
          status: "CONFIRMED",
          updatedAt: booking.updatedAt,
        },
        data: {
          status: "COMPLETED",
          checkedInAt,
        },
      });

      if (updateResult.count === 0) {
        throw new StaleWriteError();
      }

      await tx.user.update({
        where: { id: booking.userId },
        data: {
          totalVisits: { increment: 1 },
          lastVisitAt: now,
          firstVisitAt: booking.user.firstVisitAt || now,
        },
      });

      await tx.payment.upsert({
        where: { bookingId: id },
        create: {
          bookingId: id,
          amount: finalAmount,
          method: input.method,
          status: "RECEIVED",
          receivedAt: now,
          notes: input.notes,
          // 老闆 walk-in 結帳當下若直接問客人後 5 碼，這裡填入；省掉之後對帳工
          transferLastFive: input.transferLastFive,
        },
        update: {
          amount: finalAmount,
          method: input.method,
          status: "RECEIVED",
          receivedAt: now,
          ...(input.notes !== undefined ? { notes: input.notes } : {}),
          // transferLastFive 是 audit trail，已存在的不覆寫；只在新填時 set
          ...(input.transferLastFive ? { transferLastFive: input.transferLastFive } : {}),
        },
      });

      const fresh = await tx.booking.findFirst({
        where: { id },
        select: {
          id: true,
          status: true,
          checkedInAt: true,
          updatedAt: true,
          payment: true,
        },
      });
      return fresh;
    });

    // BANK_TRANSFER + 已綁 LINE + 沒填 5 碼 → 自動推播銀行 Flex 給客人，
    // 客人按 LINE 即可看到帳號 + 金額 + 後續傳 5 碼指引。
    // walk-in (manual-*) 不在這條 — 那條走 admin 邀請加 LINE QR 流程。
    if (
      input.method === "BANK_TRANSFER" &&
      !input.transferLastFive &&
      !booking.user.lineUserId.startsWith("manual-")
    ) {
      try {
        const tenant = await prisma.tenant.findUnique({
          where: { id: booking.tenantId },
          select: { bankInfo: true, bankAccountName: true, bankAccountNumber: true },
        });
        const lineClient = getLineClient();
        const bookingDate = booking.date.toLocaleDateString("en-CA", { timeZone: TIMEZONE });
        await lineClient.pushMessage(
          booking.user.lineUserId,
          paymentGuideMessage({
            bankName: tenant?.bankInfo || "請洽店家",
            bankAccountName: tenant?.bankAccountName || "請洽店家",
            bankAccountNumber: tenant?.bankAccountNumber || "請洽店家",
            amount: finalAmount,
            serviceName: booking.service.name,
            bookingDate,
            bookingStartTime: booking.startTime,
            bookingEndTime: booking.endTime,
          }),
        );
      } catch (err) {
        // 推播失敗不阻擋結帳成功（客人如果有問題會主動傳「付款」keyword 補拿）
        logger.error("auto-push payment Flex failed", err, "checkout", { bookingId: id });
      }
    }

    // Best-effort post-checkout effects — never blocks success response.
    try {
      await scheduleThankYou({
        tenantId: booking.tenantId,
        bookingId: id,
        lineUserId: booking.user.lineUserId,
      });
    } catch (err) {
      logger.error("scheduleThankYou failed", err, "bookings", { bookingId: id });
    }

    try {
      await scheduleFollowUp({
        tenantId: booking.tenantId,
        bookingId: id,
        lineUserId: booking.user.lineUserId,
        serviceName: booking.service.name,
      });
    } catch (err) {
      logger.error("scheduleFollowUp failed", err, "bookings", { bookingId: id });
    }

    try {
      await issueCouponForCompletedBooking({
        bookingId: id,
        tenantId: booking.tenantId,
        userId: booking.userId,
        lineUserId: booking.user.lineUserId,
      });
    } catch (err) {
      logger.error("issueCoupon failed", err, "bookings", { bookingId: id });
    }
    invalidateReportsCache();

    return Response.json({
      ok: true,
      booking: result,
      wasNoOp: false,
    });
  } catch (err) {
    if (err instanceof StaleWriteError) {
      const fresh = await prisma.booking.findFirst({
        where: { id: (await params).id },
        select: { status: true, updatedAt: true, checkedInAt: true },
      });
      return Response.json(
        {
          error: "stale_write",
          message: "此預約已更新，請重新整理後再試",
          current: fresh,
        },
        { status: 409 },
      );
    }
    return errorResponse(err);
  }
}

class StaleWriteError extends Error {
  constructor() {
    super("stale_write");
    this.name = "StaleWriteError";
  }
}
