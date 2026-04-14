import { NextRequest } from "next/server";
import { WebhookEvent, Message } from "@line/bot-sdk";
import { prisma } from "@/lib/prisma";
import { getLineClient } from "@/lib/line/client";
import { verifyLineSignature } from "@/lib/line/webhook";
import { logger } from "@/lib/utils/logger";
import { persistInboundMessage, persistOutboundMessage } from "@/lib/messages/persist";
import { nowTaipei, formatTime } from "@/lib/utils/time";
import { TIMEZONE } from "@/lib/utils/constants";
import {
  welcomeMessage,
  bookingGuideMessage,
  pricingCarouselMessage,
  businessInfoMessage,
  myBookingsGuideMessage,
  myBookingsFlexMessage,
  myBookingsEmptyMessage,
  paymentGuideMessage,
  busyNoticeMessage,
} from "@/lib/line/messages";
import { MessageKind } from "@prisma/client";
import { classifyIntent } from "./classify-intent";

const BUSY_NOTICE_COOLDOWN_MS = 6 * 60 * 60 * 1000;

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

      // Send welcome: plain-text greeting + Flex card
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { businessName: true, liffId: true, phone: true },
      });

      const shopName = tenant?.businessName || "理髮廳";
      const liffUrl = `https://liff.line.me/${tenant?.liffId || process.env.NEXT_PUBLIC_LIFF_ID}`;

      const namePrefix = displayName ? `${displayName} 你好！🙌\n` : "";
      const textGreeting = {
        type: "text" as const,
        text: `${namePrefix}歡迎加入 ${shopName} ✂️\n\n下方選單可直接預約、查看服務與價格 👇`,
      };
      const flexWelcome = welcomeMessage({
        shopName,
        phone: tenant?.phone ?? undefined,
        liffUrl,
      });

      await lineClient.pushMessage(lineUserId, [textGreeting, flexWelcome]);
      persistOutboundMessage({ tenantId, lineUserId, message: textGreeting, kind: MessageKind.WELCOME });
      persistOutboundMessage({ tenantId, lineUserId, message: flexWelcome, kind: MessageKind.WELCOME });
      break;
    }

    case "unfollow": {
      // User blocked the bot — just log, don't delete data
      logger.info("User unfollowed", "webhook", { userId: event.source.userId });
      break;
    }

    case "message": {
      // Persist inbound first (fire-and-forget, does not block webhook response)
      persistInboundMessage(event, tenantId);

      if (!event.replyToken) break;
      const lineUserId = event.source.userId || "";

      // Non-text messages (sticker/image/video/audio/location/file): stay silent.
      // Keyword matching doesn't apply and auto-responding feels robotic.
      // Admin can still see the inbound message in the admin console.
      if (event.message.type !== "text") break;

      const reply = await buildKeywordReply(event.message.text, tenantId, lineUserId);

      if (reply) {
        if (reply.usePush && lineUserId) {
          // Dynamic replies (DB queries) use pushMessage to avoid 1s webhook timeout
          lineClient.pushMessage(lineUserId, reply.message).catch((err) =>
            logger.error("Failed to push keyword reply", err, "webhook")
          );
        } else {
          await lineClient.replyMessage(event.replyToken, reply.message);
        }
        if (lineUserId) {
          persistOutboundMessage({
            tenantId,
            lineUserId,
            message: reply.message,
            kind: MessageKind.KEYWORD_REPLY,
          });
        }
        break;
      }

      // No keyword matched → maybe send busy notice (once per 6h per user).
      if (!lineUserId) break;

      const cutoff = new Date(Date.now() - BUSY_NOTICE_COOLDOWN_MS);
      const recentBusyNotice = await prisma.message.findFirst({
        where: {
          tenantId,
          lineUserId,
          direction: "OUTBOUND",
          kind: MessageKind.BUSY_NOTICE,
          createdAt: { gte: cutoff },
        },
        select: { id: true },
      });

      if (recentBusyNotice) break; // silent — cooldown active

      const busy = busyNoticeMessage();
      await lineClient.replyMessage(event.replyToken, busy);
      persistOutboundMessage({
        tenantId,
        lineUserId,
        message: busy,
        kind: MessageKind.BUSY_NOTICE,
      });
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
interface KeywordReplyResult {
  message: Message;
  usePush: boolean;
}

// classifyIntent / KeywordIntent moved to ./classify-intent.ts so tests and the
// admin keyword-preview dev tool can import them — Next.js forbids re-exporting
// non-handler symbols from `route.ts`.

/**
 * Build a keyword reply. Returns null when no intent matched — caller decides
 * whether to send a busy notice (cooldown-gated) or stay silent.
 */
async function buildKeywordReply(text: string, tenantId: string, lineUserId: string): Promise<KeywordReplyResult | null> {
  const intent = classifyIntent(text);
  if (intent === "none") return null;

  const reply = (message: Message, usePush = false): KeywordReplyResult => ({ message, usePush });

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

  // Priority 1: My bookings — dynamic query, uses pushMessage
  if (intent === "my-bookings") {
    if (!lineUserId) return reply(myBookingsGuideMessage(liffUrl));

    const user = await prisma.user.findUnique({
      where: { tenantId_lineUserId: { tenantId, lineUserId } },
      select: { id: true },
    });

    if (!user) return reply(myBookingsEmptyMessage(liffUrl), true);

    // Use Taipei timezone for date comparison
    const now = nowTaipei();
    const todayStr = now.toLocaleDateString("en-CA", { timeZone: TIMEZONE });
    const todayDate = new Date(todayStr + "T00:00:00+08:00");
    const currentTime = formatTime(now);

    const bookings = await prisma.booking.findMany({
      where: {
        userId: user.id,
        status: "CONFIRMED",
        date: { gte: todayDate },
      },
      include: {
        service: { select: { name: true, price: true } },
        payment: { select: { status: true } },
      },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
      take: 10,
    });

    // Filter out today's bookings whose end time has already passed
    const upcoming = bookings.filter((b) => {
      const bDateStr = b.date.toLocaleDateString("en-CA", { timeZone: TIMEZONE });
      if (bDateStr === todayStr) return b.endTime > currentTime;
      return true;
    });

    if (upcoming.length === 0) return reply(myBookingsEmptyMessage(liffUrl), true);

    return reply(
      myBookingsFlexMessage({
        bookings: upcoming.map((b) => {
          // Calculate hours until appointment for 24h restriction display
          const bDateStr = b.date.toLocaleDateString("en-CA", { timeZone: TIMEZONE });
          const [bY, bM, bD] = bDateStr.split("-").map(Number);
          const [bH] = b.startTime.split(":").map(Number);
          const appointmentTime = new Date(Date.UTC(bY, bM - 1, bD, bH - 8, 0, 0));
          const hoursUntil = (appointmentTime.getTime() - now.getTime()) / (1000 * 60 * 60);

          return {
            id: b.id,
            date: bDateStr,
            startTime: b.startTime,
            endTime: b.endTime,
            serviceName: b.service.name,
            price: b.service.price,
            paymentStatus: b.payment?.status || null,
            hoursUntilAppointment: hoursUntil,
          };
        }),
        liffBaseUrl: liffUrl,
        shopName,
      }),
      true
    );
  }

  // Priority 2: Booking
  if (intent === "booking") {
    return reply(bookingGuideMessage(liffUrl));
  }

  // Priority 3: Pricing
  if (intent === "pricing") {
    const services = await prisma.service.findMany({
      where: { tenantId, isActive: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, price: true, duration: true, description: true, imageUrl: true },
    });
    return reply(pricingCarouselMessage(services, liffUrl));
  }

  // Priority 4: Payment / transfer
  if (intent === "payment") {
    return reply(paymentGuideMessage({
      bankName: tenant?.bankInfo || "請洽店家",
      bankAccountName: tenant?.bankAccountName || "請洽店家",
      bankAccountNumber: tenant?.bankAccountNumber || "請洽店家",
      liffBaseUrl: liffUrl,
    }));
  }

  // Priority 5: Business hours / location
  if (intent === "business-info" || intent === "phone") {
    const googleMapsUrl = tenant?.address
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(tenant.address)}`
      : undefined;
    return reply(businessInfoMessage({
      shopName,
      address: tenant?.address || "請洽店家",
      phone: tenant?.phone || "請洽店家",
      hours: "週二至週日 11:00-20:00（週一公休）",
      googleMapsUrl,
    }));
  }

  // Priority 6: Cancellation / reschedule — show upcoming bookings
  if (intent === "cancel-reschedule") {
    if (!lineUserId) return reply(myBookingsGuideMessage(liffUrl));

    const user7 = await prisma.user.findUnique({
      where: { tenantId_lineUserId: { tenantId, lineUserId } },
      select: { id: true },
    });

    if (!user7) return reply(myBookingsEmptyMessage(liffUrl), true);

    const now7 = nowTaipei();
    const todayStr7 = now7.toLocaleDateString("en-CA", { timeZone: TIMEZONE });
    const todayDate7 = new Date(todayStr7 + "T00:00:00+08:00");
    const currentTime7 = formatTime(now7);

    const bookings7 = await prisma.booking.findMany({
      where: { userId: user7.id, status: "CONFIRMED", date: { gte: todayDate7 } },
      include: { service: { select: { name: true, price: true } }, payment: { select: { status: true } } },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
      take: 10,
    });

    const upcoming7 = bookings7.filter((b) => {
      const bDateStr = b.date.toLocaleDateString("en-CA", { timeZone: TIMEZONE });
      if (bDateStr === todayStr7) return b.endTime > currentTime7;
      return true;
    });

    if (upcoming7.length === 0) return reply(myBookingsEmptyMessage(liffUrl), true);

    return reply(
      myBookingsFlexMessage({
        bookings: upcoming7.map((b) => {
          const bDateStr = b.date.toLocaleDateString("en-CA", { timeZone: TIMEZONE });
          const [bY, bM, bD] = bDateStr.split("-").map(Number);
          const [bH] = b.startTime.split(":").map(Number);
          const appointmentTime = new Date(Date.UTC(bY, bM - 1, bD, bH - 8, 0, 0));
          const hoursUntil = (appointmentTime.getTime() - now7.getTime()) / (1000 * 60 * 60);

          return {
            id: b.id,
            date: bDateStr,
            startTime: b.startTime,
            endTime: b.endTime,
            serviceName: b.service.name,
            price: b.service.price,
            paymentStatus: b.payment?.status || null,
            hoursUntilAppointment: hoursUntil,
          };
        }),
        liffBaseUrl: liffUrl,
        shopName,
      }),
      true
    );
  }

  // Priority 7: Thank you
  if (intent === "thanks") {
    return reply({
      type: "text",
      text: `不客氣！有任何需要隨時告訴我們 😊\n${shopName} 隨時為您服務！`,
    });
  }

  // Priority 8: Greeting — return welcome Flex for richer intro
  if (intent === "greeting") {
    return reply(welcomeMessage({
      shopName,
      phone: tenant?.phone ?? undefined,
      liffUrl,
    }));
  }

  // Unreachable (classifyIntent exhausts all non-"none" cases above)
  return null;
}

