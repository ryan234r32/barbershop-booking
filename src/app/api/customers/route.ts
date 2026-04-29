import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { errorResponse } from "@/lib/utils/errors";
import { getAdminFromCookie } from "@/lib/auth/jwt";

/** GET /api/customers — list customers (admin only) */
export async function GET(request: NextRequest) {
  try {
    const admin = await getAdminFromCookie(request);
    if (!admin) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const segment = searchParams.get("segment");
    const search = searchParams.get("search");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");

    const where: Record<string, unknown> = { tenantId: admin.tenantId };
    if (segment) where.segment = segment;
    if (search) {
      where.OR = [
        { displayName: { contains: search, mode: "insensitive" } },
        { realName: { contains: search, mode: "insensitive" } },
        { phone: { contains: search } },
      ];
    }

    const [customers, total] = await Promise.all([
      prisma.user.findMany({
        where,
        // Search context (admin booking-sheet typeahead) sorts alphabetically so
        // first-time customers (lastVisitAt = null) aren't pushed off the bottom.
        // List context (no search) keeps lastVisitAt DESC for the customers page.
        orderBy: search
          ? [{ displayName: "asc" }, { lastVisitAt: "desc" }]
          : { lastVisitAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          displayName: true,
          realName: true,
          pictureUrl: true,
          phone: true,
          segment: true,
          isVip: true,
          violationCount: true,
          bookingRestricted: true,
          totalVisits: true,
          lastVisitAt: true,
          tags: true,
          createdAt: true,
          _count: { select: { bookings: true } },
        },
      }),
      prisma.user.count({ where }),
    ]);

    return Response.json({ customers, total, page, limit });
  } catch (error) {
    return errorResponse(error);
  }
}
