/**
 * ECPay ReturnURL webhook — THE critical one.
 *
 * Fires when the customer actually transfers the money. On RtnCode === "1" we
 * mark the ECPayOrder PAID, the linked Payment RECEIVED, and enqueue two
 * Notification rows (customer receipt + admin alert) which the existing
 * /api/cron/reminders picks up.
 *
 * F4 critical guard: amount mismatch. We NEVER trust TradeAmt blindly — if it
 * disagrees with the stored ECPayOrder.amount we refuse to mark PAID, alert
 * admin, and ACK success to stop ECPay retrying the bad payload forever.
 */

import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/utils/logger";
import {
  parseEcpayWebhookFormData,
  verifyWebhookSignature,
  plainTextAck,
  ECPAY_ACK_SUCCESS,
  ECPAY_ACK_SIGFAIL,
  ECPAY_ACK_NOTFOUND,
  ECPAY_ACK_AMOUNT_MISMATCH,
} from "@/lib/ecpay/webhook-handler";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let params: Record<string, string>;
  try {
    params = await parseEcpayWebhookFormData(request);
  } catch (err) {
    logger.warn("ecpay return: failed to parse form", "ecpay/webhook/return", {
      error: err instanceof Error ? err.message : String(err),
    });
    return plainTextAck(ECPAY_ACK_SIGFAIL);
  }

  if (!verifyWebhookSignature(params)) {
    logger.warn("ecpay.webhook.sig_fail", "ecpay/webhook/return", {
      merchantTradeNo: params.MerchantTradeNo,
    });
    return plainTextAck(ECPAY_ACK_SIGFAIL);
  }

  const merchantTradeNo = params.MerchantTradeNo;
  if (!merchantTradeNo) {
    return plainTextAck(ECPAY_ACK_NOTFOUND);
  }

  const ecpayOrder = await prisma.eCPayOrder.findUnique({
    where: { merchantTradeNo },
    include: {
      booking: {
        include: { user: true, service: true },
      },
    },
  });

  if (!ecpayOrder) {
    logger.warn("ecpay.webhook.return_order_not_found", "ecpay/webhook/return", {
      merchantTradeNo,
    });
    return plainTextAck(ECPAY_ACK_NOTFOUND);
  }

  // Amount-mismatch guard (F4). Do this BEFORE the idempotency check so that
  // a mismatched *late* retry still surfaces as an alert.
  const actualAmount = Number(params.TradeAmt);
  if (!Number.isFinite(actualAmount) || actualAmount !== ecpayOrder.amount) {
    logger.error("ecpay.webhook.amount_mismatch", null, "ecpay/webhook/return", {
      merchantTradeNo,
      expected: ecpayOrder.amount,
      actual: params.TradeAmt,
    });
    try {
      const adminLineUserId = process.env.ADMIN_LINE_USER_ID;
      if (adminLineUserId) {
        await prisma.notification.create({
          data: {
            tenantId: ecpayOrder.tenantId,
            bookingId: ecpayOrder.bookingId,
            type: "CUSTOM",
            scheduledAt: new Date(),
            lineUserId: adminLineUserId,
            status: "PENDING",
            messagePayload: {
              kind: "ecpay_amount_mismatch",
              merchantTradeNo,
              expected: ecpayOrder.amount,
              actual: actualAmount,
              bookingId: ecpayOrder.bookingId,
            },
          },
        });
      }
    } catch (err) {
      logger.error("failed to enqueue amount_mismatch alert", err, "ecpay/webhook/return");
    }
    // ACK success so ECPay stops retrying — we'll handle it manually.
    return plainTextAck(ECPAY_ACK_AMOUNT_MISMATCH);
  }

  // Idempotency: late retry after we've already processed this order.
  if (ecpayOrder.status === "PAID") {
    return plainTextAck(ECPAY_ACK_SUCCESS);
  }

  const rtnCode = params.RtnCode;

  if (rtnCode !== "1") {
    // Non-success notifications (e.g. CVS failure). Don't flip state, just ACK.
    logger.warn("ecpay.webhook.return_non_success", "ecpay/webhook/return", {
      merchantTradeNo,
      rtnCode,
      rtnMsg: params.RtnMsg,
    });
    return plainTextAck(ECPAY_ACK_SUCCESS);
  }

  // Happy path: RtnCode === "1", amount matches. Mark PAID in a transaction.
  const now = new Date();
  const adminLineUserId = process.env.ADMIN_LINE_USER_ID;
  const customerLineUserId = ecpayOrder.booking?.user?.lineUserId ?? null;
  const customerName = ecpayOrder.booking?.user?.displayName ?? null;

  await prisma.$transaction(async (tx) => {
    await tx.eCPayOrder.update({
      where: { id: ecpayOrder.id },
      data: {
        status: "PAID",
        tradeNo: params.TradeNo ?? null,
        rawReturn: params,
      },
    });
    await tx.payment.update({
      where: { id: ecpayOrder.paymentId },
      data: { status: "RECEIVED", receivedAt: now },
    });

    if (customerLineUserId && !customerLineUserId.startsWith("manual-")) {
      await tx.notification.create({
        data: {
          tenantId: ecpayOrder.tenantId,
          bookingId: ecpayOrder.bookingId,
          type: "CUSTOM",
          scheduledAt: now,
          lineUserId: customerLineUserId,
          status: "PENDING",
          messagePayload: {
            kind: "ecpay_received",
            amount: ecpayOrder.amount,
            bookingId: ecpayOrder.bookingId,
            customerName,
          },
        },
      });
    }

    if (adminLineUserId) {
      await tx.notification.create({
        data: {
          tenantId: ecpayOrder.tenantId,
          bookingId: ecpayOrder.bookingId,
          type: "CUSTOM",
          scheduledAt: now,
          lineUserId: adminLineUserId,
          status: "PENDING",
          messagePayload: {
            kind: "ecpay_admin_notify",
            amount: ecpayOrder.amount,
            bookingId: ecpayOrder.bookingId,
            customerName,
          },
        },
      });
    }
  });

  logger.info("ecpay.webhook.paid", "ecpay/webhook/return", {
    merchantTradeNo,
    tradeNo: params.TradeNo,
    amount: ecpayOrder.amount,
    bookingId: ecpayOrder.bookingId,
  });

  return plainTextAck(ECPAY_ACK_SUCCESS);
}
