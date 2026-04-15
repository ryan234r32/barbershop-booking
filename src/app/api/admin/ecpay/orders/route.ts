import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { errorResponse } from "@/lib/utils/errors";
import { getAdminFromCookie } from "@/lib/auth/jwt";

/**
 * GET /api/admin/ecpay/orders
 *
 * Admin-only ECPay (Tier S) order listing for the admin payments page ATM tab.
 *
 * Query params:
 *   - status: all | pending | paid | expired | failed (default: all)
 *             (note: CREATED is internal-only and rolled into `failed` surfacing-wise;
 *              `pending` maps to ECPayOrderStatus.PENDING)
 *   - cursor: order id to paginate after
 *   - limit:  page size (default 50, max 100)
 *
 * Returns:
 *   { items: Array<OrderDTO>, nextCursor: string | null }
 *
 * Perf (Eng review F12): single query with nested include avoids N+1 on booking/user/service/payment.
 * Tenant-isolated via admin.tenantId.
 */
export async function GET(request: NextRequest) {
  try {
    const admin = await getAdminFromCookie(request);
    if (!admin) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const statusParam = (searchParams.get("status") ?? "all").toLowerCase();
    const cursor = searchParams.get("cursor");
    const rawLimit = Number(searchParams.get("limit") ?? "50");
    const limit = Number.isFinite(rawLimit)
      ? Math.min(Math.max(Math.trunc(rawLimit), 1), 100)
      : 50;

    const statusMap: Record<string, "PENDING" | "PAID" | "EXPIRED" | "FAILED" | "CREATED"> = {
      pending: "PENDING",
      paid: "PAID",
      expired: "EXPIRED",
      failed: "FAILED",
      created: "CREATED",
    };
    const statusFilter = statusParam === "all" ? undefined : statusMap[statusParam];
    if (statusParam !== "all" && !statusFilter) {
      return Response.json({ error: "Invalid status" }, { status: 400 });
    }

    const orders = await prisma.eCPayOrder.findMany({
      where: {
        tenantId: admin.tenantId,
        ...(statusFilter ? { status: statusFilter } : {}),
      },
      include: {
        booking: {
          include: {
            user: {
              select: {
                id: true,
                displayName: true,
                realName: true,
                phone: true,
                lineUserId: true,
              },
            },
            service: { select: { name: true, price: true, slotsNeeded: true } },
          },
        },
        payment: {
          select: { id: true, status: true, method: true, receivedAt: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const hasMore = orders.length > limit;
    const page = hasMore ? orders.slice(0, limit) : orders;
    const nextCursor = hasMore ? page[page.length - 1].id : null;

    const items = page.map((o) => ({
      id: o.id,
      merchantTradeNo: o.merchantTradeNo,
      tradeNo: o.tradeNo,
      amount: o.amount,
      bankCode: o.bankCode,
      vAccount: o.vAccount,
      expireDate: o.expireDate?.toISOString() ?? null,
      status: o.status,
      failureReason: o.failureReason,
      createdAt: o.createdAt.toISOString(),
      updatedAt: o.updatedAt.toISOString(),
      booking: {
        id: o.booking.id,
        date: o.booking.date.toISOString().slice(0, 10),
        startTime: o.booking.startTime,
        endTime: o.booking.endTime,
        status: o.booking.status,
        service: o.booking.service,
        user: {
          id: o.booking.user.id,
          displayName:
            o.booking.user.realName ||
            o.booking.user.displayName ||
            "(無名)",
          phone: o.booking.user.phone,
          lineUserId: o.booking.user.lineUserId,
        },
      },
      payment: o.payment
        ? {
            id: o.payment.id,
            status: o.payment.status,
            method: o.payment.method,
            receivedAt: o.payment.receivedAt?.toISOString() ?? null,
          }
        : null,
    }));

    return Response.json({ items, nextCursor });
  } catch (error) {
    return errorResponse(error);
  }
}
