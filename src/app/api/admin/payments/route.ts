import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { errorResponse } from "@/lib/utils/errors";
import { getAdminFromCookie } from "@/lib/auth/jwt";
import { nowTaipei } from "@/lib/utils/time";

/**
 * GET /api/admin/payments
 *
 * Query params:
 *   - status: PENDING | VERIFYING | RECEIVED | all (default: VERIFYING+PENDING)
 *   - from, to: ISO date strings (default: today-7d .. today+30d)
 *   - q: last-5-digit search (exact 5-digit match)
 *
 * Tenant-scoped: only returns rows belonging to the admin's tenant.
 */
export async function GET(request: NextRequest) {
  try {
    const admin = await getAdminFromCookie(request);
    if (!admin) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const statusParam = searchParams.get("status");
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const q = searchParams.get("q")?.trim();

    const now = nowTaipei();
    const defaultFrom = new Date(now);
    defaultFrom.setDate(defaultFrom.getDate() - 7);
    const defaultTo = new Date(now);
    defaultTo.setDate(defaultTo.getDate() + 30);

    const fromDate = from ? new Date(from) : defaultFrom;
    const toDate = to ? new Date(to) : defaultTo;

    const statusFilter =
      statusParam === "all"
        ? undefined
        : statusParam === "RECEIVED"
          ? { status: "RECEIVED" as const }
          : statusParam === "PENDING"
            ? { status: "PENDING" as const }
            : statusParam === "VERIFYING"
              ? { status: "VERIFYING" as const }
              : { status: { in: ["PENDING", "VERIFYING"] satisfies ("PENDING" | "VERIFYING")[] } };

    const bookings = await prisma.booking.findMany({
      where: {
        tenantId: admin.tenantId,
        date: { gte: fromDate, lte: toDate },
        payment: statusFilter ? { is: statusFilter } : { isNot: null },
        ...(q && /^\d{1,5}$/.test(q)
          ? { payment: { is: { ...statusFilter, transferLastFive: q } } }
          : {}),
      },
      include: {
        service: { select: { name: true, price: true } },
        user: { select: { displayName: true, realName: true, phone: true, lineUserId: true } },
        payment: true,
      },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
    });

    const items = bookings.map((b) => ({
      bookingId: b.id,
      date: b.date.toISOString().slice(0, 10),
      startTime: b.startTime,
      serviceName: b.service.name,
      customerName: b.user.realName || b.user.displayName || "(無名)",
      customerPhone: b.user.phone,
      customerLineUserId: b.user.lineUserId,
      amount: b.payment?.amount ?? b.service.price,
      method: b.payment?.method ?? null,
      status: b.payment?.status ?? "PENDING",
      transferLastFive: b.payment?.transferLastFive ?? null,
      verifiedAt: b.payment?.verifiedAt ?? null,
      receivedAt: b.payment?.receivedAt ?? null,
    }));

    // Summary
    const summary = {
      verifyingCount: items.filter((i) => i.status === "VERIFYING").length,
      pendingCount: items.filter((i) => i.status === "PENDING").length,
      receivedTodayAmount: items
        .filter(
          (i) =>
            i.status === "RECEIVED" &&
            i.receivedAt &&
            new Date(i.receivedAt).toISOString().slice(0, 10) === now.toISOString().slice(0, 10),
        )
        .reduce((sum, i) => sum + i.amount, 0),
    };

    return Response.json({ items, summary });
  } catch (error) {
    return errorResponse(error);
  }
}
