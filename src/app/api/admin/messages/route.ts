import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminFromCookie } from "@/lib/auth/jwt";
import { errorResponse } from "@/lib/utils/errors";

interface ConversationRow {
  line_user_id: string;
  user_id: string | null;
  display_name: string | null;
  picture_url: string | null;
  last_content: string | null;
  last_direction: "INBOUND" | "OUTBOUND";
  last_created_at: Date;
  unread_count: number;
}

/**
 * GET /api/admin/messages
 *
 * Returns the conversation list for the current tenant — one row per
 * line_user_id with the latest message preview, timestamp, and unread count.
 * Also returns totalUnread for the tab-bar badge (replaces the old
 * /unread-count endpoint).
 *
 * Tenant isolation: every query filtered by admin.tenantId.
 */
export async function GET(request: NextRequest) {
  try {
    const admin = await getAdminFromCookie(request);
    if (!admin) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // One query, one row per lineUserId, with joined user fields.
    // DISTINCT ON is Postgres-specific; we pair it with ORDER BY to pick the
    // latest message per conversation.
    const rows = await prisma.$queryRaw<ConversationRow[]>`
      SELECT DISTINCT ON (m.line_user_id)
        m.line_user_id,
        m.user_id,
        u.display_name,
        u.picture_url,
        m.content AS last_content,
        m.direction AS last_direction,
        m.created_at AS last_created_at,
        (
          SELECT COUNT(*)::int FROM messages m2
          WHERE m2.tenant_id = ${admin.tenantId}
            AND m2.line_user_id = m.line_user_id
            AND m2.direction = 'INBOUND'
            AND m2.is_read = false
        ) AS unread_count
      FROM messages m
      LEFT JOIN users u ON u.id = m.user_id
      WHERE m.tenant_id = ${admin.tenantId}
      ORDER BY m.line_user_id, m.created_at DESC
    `;

    // Sort conversations by most recent activity
    const conversations = rows
      .map((r) => ({
        lineUserId: r.line_user_id,
        userId: r.user_id,
        displayName: r.display_name,
        pictureUrl: r.picture_url,
        lastContent: r.last_content,
        lastDirection: r.last_direction,
        lastCreatedAt: r.last_created_at,
        unreadCount: r.unread_count,
      }))
      .sort(
        (a, b) =>
          new Date(b.lastCreatedAt).getTime() -
          new Date(a.lastCreatedAt).getTime(),
      );

    const totalUnread = conversations.reduce(
      (sum, c) => sum + c.unreadCount,
      0,
    );

    return Response.json({ conversations, totalUnread });
  } catch (error) {
    return errorResponse(error);
  }
}
