import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { errorResponse } from "@/lib/utils/errors";
import { getAdminFromCookie } from "@/lib/auth/jwt";

type RouteParams = { params: Promise<{ id: string }> };

/** GET /api/customers/[id] — customer detail with booking history */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const admin = await getAdminFromCookie(request);
    if (!admin) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Tenant isolation: scope by both id AND tenantId. Without this, a multi-tenant
    // admin could fetch any customer record across tenants. findFirst (not findUnique)
    // because we're matching on a compound (id + tenantId) that isn't a Prisma unique key.
    const customer = await prisma.user.findFirst({
      where: { id, tenantId: admin.tenantId },
      include: {
        bookings: {
          include: {
            service: { select: { name: true, price: true } },
            // V3.x — 整合付款記錄到預約 timeline，需要付款全欄位
            payment: {
              select: {
                id: true,
                status: true,
                method: true,
                amount: true,
                transferLastFive: true,
                receivedAt: true,
                verifiedAt: true,
                createdAt: true,
                notes: true,
              },
            },
            cancellation: { select: { isViolation: true, reason: true } },
          },
          orderBy: { date: "desc" },
          take: 50,
        },
        cancellationRecords: {
          orderBy: { cancelledAt: "desc" },
          take: 10,
        },
      },
    });

    if (!customer) {
      return Response.json({ error: "Customer not found" }, { status: 404 });
    }

    // Status counts across ALL bookings (not just the 20 in `bookings`)
    const statusGroups = await prisma.booking.groupBy({
      by: ["status"],
      where: { userId: id, tenantId: admin.tenantId },
      _count: { _all: true },
    });
    const statusCounts: Record<string, number> = {};
    let totalBookings = 0;
    for (const g of statusGroups) {
      statusCounts[g.status] = g._count._all;
      totalBookings += g._count._all;
    }

    // Total revenue from all COMPLETED bookings — sum service.price.
    const completedBookings = await prisma.booking.findMany({
      where: { userId: id, tenantId: admin.tenantId, status: "COMPLETED" },
      select: { service: { select: { price: true } } },
    });
    const totalRevenue = completedBookings.reduce(
      (sum, b) => sum + (b.service?.price || 0),
      0,
    );

    // Average revisit interval (days) — only meaningful with ≥2 visits.
    let avgIntervalDays: number | null = null;
    if (
      customer.firstVisitAt &&
      customer.lastVisitAt &&
      customer.totalVisits > 1
    ) {
      const span =
        new Date(customer.lastVisitAt).getTime() -
        new Date(customer.firstVisitAt).getTime();
      avgIntervalDays = Math.round(
        span / (1000 * 60 * 60 * 24) / (customer.totalVisits - 1),
      );
    }

    const stats = {
      totalBookings,
      statusCounts,
      totalRevenue,
      avgPrice: completedBookings.length > 0
        ? Math.round(totalRevenue / completedBookings.length)
        : null,
      avgIntervalDays,
    };

    // V3.7 §E/F — payment history. Pull every Payment row tied to this user's
    // bookings (cross-tenant safe via booking.tenantId). Sorted newest first.
    // Cap at 50 to keep the response light; older rows are rarely needed.
    const paymentRows = await prisma.payment.findMany({
      where: { booking: { userId: id, tenantId: admin.tenantId } },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        bookingId: true,
        amount: true,
        method: true,
        status: true,
        transferLastFive: true,
        verifiedAt: true,
        receivedAt: true,
        notes: true,
        createdAt: true,
        booking: {
          select: {
            date: true,
            startTime: true,
            service: { select: { name: true } },
          },
        },
      },
    });

    const payments = paymentRows.map((p) => ({
      id: p.id,
      bookingId: p.bookingId,
      amount: p.amount,
      method: p.method,
      status: p.status,
      transferLastFive: p.transferLastFive,
      verifiedAt: p.verifiedAt,
      receivedAt: p.receivedAt,
      notes: p.notes,
      createdAt: p.createdAt,
      bookingDate: p.booking?.date ?? null,
      bookingStartTime: p.booking?.startTime ?? null,
      serviceName: p.booking?.service?.name ?? null,
    }));

    return Response.json({ customer, stats, payments });
  } catch (error) {
    return errorResponse(error);
  }
}

/** PATCH /api/customers/[id] — update customer info (admin) */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const admin = await getAdminFromCookie(request);
    if (!admin) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    // Only allow these fields to be updated
    const allowed = ["realName", "phone", "email", "gender", "notes", "tags", "isVip", "bookingRestricted", "violationCount", "birthday", "defaultDiscount"];
    const data: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in body) data[key] = body[key];
    }

    // Special: auto-compute birthdayMonth/Day when birthday is set
    if ("birthday" in body) {
      if (body.birthday) {
        const d = new Date(body.birthday);
        data.birthday = d;
        data.birthdayMonth = d.getMonth() + 1;
        data.birthdayDay = d.getDate();
      } else {
        data.birthday = null;
        data.birthdayMonth = null;
        data.birthdayDay = null;
      }
    }

    // V3.7 Tier 1.8 — 熟客折扣設定自動戳 audit fields。
    // null → 清除熟客身分；正整數 → 設定/更新折扣金額。
    if ("defaultDiscount" in body) {
      const v = body.defaultDiscount;
      if (v === null || v === 0) {
        data.defaultDiscount = null;
        data.discountSetAt = null;
        data.discountSetBy = null;
      } else if (typeof v === "number" && v > 0 && v <= 10000) {
        data.defaultDiscount = Math.floor(v);
        data.discountSetAt = new Date();
        data.discountSetBy = admin.adminId;
      } else {
        return Response.json(
          { error: "defaultDiscount 須為 1-10000 的整數或 null" },
          { status: 400 },
        );
      }
    }

    // Special: if clearing restriction, also clear restrictedUntil
    if (body.bookingRestricted === false) {
      data.restrictedUntil = null;
    }
    if (body.violationCount === 0) {
      data.bookingRestricted = false;
      data.restrictedUntil = null;
    }

    // Tenant isolation: updateMany with compound where so a cross-tenant id is
    // a no-op (count === 0 → 404), not a silent overwrite. Then re-fetch via
    // findFirst to return the updated record so the response shape stays stable.
    const result = await prisma.user.updateMany({
      where: { id, tenantId: admin.tenantId },
      data,
    });

    if (result.count === 0) {
      return Response.json({ error: "Customer not found" }, { status: 404 });
    }

    const customer = await prisma.user.findFirst({
      where: { id, tenantId: admin.tenantId },
    });

    return Response.json({ customer });
  } catch (error) {
    return errorResponse(error);
  }
}
