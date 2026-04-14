import type { MessageEvent, Message as LineMessage } from "@line/bot-sdk";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/utils/logger";
import { sendWebPushToAdmin } from "@/lib/push/web-push";
import { MessageDirection, MessageType, MessageKind } from "@prisma/client";

/**
 * Map a LINE event.message.type to our MessageType enum.
 */
function mapLineType(t: string): MessageType {
  switch (t) {
    case "text": return "TEXT";
    case "sticker": return "STICKER";
    case "image": return "IMAGE";
    case "video": return "VIDEO";
    case "audio": return "AUDIO";
    case "location": return "LOCATION";
    case "file": return "FILE";
    default: return "OTHER";
  }
}

/**
 * Extract a human-readable content string from a LINE message event.
 * For non-text types, returns an altText-style label (e.g. "[貼圖]").
 */
function extractContent(msg: MessageEvent["message"] | undefined): string | null {
  if (!msg) return null;
  if (msg.type === "text") return msg.text;
  if (msg.type === "sticker") return "[貼圖]";
  if (msg.type === "image") return "[圖片]";
  if (msg.type === "video") return "[影片]";
  if (msg.type === "audio") return "[語音]";
  if (msg.type === "location") return "[位置]";
  if (msg.type === "file") return "[檔案]";
  return null;
}

/**
 * Resolve the User.id for a given lineUserId within a tenant.
 * Returns null if the user hasn't been upserted yet (edge case for follow events
 * that race with the first message event).
 */
async function resolveUserId(tenantId: string, lineUserId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { tenantId_lineUserId: { tenantId, lineUserId } },
    select: { id: true },
  });
  return user?.id ?? null;
}

/**
 * Persist an inbound LINE message event. Fire-and-forget: never awaited by caller.
 * - Uses unique(lineUserId, lineMessageId) for dedup (LINE webhook retries).
 * - After successful write, triggers Web Push to admin.
 * - All errors swallowed with logging; webhook must never fail because of this.
 */
export function persistInboundMessage(
  event: MessageEvent,
  tenantId: string,
): void {
  const lineUserId = event.source.userId;
  if (!lineUserId) return;
  const msg = event.message;
  if (!msg) return;

  (async () => {
    try {
      const userId = await resolveUserId(tenantId, lineUserId);
      const type = mapLineType(msg.type);
      const content = extractContent(msg);

      await prisma.message.create({
        data: {
          tenantId,
          userId,
          lineUserId,
          lineMessageId: msg.id,
          direction: MessageDirection.INBOUND,
          type,
          content,
          raw: msg as unknown as object,
        },
      });

      // Fire-and-forget Web Push to admin (best effort).
      const displayName = userId
        ? (await prisma.user.findUnique({
            where: { id: userId },
            select: { displayName: true },
          }))?.displayName
        : null;

      sendWebPushToAdmin(tenantId, {
        title: `${displayName || "顧客"} 傳來訊息`,
        body: (content || "").slice(0, 80),
        url: `/messages/${lineUserId}`,
        tag: `message-${lineUserId}`,
      }).catch((err) =>
        logger.error("Web Push message failed", err, "persist-inbound"),
      );
    } catch (err) {
      // Unique constraint violation = LINE replay. Log at debug, not error.
      const code = (err as { code?: string })?.code;
      if (code === "P2002") {
        logger.info(`Duplicate LINE message ${msg.id} ignored`, "persist-inbound");
        return;
      }
      logger.error("Failed to persist inbound message", err as Error, "persist-inbound");
    }
  })();
}

/**
 * Persist an outbound message (keyword auto-reply or admin reply).
 * Fire-and-forget: never awaited by caller.
 */
export function persistOutboundMessage(params: {
  tenantId: string;
  lineUserId: string;
  message: LineMessage;
  clientMessageId?: string;
  kind?: MessageKind;
}): void {
  (async () => {
    try {
      const userId = await resolveUserId(params.tenantId, params.lineUserId);

      let type: MessageType = "OTHER";
      let content: string | null = null;
      const m = params.message;
      if (m.type === "text") { type = "TEXT"; content = m.text; }
      else if (m.type === "sticker") { type = "STICKER"; content = "[貼圖]"; }
      else if (m.type === "image") { type = "IMAGE"; content = "[圖片]"; }
      else if (m.type === "flex") { type = "OTHER"; content = m.altText || "[Flex Message]"; }
      else if (m.type === "template") { type = "OTHER"; content = m.altText || "[Template]"; }

      await prisma.message.create({
        data: {
          tenantId: params.tenantId,
          userId,
          lineUserId: params.lineUserId,
          clientMessageId: params.clientMessageId,
          direction: MessageDirection.OUTBOUND,
          type,
          kind: params.kind ?? MessageKind.STANDARD,
          content,
          raw: m as unknown as object,
          isRead: true, // outbound is read by admin by definition
        },
      });
    } catch (err) {
      const code = (err as { code?: string })?.code;
      if (code === "P2002") {
        logger.info("Duplicate outbound message ignored (clientMessageId replay)", "persist-outbound");
        return;
      }
      logger.error("Failed to persist outbound message", err as Error, "persist-outbound");
    }
  })();
}
