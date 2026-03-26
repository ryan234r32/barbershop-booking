import { NextRequest } from "next/server";
import { WebhookEvent, Message } from "@line/bot-sdk";
import { prisma } from "@/lib/prisma";
import { getLineClient } from "@/lib/line/client";
import { verifyLineSignature } from "@/lib/line/webhook";
import { logger } from "@/lib/utils/logger";
import {
  defaultQuickReply,
  welcomeMessage,
  bookingGuideMessage,
  pricingCarouselMessage,
  businessInfoMessage,
  myBookingsGuideMessage,
  paymentGuideMessage,
} from "@/lib/line/messages";

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
    logger.error("Webhook processing failed", error, "webhook");
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

      // Send welcome message with LIFF booking button
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { businessName: true, liffId: true },
      });

      const liffUrl = `https://liff.line.me/${tenant?.liffId || process.env.NEXT_PUBLIC_LIFF_ID}`;
      const msg = welcomeMessage(tenant?.businessName || "理髮廳", liffUrl);
      await lineClient.pushMessage(lineUserId, msg);
      break;
    }

    case "unfollow": {
      // User blocked the bot — just log, don't delete data
      logger.info("User unfollowed", "webhook", { userId: event.source.userId });
      break;
    }

    case "message": {
      if (!event.replyToken) break;

      if (event.message.type === "text") {
        const reply = await buildKeywordReply(event.message.text, tenantId);
        await lineClient.replyMessage(event.replyToken, reply);
      } else if (
        event.message.type === "sticker" ||
        event.message.type === "image" ||
        event.message.type === "video" ||
        event.message.type === "audio"
      ) {
        // Non-text messages: friendly redirect to text menu
        await lineClient.replyMessage(event.replyToken, {
          type: "text",
          text: "謝謝您的訊息！請輸入文字或點擊下方選單操作 😊",
          quickReply: defaultQuickReply(),
        });
      }
      break;
    }

    default:
      break;
  }
}

/**
 * Keyword auto-reply logic.
 * Matching: substring contains, first-match-wins, priority top to bottom.
 */
async function buildKeywordReply(text: string, tenantId: string): Promise<Message> {
  const lowerText = text.toLowerCase();

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      businessName: true,
      liffId: true,
      phone: true,
      address: true,
      bankInfo: true,
      bankAccountName: true,
      bankAccountNumber: true,
    },
  });

  const liffId = tenant?.liffId || process.env.NEXT_PUBLIC_LIFF_ID || "";
  const liffUrl = `https://liff.line.me/${liffId}`;
  const shopName = tenant?.businessName || "理髮廳";

  // Priority 1: My bookings / query keywords (must check before "預約" to avoid false match)
  if (matchKeywords(lowerText, ["我的預約", "查詢", "紀錄", "記錄"])) {
    return myBookingsGuideMessage(liffUrl);
  }

  // Priority 2: Booking keywords
  if (matchKeywords(lowerText, ["預約", "我要預約", "訂位", "book"])) {
    return bookingGuideMessage(liffUrl);
  }

  // Priority 3: Pricing keywords
  if (matchKeywords(lowerText, ["服務", "價格", "價目表", "多少錢", "price"])) {
    const services = await prisma.service.findMany({
      where: { tenantId, isActive: true },
      orderBy: { sortOrder: "asc" },
      select: { name: true, price: true, duration: true, description: true },
    });
    return pricingCarouselMessage(services, liffUrl);
  }

  // Priority 4: Payment / transfer keywords
  if (matchKeywords(lowerText, ["付款", "轉帳", "匯款"])) {
    return paymentGuideMessage({
      bankName: tenant?.bankInfo || "請洽店家",
      bankAccountName: tenant?.bankAccountName || "請洽店家",
      bankAccountNumber: tenant?.bankAccountNumber || "請洽店家",
      liffBaseUrl: liffUrl,
    });
  }

  // Priority 5: Business hours / location keywords
  if (matchKeywords(lowerText, ["時間", "營業時間", "幾點", "地址", "在哪", "怎麼去"])) {
    const googleMapsUrl = tenant?.address
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(tenant.address)}`
      : undefined;
    return businessInfoMessage({
      shopName,
      address: tenant?.address || "請洽店家",
      phone: tenant?.phone || "請洽店家",
      hours: "週二至週日 11:00-20:00（週一公休）",
      googleMapsUrl,
    });
  }

  // Priority 6: Phone / contact keywords
  if (matchKeywords(lowerText, ["電話", "聯絡", "打電話"])) {
    const phone = tenant?.phone || "請洽店家";
    const googleMapsUrl = tenant?.address
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(tenant.address)}`
      : undefined;
    return businessInfoMessage({
      shopName,
      address: tenant?.address || "請洽店家",
      phone,
      hours: "週二至週日 11:00-20:00（週一公休）",
      googleMapsUrl,
    });
  }

  // Priority 7: Cancellation / booking management keywords
  if (matchKeywords(lowerText, ["取消", "改時間", "更改", "cancel"])) {
    return myBookingsGuideMessage(liffUrl);
  }

  // Priority 8: Thank you keywords
  if (matchKeywords(lowerText, ["謝謝", "感謝", "thanks", "thank you"])) {
    return {
      type: "text",
      text: `不客氣！有任何需要隨時告訴我們 😊\n${shopName} 隨時為您服務！`,
      quickReply: defaultQuickReply(),
    };
  }

  // Priority 9: Greeting keywords
  if (matchKeywords(lowerText, ["你好", "哈囉", "hi", "hello", "嗨"])) {
    return {
      type: "text",
      text: `${shopName} 您好！👋\n\n很高興為您服務，請點擊下方按鈕快速操作：`,
      quickReply: defaultQuickReply(),
    };
  }

  // Fallback: no match
  return {
    type: "text",
    text: `感謝您的訊息！您可以試試以下操作：\n\n📅 輸入「預約」開始預約\n💰 輸入「服務」查看價目表\n🕐 輸入「營業時間」查看店家資訊\n\n或直接點擊下方按鈕 👇`,
    quickReply: defaultQuickReply(),
  };
}

function matchKeywords(text: string, keywords: string[]): boolean {
  return keywords.some((kw) => text.includes(kw));
}
