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
            payment: { select: { status: true, method: true } },
            cancellation: { select: { isViolation: true, reason: true } },
          },
          orderBy: { date: "desc" },
          take: 20,
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

    return Response.json({ customer, stats });
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
    const allowed = ["realName", "phone", "email", "gender", "notes", "tags", "isVip", "bookingRestricted", "violationCount", "birthday"];
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
