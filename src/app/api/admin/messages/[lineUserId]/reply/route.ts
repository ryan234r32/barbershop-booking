import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminFromCookie } from "@/lib/auth/jwt";
import { errorResponse } from "@/lib/utils/errors";
import { getLineClient } from "@/lib/line/client";
import { logger } from "@/lib/utils/logger";
import { MessageDirection, MessageType } from "@prisma/client";

type RouteParams = { params: Promise<{ lineUserId: string }> };

interface ReplyBody {
  text: string;
  clientMessageId?: string;
}

/**
 * POST /api/admin/messages/[lineUserId]/reply
 *
 * Admin replies to a customer. Two safety mechanisms:
 * 1. Tenant guard (CRITICAL) — verifies the customer belongs to admin.tenantId
 *    before calling LINE API. Prevents cross-tenant push attacks.
 * 2. Idempotency — if clientMessageId was previously accepted, returns the
 *    stored message rather than re-sending. Prevents double-send on network
 *    retry.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const admin = await getAdminFromCookie(request);
    if (!admin) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { lineUserId } = await params;
    const body = (await request.json()) as ReplyBody;
    const text = body.text?.trim();
    if (!text) {
      return Response.json({ error: "Message text required" }, { status: 400 });
    }
    if (text.length > 5000) {
      return Response.json({ error: "Message too long (max 5000 chars)" }, { status: 400 });
    }

    // CRITICAL: cross-tenant guard. The customer must belong to this admin's tenant.
    const targetUser = await prisma.user.findFirst({
      where: { tenantId: admin.tenantId, lineUserId },
      select: { id: true },
    });
    if (!targetUser) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    // Idempotency: check for existing OUTBOUND with same clientMessageId
    if (body.clientMessageId) {
      const existing = await prisma.message.findFirst({
        where: {
          tenantId: admin.tenantId,
          clientMessageId: body.clientMessageId,
        },
      });
      if (existing) {
        return Response.json({ message: existing });
      }
    }

    // Send via LINE
    const message = { type: "text" as const, text };
    try {
      const client = getLineClient();
      await client.pushMessage(lineUserId, message);
    } catch (err) {
      logger.error("LINE pushMessage failed for admin reply", err, "messages-reply");
      return Response.json(
        { error: "傳送失敗，請稍後再試" },
        { status: 500 },
      );
    }

    // Persist OUTBOUND
    const stored = await prisma.message.create({
      data: {
        tenantId: admin.tenantId,
        userId: targetUser.id,
        lineUserId,
        clientMessageId: body.clientMessageId,
        direction: MessageDirection.OUTBOUND,
        type: MessageType.TEXT,
        content: text,
        isRead: true,
      },
    });

    return Response.json({ message: stored });
  } catch (error) {
    return errorResponse(error);
  }
}
