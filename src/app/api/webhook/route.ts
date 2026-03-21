import { NextRequest } from "next/server";
import { WebhookEvent } from "@line/bot-sdk";
import { prisma } from "@/lib/prisma";
import { getLineClient } from "@/lib/line/client";
import { verifyLineSignature } from "@/lib/line/webhook";
import { welcomeMessage } from "@/lib/line/messages";

/** POST /api/webhook — LINE Webhook handler */
export async function POST(request: NextRequest) {
  try {
    const body = await request.text();

    // Verify signature
    const signature = request.headers.get("x-line-signature");
    const channelSecret = process.env.LINE_CHANNEL_SECRET!;
    if (!signature || !verifyLineSignature(body, signature, channelSecret)) {
      return Response.json({ error: "Invalid signature" }, { status: 403 });
    }

    const parsed = JSON.parse(body);
    const events: WebhookEvent[] = parsed.events;

    const tenantId = process.env.DEFAULT_TENANT_ID!;
    const lineClient = getLineClient();

    for (const event of events) {
      await handleEvent(event, tenantId, lineClient);
    }

    return Response.json({ status: "ok" });
  } catch (error) {
    console.error("Webhook error:", error);
    return Response.json({ status: "error" }, { status: 500 });
  }
}

async function handleEvent(
  event: WebhookEvent,
  tenantId: string,
  lineClient: ReturnType<typeof getLineClient>
) {
  switch (event.type) {
    case "follow": {
      // User added/unblocked the bot — create user + send welcome
      const lineUserId = event.source.userId;
      if (!lineUserId) return;

      // Get LINE profile
      let displayName: string | undefined;
      let pictureUrl: string | undefined;
      try {
        const profile = await lineClient.getProfile(lineUserId);
        displayName = profile.displayName;
        pictureUrl = profile.pictureUrl;
      } catch {
        // Profile fetch may fail, proceed without it
      }

      // Upsert user
      await prisma.user.upsert({
        where: { tenantId_lineUserId: { tenantId, lineUserId } },
        update: { displayName, pictureUrl },
        create: { tenantId, lineUserId, displayName, pictureUrl },
      });

      // Send welcome message
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { businessName: true },
      });

      const msg = welcomeMessage(tenant?.businessName || "理髮廳");
      await lineClient.pushMessage(lineUserId, msg);
      break;
    }

    case "unfollow": {
      // User blocked the bot — just log, don't delete data
      console.log("User unfollowed:", event.source.userId);
      break;
    }

    case "message": {
      // For now, reply with a simple guidance message for text messages
      if (event.message.type === "text" && event.replyToken) {
        await lineClient.replyMessage(event.replyToken, {
          type: "text",
          text: "請使用下方選單進行預約或查看預約喔！😊",
        });
      }
      break;
    }

    default:
      break;
  }
}
