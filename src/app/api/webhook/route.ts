import { NextRequest } from "next/server";
import { WebhookEvent, Message } from "@line/bot-sdk";
import { prisma } from "@/lib/prisma";
import { getLineClient } from "@/lib/line/client";
import { verifyLineSignature } from "@/lib/line/webhook";
import { logger } from "@/lib/utils/logger";
import { triggerEmergencyAlert } from "@/lib/notifications/emergency-alert";
import { formatBusinessHoursLabel } from "@/lib/utils/business-hours-label";

// V3.8: 偵測 webhook signature 連續失敗 → 推 LINE alert
// (in-process state，serverless cold start 會清掉 — 這對 attack 偵測夠用，
// 因為攻擊通常是 sustained 不是偶發)
const sigFailWindow: number[] = [];
const SIG_FAIL_THRESHOLD = 5;
const SIG_FAIL_WINDOW_MS = 60_000;

function trackSignatureFailure(request: NextRequest): void {
  const now = Date.now();
  // Drop entries older than window
  while (sigFailWindow.length > 0 && sigFailWindow[0] < now - SIG_FAIL_WINDOW_MS) {
    sigFailWindow.shift();
  }
  sigFailWindow.push(now);
  if (sigFailWindow.length >= SIG_FAIL_THRESHOLD) {
    void triggerEmergencyAlert({
      kind: "line_webhook_attack",
      summary: `webhook signature 1 分鐘內失敗 ${sigFailWindow.length} 次（threshold ${SIG_FAIL_THRESHOLD}）`,
      url: request.url,
    });
    sigFailWindow.length = 0; // reset to avoid spam
  }
}
import { persistInboundMessage, persistOutboundMessage } from "@/lib/messages/persist";
import { nowTaipei } from "@/lib/utils/time";
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
  transferReportedMessage,
  busyNoticeMessage,
  serviceInquiryFlexMessage,
  bleachConsultationFlexMessage,
} from "@/lib/line/messages";
import { notifyAdminTransferReported } from "@/lib/notifications/admin-notify";
import { pickEligibleBookingForPayment } from "@/lib/booking/payment-pick";
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
      // V3.8 incident monitoring: track signature fails. 5 in 1 minute → alert.
      trackSignatureFailure(request);
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
        text: `${namePrefix}歡迎加入 ${shopName} ✂️\n\n下方選單可直接預約、查看服務與價格 👇\n（如果看不到選單，請退出聊天室再重新進入）`,
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
          // Dynamic replies (DB queries) use pushMessage instead of replyMessage
          // because the reply token can race with DB latency.
          //
          // MUST await on Vercel: fire-and-forget promises get killed when the
          // function response is sent. Without await, the first tap on a Rich
          // Menu keyword (e.g. 我的預約) would not deliver the Flex reply on a
          // cold function — user would have to tap a second time to "wake" the
          // function. Same pattern as POST /api/bookings line 285.
          try {
            await lineClient.pushMessage(lineUserId, reply.message);
          } catch (err) {
            logger.error("Failed to push keyword reply", err, "webhook");
          }
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

    // Use Taipei timezone for date comparison.
    // NOTE: `gte: todayDate` is unreliable because `@db.Date` column comparison
    // depends on Postgres session timezone, which varies by host. Instead, pull
    // last 7 days and filter precisely in JS using Taipei endTime vs. now.
    const now = nowTaipei();
    const lookbackStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const bookings = await prisma.booking.findMany({
      where: {
        userId: user.id,
        status: "CONFIRMED",
        date: { gte: lookbackStart },
      },
      include: {
        service: { select: { name: true, price: true } },
        payment: { select: { status: true } },
      },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
      take: 20,
    });

    // Keep only bookings whose end time (Taipei) is still in the future.
    const upcoming = bookings.filter((b) => {
      const bDateStr = b.date.toLocaleDateString("en-CA", { timeZone: TIMEZONE });
      const [y, m, d] = bDateStr.split("-").map(Number);
      const [eH] = b.endTime.split(":").map(Number);
      // Taipei (UTC+8) → UTC instant of appointment end
      const bookingEndUtc = new Date(Date.UTC(y, m - 1, d, eH - 8, 0, 0));
      return bookingEndUtc > now;
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
    // 用共用 helper 找該客「最近一筆待付款 booking」(payment 狀態 non-terminal)。
    // payment-last5 intent 也用同一個 helper，確保 Flex 顯示的金額 = 5 碼會寫入的 booking。
    // 之前兩個 handler 各自 query 造成 BUG：Flex 顯示「男性剪髮 NT$1000」但
    // 5 碼卻寫到「漂髮 NT$2600」。
    let amount: number | undefined;
    let serviceName: string | undefined;
    let bookingDate: string | undefined;
    let bookingStartTime: string | undefined;
    let bookingEndTime: string | undefined;

    if (lineUserId) {
      const user = await prisma.user.findUnique({
        where: { tenantId_lineUserId: { tenantId, lineUserId } },
        select: { id: true },
      });
      if (user) {
        const pick = await pickEligibleBookingForPayment(user.id, tenantId);
        if (pick.eligible) {
          amount = pick.eligible.service.price;
          serviceName = pick.eligible.service.name;
          bookingDate = pick.eligible.date.toLocaleDateString("en-CA", { timeZone: TIMEZONE });
          bookingStartTime = pick.eligible.startTime;
          bookingEndTime = pick.eligible.endTime;
        }
      }
    }

    return reply(paymentGuideMessage({
      bankName: tenant?.bankInfo || "請洽店家",
      bankAccountName: tenant?.bankAccountName || "請洽店家",
      bankAccountNumber: tenant?.bankAccountNumber || "請洽店家",
      amount,
      serviceName,
      bookingDate,
      bookingStartTime,
      bookingEndTime,
    }));
  }

  // Priority 4a-pre: 「✓ 確定完成匯款」按鈕 → 引導客人輸入末五碼
  // 客人匯款是服務完成後才會做，沒有「取消」場景，所以拿掉 Quick Reply
  if (intent === "payment-confirm-done") {
    // Personalize with displayName if available
    let displayName: string | undefined;
    if (lineUserId) {
      const u = await prisma.user.findUnique({
        where: { tenantId_lineUserId: { tenantId, lineUserId } },
        select: { displayName: true },
      });
      displayName = u?.displayName ?? undefined;
    }
    const greeting = displayName ? `${displayName} 您好，` : "";
    return reply({
      type: "text",
      text:
        `${greeting}請輸入您匯款的後 5 碼數字 ✏️\n\n` +
        `例：12345`,
    });
  }

  // Priority 4a-pre2: 3/4/6/7 碼純數字 → 客人很可能想回報末五碼但打錯位數
  // 給友善的 retry 提示，避免 fall through 到 busy-notice 造成混亂
  if (intent === "payment-malformed-digits") {
    return reply({
      type: "text",
      text:
        `「${text.trim()}」似乎不是 5 位數字 🤔\n\n` +
        `若您要回報匯款後五碼，請改打「正好 5 位數字」\n` +
        `例：12345`,
    });
  }

  // Priority 4a: 「複製帳號」純文字訊息 → 舊版 LINE app fallback
  // (新版按鈕用 clipboardAction，點下去直接複製不會送這條訊息；
  //  只有客人手動打「複製帳號」、或舊版 LINE 不認得 clipboardAction 才會走這裡)
  if (intent === "payment-copy-account") {
    const cleanAccount = (tenant?.bankAccountNumber || "").replace(/[\s-]/g, "");
    if (!cleanAccount) {
      return reply({ type: "text", text: "目前尚未設定銀行帳號，請洽店家。" });
    }
    return reply({
      type: "text",
      text:
        `${cleanAccount}\n` +
        `\n👆 長按上方帳號即可複製\n` +
        `\n完成轉帳後，請直接傳「末五碼」5 位數字給我，例：12345`,
    });
  }

  // Priority 4b: 「複製金額」純文字訊息 → 同上的 fallback
  if (intent === "payment-copy-amount") {
    if (!lineUserId) {
      return reply({ type: "text", text: "請從「匯款資訊」按鈕開始操作 🙏" });
    }
    const user = await prisma.user.findUnique({
      where: { tenantId_lineUserId: { tenantId, lineUserId } },
      select: { id: true },
    });
    if (!user) {
      return reply({ type: "text", text: "查無您的預約資料 🙏" });
    }
    const pick = await pickEligibleBookingForPayment(user.id, tenantId);
    if (!pick.eligible) {
      return reply({
        type: "text",
        text: pick.hasOnlyPaidBookings
          ? "您最近的預約款項已對帳中或已完成，目前無待付金額 🙏"
          : "查無您近期的預約金額，若有疑問請洽店家 🙏",
      });
    }
    const amt = pick.eligible.service.price;
    return reply({
      type: "text",
      text:
        `${amt}\n` +
        `\n👆 長按上方金額即可複製\n` +
        `\n完成轉帳後，請直接傳「末五碼」5 位數字給我，例：12345`,
    });
  }

  // Priority 4c: 5 碼數字訊息 → 寫進 Payment.transferLastFive、status=VERIFYING、
  // 推播給老闆對帳。客人傳 5 碼後 bot 回 transferReportedMessage Flex 確認。
  //
  // 整套流程不再經過 LIFF /payment 頁（已於 2026-04-27 移除）。
  if (intent === "payment-last5") {
    const transferLastFive = text.trim();

    if (!lineUserId) {
      return reply({ type: "text", text: "請從 LINE 帳號內傳送，謝謝 🙏" });
    }
    const user = await prisma.user.findUnique({
      where: { tenantId_lineUserId: { tenantId, lineUserId } },
      select: { id: true, displayName: true, segment: true },
    });
    if (!user) {
      return reply({ type: "text", text: "查無您的預約資料，若有疑問請洽店家 🙏" });
    }

    // 用共用 helper（同一份邏輯支撐 payment + payment-last5 兩個 intent）
    const pick = await pickEligibleBookingForPayment(user.id, tenantId);

    if (!pick.eligible) {
      return reply({
        type: "text",
        text: pick.hasOnlyPaidBookings
          ? `查無待回報的預約 — 您最近的預約款項已對帳中或已完成。若有疑問請洽店家 🙏`
          : `查無您近期的預約，請先預約後再回報匯款 🙏`,
      });
    }
    const target = pick.eligible;

    // Atomic transition — create or upgrade PENDING/AWAITING_BANK → VERIFYING
    const payment = target.payment
      ? await prisma.payment.update({
          where: { bookingId: target.id },
          data: {
            method: "BANK_TRANSFER",
            status: "VERIFYING",
            transferLastFive,
            verifiedAt: new Date(),
          },
        })
      : await prisma.payment.create({
          data: {
            bookingId: target.id,
            amount: target.service.price,
            method: "BANK_TRANSFER",
            status: "VERIFYING",
            transferLastFive,
            verifiedAt: new Date(),
          },
        });

    // Fire-and-forget: notify admin (web push + LINE)
    void notifyAdminTransferReported({
      tenantId: target.tenantId,
      bookingId: target.id,
      displayName: user.displayName ?? "客戶",
      serviceName: target.service.name,
      date: target.date.toISOString().slice(0, 10),
      startTime: target.startTime,
      amount: payment.amount,
      transferLastFive,
    }).catch((err) => logger.error("notifyAdminTransferReported failed", err, "webhook"));

    const dateStr = target.date.toLocaleDateString("en-CA", { timeZone: TIMEZONE });
    // Google 評論連結：優先讀環境變數 GOOGLE_REVIEW_URL（最佳：老闆從 Google Business
    // Profile 取得的「直達寫評論」連結，例：https://g.page/r/.../review）。
    // 沒設則 fallback 到 1008 hair studio 的短連結 — 點擊到該店家 Maps 頁，客人再
    // 滑下去點「寫評論」按鈕。比搜尋頁少一步，是目前能 hardcode 的最佳體驗。
    const googleReviewUrl =
      process.env.GOOGLE_REVIEW_URL ||
      "https://maps.app.goo.gl/5XNK3uakFphFhSvd8";
    return reply(
      transferReportedMessage({
        serviceName: target.service.name,
        date: dateStr,
        startTime: target.startTime,
        endTime: target.endTime,
        price: payment.amount,
        transferLastFive,
        googleReviewUrl,
        displayName: user.displayName ?? undefined,
        isVip: user.segment === "VIP",
      }),
      true, // usePush — DB write delayed reply, avoid 1s webhook timeout
    );
  }

  // Priority 5: Business hours / location
  if (intent === "business-info" || intent === "phone") {
    const googleMapsUrl = tenant?.address
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(tenant.address)}`
      : undefined;
    // 動態從 DB 組營業時間字串，跟 admin /settings 同步（避免老闆改公休後 LINE
    // 還回覆「週一公休」誤導客戶）。
    const bizHoursRows = await prisma.businessHours.findMany({
      where: { tenantId },
      select: { dayOfWeek: true, startTime: true, endTime: true, isOpen: true },
    });
    return reply(businessInfoMessage({
      shopName,
      address: tenant?.address || "請洽店家",
      phone: tenant?.phone || "請洽店家",
      hours: formatBusinessHoursLabel(bizHoursRows),
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
    const lookbackStart7 = new Date(now7.getTime() - 7 * 24 * 60 * 60 * 1000);

    const bookings7 = await prisma.booking.findMany({
      where: { userId: user7.id, status: "CONFIRMED", date: { gte: lookbackStart7 } },
      include: { service: { select: { name: true, price: true } }, payment: { select: { status: true } } },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
      take: 20,
    });

    const upcoming7 = bookings7.filter((b) => {
      const bDateStr = b.date.toLocaleDateString("en-CA", { timeZone: TIMEZONE });
      const [y, m, d] = bDateStr.split("-").map(Number);
      const [eH] = b.endTime.split(":").map(Number);
      const bookingEndUtc = new Date(Date.UTC(y, m - 1, d, eH - 8, 0, 0));
      return bookingEndUtc > now7;
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

  // Priority 6.5: Service inquiry — perm / color (PRD-v3 §7)
  if (intent === "service-inquiry-perm" || intent === "service-inquiry-color") {
    return reply(
      serviceInquiryFlexMessage({
        serviceType: intent === "service-inquiry-perm" ? "perm" : "color",
        liffBaseUrl: liffUrl,
        shopName,
      })
    );
  }

  // Priority 6.6: 漂髮 → consultation flow (PRD-v3 §3, Wave 4a).
  // High-judgement service: route to LIFF form, customer fills detail; admin reviews via LINE chat.
  if (intent === "service-inquiry-bleach") {
    return reply(
      bleachConsultationFlexMessage({
        liffBaseUrl: liffUrl,
        consultationLiffUrl: `${liffUrl}/consultation`,
        shopName,
      })
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

