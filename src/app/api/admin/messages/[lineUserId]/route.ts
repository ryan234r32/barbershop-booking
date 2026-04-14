import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminFromCookie } from "@/lib/auth/jwt";
import { errorResponse } from "@/lib/utils/errors";

type RouteParams = { params: Promise<{ lineUserId: string }> };

/**
 * GET /api/admin/messages/[lineUserId]
 *
 * Returns the full message history for a single conversation. If no messages
 * exist yet, returns an empty array (not 404) — a conversation that hasn't
 * started is still a valid view.
 *
 * Tenant isolation: filtered by admin.tenantId.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const admin = await getAdminFromCookie(request);
    if (!admin) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { lineUserId } = await params;

    const [messages, user] = await Promise.all([
      prisma.message.findMany({
        where: { tenantId: admin.tenantId, lineUserId },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          direction: true,
          type: true,
          content: true,
          isRead: true,
          createdAt: true,
        },
      }),
      prisma.user.findFirst({
        where: { tenantId: admin.tenantId, lineUserId },
        select: {
          id: true,
          displayName: true,
          pictureUrl: true,
          phone: true,
          segment: true,
        },
      }),
    ]);

    return Response.json({ messages, user });
  } catch (error) {
    return errorResponse(error);
  }
}
