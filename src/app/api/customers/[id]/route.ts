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

    const customer = await prisma.user.findUnique({
      where: { id },
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

    return Response.json({ customer });
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
    const allowed = ["realName", "phone", "email", "notes", "tags", "isVip", "bookingRestricted", "violationCount"];
    const data: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in body) data[key] = body[key];
    }

    // Special: if clearing restriction, also clear restrictedUntil
    if (body.bookingRestricted === false) {
      data.restrictedUntil = null;
    }
    if (body.violationCount === 0) {
      data.bookingRestricted = false;
      data.restrictedUntil = null;
    }

    const customer = await prisma.user.update({
      where: { id },
      data,
    });

    return Response.json({ customer });
  } catch (error) {
    return errorResponse(error);
  }
}
