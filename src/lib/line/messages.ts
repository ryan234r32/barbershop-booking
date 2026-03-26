import { FlexMessage, FlexBubble, FlexCarousel, QuickReply } from "@line/bot-sdk";

/** Default quick reply buttons — reusable across all responses */
export function defaultQuickReply(): QuickReply {
  return {
    items: [
      {
        type: "action",
        action: { type: "message", label: "立即預約", text: "預約" },
      },
      {
        type: "action",
        action: { type: "message", label: "我的預約", text: "我的預約" },
      },
      {
        type: "action",
        action: { type: "message", label: "服務價目", text: "服務" },
      },
      {
        type: "action",
        action: { type: "message", label: "營業資訊", text: "營業時間" },
      },
      {
        type: "action",
        action: { type: "message", label: "付款方式", text: "付款" },
      },
    ],
  };
}

/** Booking confirmation Flex Message */
export function bookingConfirmationMessage(params: {
  serviceName: string;
  date: string;
  startTime: string;
  endTime: string;
  shopName: string;
  shopAddress?: string;
}): FlexMessage {
  const { serviceName, date, startTime, endTime, shopName, shopAddress } = params;

  const bubble: FlexBubble = {
    type: "bubble",
    header: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "text",
          text: "預約確認 ✓",
          weight: "bold",
          size: "lg",
          color: "#1DB446",
        },
      ],
      backgroundColor: "#F0FFF0",
    },
    body: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "text",
          text: shopName,
          weight: "bold",
          size: "xl",
        },
        {
          type: "separator",
          margin: "md",
        },
        {
          type: "box",
          layout: "vertical",
          margin: "lg",
          spacing: "sm",
          contents: [
            infoRow("服務", serviceName),
            infoRow("日期", date),
            infoRow("時間", `${startTime} - ${endTime}`),
            ...(shopAddress ? [infoRow("地址", shopAddress)] : []),
          ],
        },
        {
          type: "text",
          text: "如需取消，請至「我的預約」操作",
          size: "xs",
          color: "#aaaaaa",
          margin: "xl",
          wrap: true,
        },
      ],
    },
  };

  return {
    type: "flex",
    altText: `預約確認：${date} ${startTime} ${serviceName}`,
    contents: bubble,
  };
}

/** Reminder Flex Message */
export function reminderMessage(params: {
  serviceName: string;
  date: string;
  startTime: string;
  shopName: string;
  hoursUntil: number;
}): FlexMessage {
  const { serviceName, date, startTime, shopName, hoursUntil } = params;
  const timeLabel = hoursUntil === 24 ? "明天" : "即將";

  const bubble: FlexBubble = {
    type: "bubble",
    body: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "text",
          text: `⏰ 預約提醒`,
          weight: "bold",
          size: "lg",
        },
        {
          type: "text",
          text: `您${timeLabel}在 ${shopName} 有預約`,
          size: "sm",
          margin: "md",
          wrap: true,
        },
        {
          type: "separator",
          margin: "lg",
        },
        {
          type: "box",
          layout: "vertical",
          margin: "lg",
          spacing: "sm",
          contents: [
            infoRow("服務", serviceName),
            infoRow("日期", date),
            infoRow("時間", startTime),
          ],
        },
      ],
    },
  };

  return {
    type: "flex",
    altText: `預約提醒：${date} ${startTime} ${serviceName}`,
    contents: bubble,
  };
}

/** Cancellation confirmation message */
export function cancellationMessage(params: {
  serviceName: string;
  date: string;
  startTime: string;
  isViolation: boolean;
  violationCount: number;
}): FlexMessage {
  const { serviceName, date, startTime, isViolation, violationCount } = params;

  const bubble: FlexBubble = {
    type: "bubble",
    body: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "text",
          text: "預約已取消",
          weight: "bold",
          size: "lg",
          color: "#FF6B6B",
        },
        {
          type: "separator",
          margin: "md",
        },
        {
          type: "box",
          layout: "vertical",
          margin: "lg",
          spacing: "sm",
          contents: [
            infoRow("服務", serviceName),
            infoRow("原定日期", date),
            infoRow("原定時間", startTime),
          ],
        },
        ...(isViolation
          ? [
              {
                type: "text" as const,
                text: `⚠️ 當天取消已記錄為違規 (${violationCount}/3)`,
                size: "xs" as const,
                color: "#FF6B6B",
                margin: "lg" as const,
                wrap: true,
              },
            ]
          : []),
      ],
    },
  };

  return {
    type: "flex",
    altText: `預約已取消：${date} ${startTime}`,
    contents: bubble,
  };
}

/** Welcome message for new followers */
export function welcomeMessage(shopName: string, liffUrl?: string): FlexMessage {
  const bubble: FlexBubble = {
    type: "bubble",
    body: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "text",
          text: `歡迎加入 ${shopName}！🎉`,
          weight: "bold",
          size: "xl",
        },
        {
          type: "text",
          text: "很高興為您服務！我們提供：",
          size: "sm",
          margin: "lg",
          wrap: true,
          color: "#666666",
        },
        {
          type: "box",
          layout: "vertical",
          margin: "md",
          spacing: "sm",
          contents: [
            {
              type: "text",
              text: "✂️ 剪髮 ・ 🎨 染髮 ・ 💇 燙髮 ・ 💆 護髮",
              size: "sm",
              wrap: true,
              color: "#333333",
            },
          ],
        },
        {
          type: "separator",
          margin: "lg",
        },
        {
          type: "text",
          text: "透過 LINE 即可輕鬆預約，隨時查看可用時段、管理預約，不必打電話！",
          size: "sm",
          margin: "lg",
          wrap: true,
          color: "#666666",
        },
        {
          type: "text",
          text: "👇 點擊下方按鈕或輸入關鍵字開始",
          size: "sm",
          margin: "md",
          wrap: true,
          color: "#999999",
        },
      ],
    },
    ...(liffUrl
      ? {
          footer: {
            type: "box" as const,
            layout: "vertical" as const,
            spacing: "sm" as const,
            contents: [
              {
                type: "button" as const,
                action: {
                  type: "uri" as const,
                  label: "立即預約",
                  uri: liffUrl,
                },
                style: "primary" as const,
                color: "#1DB446",
              },
              {
                type: "button" as const,
                action: {
                  type: "uri" as const,
                  label: "查看我的預約",
                  uri: `${liffUrl}/my-bookings`,
                },
                style: "secondary" as const,
              },
            ],
          },
        }
      : {}),
  };

  return {
    type: "flex",
    altText: `歡迎加入 ${shopName}！點此預約`,
    contents: bubble,
    quickReply: defaultQuickReply(),
  };
}

/** Booking guide Flex Message — used for keyword "預約" */
export function bookingGuideMessage(liffUrl: string): FlexMessage {
  const bubble: FlexBubble = {
    type: "bubble",
    body: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "text",
          text: "立即預約",
          weight: "bold",
          size: "lg",
        },
        {
          type: "text",
          text: "點擊下方按鈕開始預約，選擇服務、日期和時段。",
          size: "sm",
          margin: "lg",
          wrap: true,
          color: "#666666",
        },
      ],
    },
    footer: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "button",
          action: {
            type: "uri",
            label: "開始預約",
            uri: liffUrl,
          },
          style: "primary",
          color: "#1DB446",
        },
      ],
    },
  };

  return {
    type: "flex",
    altText: "點此開始預約",
    contents: bubble,
    quickReply: defaultQuickReply(),
  };
}

/** Pricing carousel Flex Message — used for keyword "價格" */
export function pricingCarouselMessage(
  services: Array<{ name: string; price: number; duration: number; description?: string | null }>,
  liffUrl: string
): FlexMessage {
  // Group services into categories
  const categories: Record<string, typeof services> = {};
  for (const svc of services) {
    let cat = "其他";
    if (svc.name.includes("剪")) cat = "剪髮";
    else if (svc.name.includes("染") || svc.name.includes("漂")) cat = "染髮";
    else if (svc.name.includes("燙") || svc.name.includes("矯正")) cat = "燙髮";
    else if (svc.name.includes("護")) cat = "護髮";
    else if (svc.name.includes("頭皮")) cat = "頭皮調理";
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push(svc);
  }

  const bubbles: FlexBubble[] = Object.entries(categories).map(([cat, items]) => ({
    type: "bubble" as const,
    body: {
      type: "box" as const,
      layout: "vertical" as const,
      contents: [
        {
          type: "text" as const,
          text: cat,
          weight: "bold" as const,
          size: "lg" as const,
        },
        {
          type: "separator" as const,
          margin: "md" as const,
        },
        ...items.map((item) => ({
          type: "box" as const,
          layout: "horizontal" as const,
          margin: "md" as const,
          contents: [
            {
              type: "text" as const,
              text: item.name,
              size: "sm" as const,
              flex: 3,
              wrap: true,
            },
            {
              type: "text" as const,
              text: `NT$${item.price.toLocaleString()}`,
              size: "sm" as const,
              color: "#1DB446" as const,
              align: "end" as const,
              flex: 2,
            },
          ],
        })),
      ],
    },
    footer: {
      type: "box" as const,
      layout: "vertical" as const,
      contents: [
        {
          type: "button" as const,
          action: {
            type: "uri" as const,
            label: "立即預約",
            uri: liffUrl,
          },
          style: "primary" as const,
          color: "#1DB446",
        },
      ],
    },
  }));

  const carousel: FlexCarousel = {
    type: "carousel",
    contents: bubbles,
  };

  return {
    type: "flex",
    altText: "服務價目表 — 左右滑動查看更多",
    contents: carousel,
    quickReply: defaultQuickReply(),
  };
}

/** Business info Flex Message — used for keyword "營業時間" or "地址" */
export function businessInfoMessage(params: {
  shopName: string;
  address: string;
  phone: string;
  hours: string;
  googleMapsUrl?: string;
}): FlexMessage {
  const { shopName, address, phone, hours, googleMapsUrl } = params;

  const bubble: FlexBubble = {
    type: "bubble",
    body: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "text",
          text: shopName,
          weight: "bold",
          size: "lg",
        },
        {
          type: "separator",
          margin: "md",
        },
        {
          type: "box",
          layout: "vertical",
          margin: "lg",
          spacing: "sm",
          contents: [
            infoRow("營業時間", hours),
            infoRow("地址", address),
            infoRow("電話", phone),
          ],
        },
      ],
    },
    ...(googleMapsUrl
      ? {
          footer: {
            type: "box" as const,
            layout: "vertical" as const,
            contents: [
              {
                type: "button" as const,
                action: {
                  type: "uri" as const,
                  label: "Google Maps 導航",
                  uri: googleMapsUrl,
                },
                style: "secondary" as const,
              },
            ],
          },
        }
      : {}),
  };

  return {
    type: "flex",
    altText: `${shopName} — ${hours}`,
    contents: bubble,
    quickReply: defaultQuickReply(),
  };
}

/** My bookings guide — used for keyword "取消" */
export function myBookingsGuideMessage(liffBaseUrl: string): FlexMessage {
  const bubble: FlexBubble = {
    type: "bubble",
    body: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "text",
          text: "我的預約",
          weight: "bold",
          size: "lg",
        },
        {
          type: "text",
          text: "您可以在「我的預約」頁面查看、取消或管理您的預約。",
          size: "sm",
          margin: "lg",
          wrap: true,
          color: "#666666",
        },
      ],
    },
    footer: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "button",
          action: {
            type: "uri",
            label: "查看我的預約",
            uri: `${liffBaseUrl}/my-bookings`,
          },
          style: "primary",
          color: "#1DB446",
        },
      ],
    },
  };

  return {
    type: "flex",
    altText: "點此查看我的預約",
    contents: bubble,
    quickReply: defaultQuickReply(),
  };
}

/** Payment guide Flex Message — used for keyword "付款" */
export function paymentGuideMessage(params: {
  bankName: string;
  bankAccountName: string;
  bankAccountNumber: string;
  liffBaseUrl: string;
}): FlexMessage {
  const { bankName, bankAccountName, bankAccountNumber, liffBaseUrl } = params;

  const bubble: FlexBubble = {
    type: "bubble",
    header: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "text",
          text: "💳 付款資訊",
          weight: "bold",
          size: "lg",
          color: "#1DB446",
        },
      ],
      backgroundColor: "#F0FFF0",
    },
    body: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "text",
          text: "銀行轉帳資訊",
          weight: "bold",
          size: "md",
        },
        {
          type: "separator",
          margin: "md",
        },
        {
          type: "box",
          layout: "vertical",
          margin: "lg",
          spacing: "sm",
          contents: [
            infoRow("銀行", bankName),
            infoRow("戶名", bankAccountName),
            infoRow("帳號", bankAccountNumber),
          ],
        },
        {
          type: "separator",
          margin: "lg",
        },
        {
          type: "text",
          text: "📋 付款步驟",
          weight: "bold",
          size: "sm",
          margin: "lg",
        },
        {
          type: "text",
          text: "1. 完成轉帳後截圖\n2. 至「我的預約」上傳截圖\n3. 店家確認後即完成付款",
          size: "sm",
          margin: "sm",
          wrap: true,
          color: "#666666",
        },
        {
          type: "text",
          text: "＊也可至現場以現金付款",
          size: "xs",
          margin: "md",
          color: "#aaaaaa",
        },
      ],
    },
    footer: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "button",
          action: {
            type: "uri",
            label: "前往我的預約",
            uri: `${liffBaseUrl}/my-bookings`,
          },
          style: "primary",
          color: "#1DB446",
        },
      ],
    },
  };

  return {
    type: "flex",
    altText: "付款資訊 — 銀行轉帳",
    contents: bubble,
    quickReply: defaultQuickReply(),
  };
}

/** Thank-you message after service completion */
export function thankYouMessage(params: {
  shopName: string;
  serviceName: string;
  liffUrl: string;
}): FlexMessage {
  const { shopName, serviceName, liffUrl } = params;

  const bubble: FlexBubble = {
    type: "bubble",
    body: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "text",
          text: "感謝光臨！",
          weight: "bold",
          size: "lg",
          color: "#1DB446",
        },
        {
          type: "text",
          text: `感謝您在 ${shopName} 的消費，希望您滿意今天的${serviceName}服務。`,
          size: "sm",
          margin: "lg",
          wrap: true,
          color: "#666666",
        },
        {
          type: "text",
          text: "期待下次再為您服務！",
          size: "sm",
          margin: "md",
          wrap: true,
          color: "#666666",
        },
      ],
    },
    footer: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "button",
          action: {
            type: "uri",
            label: "預約下次服務",
            uri: liffUrl,
          },
          style: "primary",
          color: "#1DB446",
        },
      ],
    },
  };

  return {
    type: "flex",
    altText: `感謝光臨 ${shopName}！點此預約下次服務`,
    contents: bubble,
  };
}

/** Admin notification: new booking created */
export function adminNewBookingMessage(params: {
  displayName: string;
  serviceName: string;
  date: string;
  startTime: string;
  endTime: string;
  price: number;
}): FlexMessage {
  const { displayName, serviceName, date, startTime, endTime, price } = params;

  const bubble: FlexBubble = {
    type: "bubble",
    header: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "text",
          text: "🆕 新預約通知",
          weight: "bold",
          size: "lg",
          color: "#5B21B6",
        },
      ],
      backgroundColor: "#EDE9FE",
    },
    body: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "separator",
          margin: "md",
        },
        {
          type: "box",
          layout: "vertical",
          margin: "lg",
          spacing: "sm",
          contents: [
            infoRow("顧客", displayName),
            infoRow("服務", serviceName),
            infoRow("日期", date),
            infoRow("時間", `${startTime} - ${endTime}`),
            infoRow("價格", `NT$${price.toLocaleString()}`),
          ],
        },
      ],
    },
  };

  return {
    type: "flex",
    altText: `新預約：${displayName} ${date} ${startTime} ${serviceName}`,
    contents: bubble,
  };
}

/** Admin notification: booking cancelled */
export function adminCancellationMessage(params: {
  displayName: string;
  serviceName: string;
  date: string;
  startTime: string;
  isViolation: boolean;
  cancelledBy: "customer" | "admin";
}): FlexMessage {
  const { displayName, serviceName, date, startTime, isViolation, cancelledBy } = params;

  const cancelLabel = cancelledBy === "admin" ? "店家取消" : "顧客取消";

  const bubble: FlexBubble = {
    type: "bubble",
    header: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "text",
          text: "❌ 預約取消通知",
          weight: "bold",
          size: "lg",
          color: "#DC2626",
        },
      ],
      backgroundColor: "#FEF2F2",
    },
    body: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "separator",
          margin: "md",
        },
        {
          type: "box",
          layout: "vertical",
          margin: "lg",
          spacing: "sm",
          contents: [
            infoRow("顧客", displayName),
            infoRow("服務", serviceName),
            infoRow("原定日期", date),
            infoRow("原定時間", startTime),
            infoRow("取消方式", cancelLabel),
            ...(isViolation
              ? [infoRow("違規", "⚠️ 當天取消，已記錄違規")]
              : []),
          ],
        },
      ],
    },
  };

  return {
    type: "flex",
    altText: `預約取消：${displayName} ${date} ${startTime}`,
    contents: bubble,
  };
}

/** Campaign push message with optional booking CTA button */
export function campaignMessage(text: string, liffUrl: string): FlexMessage {
  const bubble: FlexBubble = {
    type: "bubble",
    body: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "text",
          text: text,
          size: "md",
          wrap: true,
          color: "#333333",
        },
      ],
    },
    footer: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "button",
          action: {
            type: "uri",
            label: "立即預約",
            uri: liffUrl,
          },
          style: "primary",
          color: "#1DB446",
        },
      ],
    },
  };

  return {
    type: "flex",
    altText: text.substring(0, 60),
    contents: bubble,
  };
}

/** Weekly report Flex Message for admin LINE push */
export function weeklyReportMessage(report: {
  period: { from: string; to: string };
  summary: {
    totalBookings: number;
    completedBookings: number;
    cancelledBookings: number;
    noShowBookings: number;
    revenue: number;
    newCustomers: number;
    returningCustomers: number;
    avgBookingsPerDay: number;
    topService: { name: string; count: number };
    occupancyRate: number;
  };
  segmentChanges: {
    newToRegular: number;
    regularToVip: number;
    toAtRisk: number;
    toLapsed: number;
  };
}): FlexMessage {
  const { period, summary, segmentChanges } = report;

  const bubble: FlexBubble = {
    type: "bubble",
    header: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "text",
          text: "📊 每週營業報告",
          weight: "bold",
          size: "lg",
          color: "#1DB446",
        },
        {
          type: "text",
          text: `${period.from} ~ ${period.to}`,
          size: "xs",
          color: "#888888",
          margin: "sm",
        },
      ],
      backgroundColor: "#F0FFF0",
    },
    body: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "text",
          text: "預約概況",
          weight: "bold",
          size: "sm",
          color: "#555555",
        },
        {
          type: "separator",
          margin: "sm",
        },
        {
          type: "box",
          layout: "vertical",
          margin: "md",
          spacing: "sm",
          contents: [
            infoRow("總預約", `${summary.totalBookings} 筆`),
            infoRow("已完成", `${summary.completedBookings} 筆`),
            infoRow("取消", `${summary.cancelledBookings} 筆`),
            infoRow("未到店", `${summary.noShowBookings} 筆`),
            infoRow("營收", `NT$${summary.revenue.toLocaleString()}`),
            infoRow("佔用率", `${summary.occupancyRate}%`),
          ],
        },
        {
          type: "separator",
          margin: "lg",
        },
        {
          type: "text",
          text: "顧客動態",
          weight: "bold",
          size: "sm",
          color: "#555555",
          margin: "lg",
        },
        {
          type: "box",
          layout: "vertical",
          margin: "md",
          spacing: "sm",
          contents: [
            infoRow("新客", `${summary.newCustomers} 人`),
            infoRow("回訪客", `${summary.returningCustomers} 人`),
            infoRow("熱門服務", `${summary.topService.name} (${summary.topService.count}筆)`),
          ],
        },
        {
          type: "separator",
          margin: "lg",
        },
        {
          type: "text",
          text: "客群變動",
          weight: "bold",
          size: "sm",
          color: "#555555",
          margin: "lg",
        },
        {
          type: "box",
          layout: "vertical",
          margin: "md",
          spacing: "sm",
          contents: [
            infoRow("新客→常客", `+${segmentChanges.newToRegular}`),
            infoRow("常客→VIP", `+${segmentChanges.regularToVip}`),
            infoRow("→流失風險", `+${segmentChanges.toAtRisk}`),
            infoRow("→已流失", `+${segmentChanges.toLapsed}`),
          ],
        },
      ],
    },
  };

  return {
    type: "flex",
    altText: `每週營業報告 ${period.from}~${period.to}：${summary.totalBookings}筆預約，營收NT$${summary.revenue.toLocaleString()}`,
    contents: bubble,
  };
}

// Helper: create an info row for Flex Message
function infoRow(label: string, value: string) {
  return {
    type: "box" as const,
    layout: "horizontal" as const,
    contents: [
      {
        type: "text" as const,
        text: label,
        size: "sm" as const,
        color: "#aaaaaa",
        flex: 2,
      },
      {
        type: "text" as const,
        text: value,
        size: "sm" as const,
        color: "#333333",
        flex: 5,
        wrap: true,
      },
    ],
  };
}
