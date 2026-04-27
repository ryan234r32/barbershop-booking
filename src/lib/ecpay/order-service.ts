/**
 * ECPay ATM create-order business logic.
 *
 * Orchestrates: Redis lock → validation → monthly cap → DB row → SDK call,
 * with strict ordering that keeps the webhook always able to find its row:
 *
 *   1. Commit ECPayOrder (status=PENDING) to DB BEFORE calling ECPay.
 *      (Plan F5: if we called ECPay first and the process died after, the
 *      webhook would arrive referencing a merchantTradeNo we never persisted.)
 *   2. Wrap the SDK call in an 8s timeout. On timeout, flip the row to FAILED
 *      so retries aren't blocked by a stuck PENDING.
 *
 * Pure function — no HTTP. The API route handler is the only HTTP layer.
 */

import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/utils/errors";
import { logger } from "@/lib/utils/logger";
import {
  ECPAY_API_TIMEOUT_MS,
} from "@/lib/utils/constants";
import { formatDateToISO, todayInTaipei } from "@/lib/utils/time";
import { loadECPayConfig } from "./config";
import { createEcpaySdk } from "./client";
import {
  generateMerchantTradeNo,
  formatMerchantTradeDate,
} from "./merchant-trade-no";
import { acquireEcpayCreateLock, releaseEcpayCreateLock } from "./locks";
import { assertWithinMonthlyCap } from "./monthly-cap";

export interface CreateEcpayAtmOrderInput {
  bookingId: string;
  tenantId: string;
  actor:
    | { type: "admin"; adminId: string }
    | { type: "liff"; lineUserId: string };
}

export interface CreateEcpayAtmOrderResult {
  html: string;
  merchantTradeNo: string;
  amount: number;
}

/** Truncate to N chars (by JS chars — ECPay spec is byte-based but this is safe). */
function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) : s;
}

/**
 * Days between "now" and the booking date, clamped to ECPay's minimum of 1.
 * ECPay's ExpireDate is day-precision; if the booking is today we use 1 (earliest).
 */
function computeExpireDays(bookingDate: Date, now: Date): number {
  const today = formatDateToISO(now);
  const target = formatDateToISO(bookingDate);
  if (target <= today) return 1;
  // Diff in days using UTC midnight (dates are stored as @db.Date so time is 00:00 UTC).
  const dayMs = 24 * 60 * 60 * 1000;
  const diff = Math.ceil(
    (new Date(`${target}T00:00:00Z`).getTime() -
      new Date(`${today}T00:00:00Z`).getTime()) /
      dayMs
  );
  return Math.max(1, diff);
}

/**
 * Race `promise` against an N-ms timer. Rejects with a tagged Error on timeout.
 */
function withTimeout<T>(promise: Promise<T>, ms: number, tag: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new AppError(`${tag} timed out after ${ms}ms`, 502, "ECPAY_TIMEOUT"));
    }, ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

export async function createEcpayAtmOrder(
  input: CreateEcpayAtmOrderInput
): Promise<CreateEcpayAtmOrderResult> {
  const { bookingId, tenantId } = input;

  const cfg = loadECPayConfig();
  if (!cfg) {
    throw new AppError("金流服務暫時關閉", 503, "ECPAY_DISABLED");
  }

  logger.info("ecpay.create_order.start", "ecpay", { bookingId, tenantId });

  const lock = await acquireEcpayCreateLock(bookingId);
  if (!lock) {
    throw new AppError("付款流程忙碌中，請稍候再試", 409, "LOCK_BUSY");
  }

  try {
    // 1. Load booking (tenant-isolated) with service + existing payment + orders
    const booking = await prisma.booking.findFirst({
      where: { id: bookingId, tenantId },
      include: {
        service: { select: { name: true, price: true } },
        payment: { select: { id: true, status: true, amount: true } },
        ecpayOrders: {
          select: { id: true, status: true, expireDate: true },
        },
      },
    });

    if (!booking) {
      throw new AppError("找不到此預約", 404, "BOOKING_NOT_FOUND");
    }
    if (booking.status !== "CONFIRMED") {
      throw new AppError("此預約無法建立付款", 409, "BOOKING_NOT_CONFIRMED");
    }

    // 2. Reject past bookings (Taipei tz). Uses todayInTaipei() — nowTaipei()
    // has a UTC-server day-shift bug that makes today look like tomorrow
    // during Taipei afternoon, falsely rejecting same-day bookings.
    const todayISO = todayInTaipei();
    const bookingDateISO = formatDateToISO(booking.date);
    if (bookingDateISO < todayISO) {
      throw new AppError("此預約已過期，無法建立付款", 409, "BOOKING_IN_PAST");
    }

    // 3. Reject if payment already terminal
    if (
      booking.payment &&
      (booking.payment.status === "RECEIVED" ||
        booking.payment.status === "WAIVED")
    ) {
      throw new AppError("此預約已收款", 409, "PAYMENT_LOCKED");
    }

    const amount = booking.service.price;

    // 4. Monthly cap
    await assertWithinMonthlyCap(tenantId, amount);

    // 5. Supersede any live PENDING order for this booking
    const nowDate = new Date();
    const livePending = booking.ecpayOrders.find(
      (o) =>
        o.status === "PENDING" &&
        (!o.expireDate || o.expireDate > nowDate)
    );
    if (livePending) {
      await prisma.eCPayOrder.update({
        where: { id: livePending.id },
        data: { status: "FAILED", failureReason: "superseded" },
      });
      logger.info("ecpay.create_order.superseded", "ecpay", {
        bookingId,
        supersededOrderId: livePending.id,
      });
    }

    // 6. Generate trade identifiers
    const merchantTradeDateSource = new Date();
    const merchantTradeNo = generateMerchantTradeNo({ bookingId });
    const merchantTradeDate = formatMerchantTradeDate(merchantTradeDateSource);
    const expireDays = computeExpireDays(booking.date, nowDate);

    // 7. Tx: upsert Payment (AWAITING_BANK) + insert ECPayOrder (PENDING).
    //    COMMIT BEFORE calling ECPay so webhook can always locate the row.
    const { ecpayOrderId } = await prisma.$transaction(async (tx) => {
      const payment = booking.payment
        ? await tx.payment.update({
            where: { bookingId },
            data: {
              amount,
              method: "ECPAY_ATM",
              status: "AWAITING_BANK",
            },
          })
        : await tx.payment.create({
            data: {
              bookingId,
              amount,
              method: "ECPAY_ATM",
              status: "AWAITING_BANK",
            },
          });

      const order = await tx.eCPayOrder.create({
        data: {
          tenantId,
          bookingId,
          paymentId: payment.id,
          merchantTradeNo,
          merchantTradeDate,
          amount,
          status: "PENDING",
        },
      });
      return { ecpayOrderId: order.id, paymentId: payment.id };
    });

    logger.info("ecpay.create_order.persisted", "ecpay", {
      bookingId,
      merchantTradeNo,
      ecpayOrderId,
    });

    // 8. Build the checkout HTML via SDK, wrapped in a timeout.
    //    The SDK call is synchronous but we race it anyway in case the SDK
    //    ever starts doing network work (future-proofing for F7/F15).
    const sdk = createEcpaySdk(cfg);
    const tradeDesc = truncate(
      `${booking.service.name} 預約 ${bookingDateISO} ${booking.startTime}`,
      200
    );
    const itemName = truncate(booking.service.name, 200);

    try {
      const html = await withTimeout(
        Promise.resolve().then(() =>
          sdk.buildAtmCheckoutHtml({
            merchantTradeNo,
            merchantTradeDate,
            totalAmount: amount,
            tradeDesc,
            itemName,
            expireDays,
          })
        ),
        ECPAY_API_TIMEOUT_MS,
        "ECPay checkout build"
      );

      logger.info("ecpay.create_order.success", "ecpay", {
        bookingId,
        merchantTradeNo,
        amount,
      });

      return { html, merchantTradeNo, amount };
    } catch (sdkErr) {
      // Rollback: mark order FAILED + revert Payment to PENDING so the user
      // can retry. We do NOT delete the ECPayOrder (it's our audit trail).
      const reason =
        sdkErr instanceof AppError && sdkErr.code === "ECPAY_TIMEOUT"
          ? "ecpay_timeout"
          : "ecpay_build_failed";
      await prisma.$transaction([
        prisma.eCPayOrder.update({
          where: { id: ecpayOrderId },
          data: { status: "FAILED", failureReason: reason },
        }),
        prisma.payment.update({
          where: { bookingId },
          data: { status: "PENDING" },
        }),
      ]).catch((rollbackErr) => {
        logger.error(
          "ecpay.create_order.rollback_failed",
          rollbackErr,
          "ecpay",
          { bookingId, merchantTradeNo }
        );
      });

      logger.error("ecpay.create_order.sdk_failed", sdkErr, "ecpay", {
        bookingId,
        merchantTradeNo,
        reason,
      });

      if (sdkErr instanceof AppError) throw sdkErr;
      throw new AppError("金流服務暫時無法使用", 502, "ECPAY_BUILD_FAILED");
    }
  } finally {
    await releaseEcpayCreateLock(lock);
  }
}
