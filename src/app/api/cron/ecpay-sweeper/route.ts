/**
 * ECPay Tier S sweeper — runs every 15 min.
 *
 * Two passes:
 *   1. Stale CREATED:  rows that we inserted but never reached ECPay (app
 *      crashed between INSERT and the SDK call). Anything older than 5 min
 *      is hopeless — mark FAILED so retries can create a fresh order.
 *   2. Expired PENDING: virtual accounts whose ExpireDate has passed without
 *      a ReturnURL fire. Mark the order EXPIRED and flip the linked
 *      Payment(AWAITING_BANK) → EXPIRED so the UI stops nagging.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyCronSecret } from "@/lib/utils/cron-auth";
import { logger } from "@/lib/utils/logger";
import { ECPAY_STALE_CREATED_THRESHOLD_MS } from "@/lib/ecpay/webhook-handler";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const staleCutoff = new Date(now.getTime() - ECPAY_STALE_CREATED_THRESHOLD_MS);

  try {
    // Pass 1: stale CREATED
    const stale = await prisma.eCPayOrder.updateMany({
      where: {
        status: "CREATED",
        createdAt: { lt: staleCutoff },
      },
      data: {
        status: "FAILED",
        failureReason: "stale_created",
      },
    });

    // Pass 2: expired PENDING. Need the ids to also touch linked Payments.
    const expiredOrders = await prisma.eCPayOrder.findMany({
      where: {
        status: "PENDING",
        expireDate: { lt: now },
      },
      select: { id: true, paymentId: true },
    });

    let expiredCount = 0;
    if (expiredOrders.length > 0) {
      const orderIds = expiredOrders.map((o) => o.id);
      const paymentIds = Array.from(new Set(expiredOrders.map((o) => o.paymentId)));

      await prisma.$transaction([
        prisma.eCPayOrder.updateMany({
          where: { id: { in: orderIds } },
          data: { status: "EXPIRED" },
        }),
        prisma.payment.updateMany({
          where: { id: { in: paymentIds }, status: "AWAITING_BANK" },
          data: { status: "EXPIRED" },
        }),
      ]);
      expiredCount = expiredOrders.length;
    }

    logger.info("ecpay.sweeper.done", "cron/ecpay-sweeper", {
      stale: stale.count,
      expired: expiredCount,
    });

    return NextResponse.json({ stale: stale.count, expired: expiredCount });
  } catch (error) {
    logger.error("ecpay sweeper failed", error, "cron/ecpay-sweeper");
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
