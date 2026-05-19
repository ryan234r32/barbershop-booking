import { NextRequest } from "next/server";
import { classifyIntent, type KeywordIntent } from "@/app/api/webhook/classify-intent";
import { getAdminFromCookie } from "@/lib/auth/jwt";
import { prisma } from "@/lib/prisma";
import { formatBusinessHoursLabel } from "@/lib/utils/business-hours-label";
import {
  bookingGuideMessage,
  pricingCarouselMessages,
  businessInfoMessage,
  myBookingsGuideMessage,
  faqGuideMessage,
  paymentGuideMessage,
  welcomeMessage,
  busyNoticeMessage,
  serviceInquiryFlexMessage,
  bleachConsultationFlexMessage,
} from "@/lib/line/messages";
import type { Message } from "@line/bot-sdk";

const INTENT_LABELS: Record<KeywordIntent, string> = {
  "faq": "常見問題 FAQ (Rich Menu)",
  "leave-message": "留下訊息引導",
  "my-bookings": "我的預約 (P1)",
  "cancel-reschedule": "取消 / 改期 (P2)",
  "service-inquiry-perm": "燙髮諮詢 (P2.5)",
  "service-inquiry-color": "染髮諮詢 (P2.5)",
  "service-inquiry-bleach": "漂髮諮詢 → ConsultationRequest (P2.6)",
  "booking": "新預約 (P3)",
  "pricing": "服務價格 (P4)",
  "payment": "匯款 / 轉帳 (P5) — 帶最近一筆 booking 金額",
  "payment-confirm-done": "✓ 確定完成匯款 (P5a — 按鈕，引導輸入末五碼)",
  "payment-copy-account": "複製帳號 (P5b — fallback for old LINE)",
  "payment-copy-amount": "複製金額 (P5b — fallback for old LINE)",
  "payment-last5": "後五碼回報 (P5c — 純 5 碼數字 → 寫 DB)",
  "payment-malformed-digits": "末五碼長度錯誤 fallback (3/4/6/7 碼)",
  "business-info": "營業時間 / 地址 (P6)",
  "phone": "電話 / 聯絡 (P6)",
  "thanks": "感謝 (P7)",
  "greeting": "打招呼 (P8)",
  "none": "未命中關鍵字 → Busy Notice (6h 冷卻)",
};

/**
 * POST /api/admin/dev/keyword-preview
 * Dev-only: simulate buildKeywordReply without touching LINE.
 * Returns the intent label + the Flex/text payload that would be sent.
 */
export async function POST(request: NextRequest) {
  const admin = await getAdminFromCookie(request);
  if (!admin) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { text } = (await request.json()) as { text?: string };
  if (typeof text !== "string") {
    return Response.json({ error: "text is required" }, { status: 400 });
  }

  const intent = classifyIntent(text);

  const tenant = await prisma.tenant.findUnique({
    where: { id: admin.tenantId },
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

  let preview: Message | Message[] | null = null;
  let note: string | undefined;

  switch (intent) {
    case "faq":
      preview = faqGuideMessage({
        liffBaseUrl: liffUrl,
        shopPhone: tenant?.phone ?? undefined,
      });
      break;
    case "leave-message":
      preview = {
        type: "text",
        text:
          "可以，請直接在這裡留下你想問的問題或狀況。\n\n" +
          "店家看到後會回覆你；如果是快到預約時間、當天取消或其他急事，請直接打電話會比較快。",
      };
      break;
    case "my-bookings":
    case "cancel-reschedule":
      preview = myBookingsGuideMessage(liffUrl);
      note = "實際執行時會改回傳動態 myBookingsFlexMessage（含真實預約資料）。此預覽顯示的是空狀態 guide。";
      break;
    case "booking":
      preview = bookingGuideMessage(liffUrl);
      break;
    case "pricing": {
      const services = await prisma.service.findMany({
        where: { tenantId: admin.tenantId, isActive: true },
        orderBy: { sortOrder: "asc" },
        select: { id: true, name: true, price: true, duration: true, description: true, imageUrl: true },
      });
      preview = pricingCarouselMessages(services, liffUrl);
      break;
    }
    case "payment":
      preview = paymentGuideMessage({
        bankName: tenant?.bankInfo || "請洽店家",
        bankAccountName: tenant?.bankAccountName || "請洽店家",
        bankAccountNumber: tenant?.bankAccountNumber || "請洽店家",
      });
      break;
    case "business-info":
    case "phone": {
      const googleMapsUrl = tenant?.address
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(tenant.address)}`
        : undefined;
      // 動態從 DB 組營業時間字串（同 webhook handler）— 跟 admin /settings 同步
      const bizHoursRows = await prisma.businessHours.findMany({
        where: { tenantId: admin.tenantId },
        select: { dayOfWeek: true, startTime: true, endTime: true, isOpen: true },
      });
      preview = businessInfoMessage({
        shopName,
        address: tenant?.address || "請洽店家",
        phone: tenant?.phone || "請洽店家",
        hours: formatBusinessHoursLabel(bizHoursRows),
        googleMapsUrl,
      });
      break;
    }
    case "service-inquiry-perm":
    case "service-inquiry-color":
      preview = serviceInquiryFlexMessage({
        serviceType: intent === "service-inquiry-perm" ? "perm" : "color",
        liffBaseUrl: liffUrl,
        shopName,
      });
      break;
    case "service-inquiry-bleach":
      preview = bleachConsultationFlexMessage({
        liffBaseUrl: liffUrl,
        consultationLiffUrl: `${liffUrl}/consultation`,
        shopName,
      });
      break;
    case "thanks":
      preview = {
        type: "text",
        text: `不客氣！有任何需要隨時告訴我們 😊\n${shopName} 隨時為您服務！`,
      };
      break;
    case "greeting":
      preview = welcomeMessage({
        shopName,
        phone: tenant?.phone ?? undefined,
        liffUrl,
      });
      break;
    case "none":
      preview = busyNoticeMessage();
      note = "實際執行時套 6h 冷卻：同一顧客 6h 內再打非關鍵字訊息會完全靜默。";
      break;
  }

  return Response.json({
    intent,
    intentLabel: INTENT_LABELS[intent],
    note,
    preview,
  });
}
