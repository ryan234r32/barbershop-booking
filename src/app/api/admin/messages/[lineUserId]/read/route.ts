import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminFromCookie } from "@/lib/auth/jwt";
import { errorResponse } from "@/lib/utils/errors";

type RouteParams = { params: Promise<{ lineUserId: string }> };

/**
 * PATCH /api/admin/messages/[lineUserId]/read
 *
 * Marks all inbound messages in this conversation as read.
 * Tenant-filtered; no cross-tenant leakage.
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const admin = await getAdminFromCookie(request);
    if (!admin) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { lineUserId } = await params;

    const result = await prisma.message.updateMany({
      where: {
        tenantId: admin.tenantId,
        lineUserId,
        direction: "INBOUND",
        isRead: false,
      },
      data: { isRead: true },
    });

    return Response.json({ updated: result.count });
  } catch (error) {
    return errorResponse(error);
  }
}
