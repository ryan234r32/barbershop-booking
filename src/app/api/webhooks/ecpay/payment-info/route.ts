/**
 * ECPay PaymentInfoURL webhook.
 *
 * ECPay fires this right after the create-order form is submitted, carrying the
 * virtual account details (BankCode, vAccount, ExpireDate). We persist them so
 * the customer-facing UI can display the transfer instructions.
 *
 * This webhook is NOT the payment-received signal — that's `return/route.ts`.
 * Status stays PENDING here; PAID is only set by ReturnURL.
 */

import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/utils/logger";
import {
  parseEcpayWebhookFormData,
  verifyWebhookSignature,
  parseEcpayExpireDate,
  plainTextAck,
  ECPAY_ACK_SUCCESS,
  ECPAY_ACK_SIGFAIL,
  ECPAY_ACK_NOTFOUND,
} from "@/lib/ecpay/webhook-handler";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let params: Record<string, string>;
  try {
    params = await parseEcpayWebhookFormData(request);
  } catch (err) {
    logger.warn("ecpay payment-info: failed to parse form", "ecpay/webhook", {
      error: err instanceof Error ? err.message : String(err),
    });
    return plainTextAck(ECPAY_ACK_SIGFAIL);
  }

  if (!verifyWebhookSignature(params)) {
    logger.warn("ecpay.webhook.sig_fail", "ecpay/webhook/payment-info", {
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
  });

  if (!ecpayOrder) {
    // Let ECPay retry — create-order handler may still be mid-commit (F5 race).
    logger.warn("ecpay.webhook.payment_info_order_not_found", "ecpay/webhook/payment-info", {
      merchantTradeNo,
    });
    return plainTextAck(ECPAY_ACK_NOTFOUND);
  }

  // Idempotency: late delivery after already PAID/EXPIRED — ACK without side effects.
  if (ecpayOrder.status === "PAID" || ecpayOrder.status === "EXPIRED") {
    return plainTextAck(ECPAY_ACK_SUCCESS);
  }

  const bankCode = params.BankCode ?? null;
  const vAccount = params.vAccount ?? null;
  const expireDate = parseEcpayExpireDate(params.ExpireDate);

  await prisma.eCPayOrder.update({
    where: { id: ecpayOrder.id },
    data: {
      bankCode,
      vAccount,
      expireDate,
      rawPaymentInfo: params,
      // Move CREATED → PENDING once we know the virtual account is live.
      status: ecpayOrder.status === "CREATED" ? "PENDING" : ecpayOrder.status,
    },
  });

  logger.info("ecpay.webhook.payment_info_received", "ecpay/webhook/payment-info", {
    merchantTradeNo,
    bankCode,
    vAccount,
  });

  return plainTextAck(ECPAY_ACK_SUCCESS);
}
