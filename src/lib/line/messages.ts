import { FlexMessage, FlexBubble, FlexCarousel, FlexComponent, FlexButton } from "@line/bot-sdk";
import { formatHumanDate } from "@/lib/utils/time";

/** Build Google Calendar URL for a booking */
function buildGoogleCalendarUrl(
  serviceName: string,
  date: string,
  startTime: string,
  endTime: string,
): string {
  const startDT = `${date.replace(/-/g, "")}T${startTime.replace(":", "")}00`;
  const endDT = `${date.replace(/-/g, "")}T${endTime.replace(":", "")}00`;
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `${serviceName} — 1008 Hair Studio`,
    dates: `${startDT}/${endDT}`,
    location: "台北市中正區新生南路一段144-10號",
    details: "1008 Hair Studio 預約",
    ctz: "Asia/Taipei",
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/** Booking confirmation Flex Message */
export function bookingConfirmationMessage(params: {
  serviceName: string;
  date: string;
  startTime: string;
  endTime: string;
  shopName: string;
  shopAddress?: string;
  price?: number;
  bookingId?: string;
  liffBaseUrl?: string;
}): FlexMessage {
  const { serviceName, date, startTime, endTime, shopName, shopAddress, price, bookingId, liffBaseUrl } = params;

  const calendarUrl = buildGoogleCalendarUrl(serviceName, date, startTime, endTime);

  // 2026-04-27: 「前往付款」按鈕已移除 — 客人於到店後用 Rich Menu「匯款資訊」
  // 一鍵複製帳號 + 直接傳末五碼即可，不需 LIFF /payment 頁。
  void bookingId; // (參數保留向後相容；目前未使用)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const footerButtons: any[] = [];

  // Primary: Google Calendar
  footerButtons.push({
    type: "button" as const,
    action: {
      type: "uri" as const,
      label: "加入 Google 行事曆",
      uri: calendarUrl,
    },
    style: "primary" as const,
    color: "#003D2B",
    height: "sm" as const,
  });

  // Secondary: My Bookings
  if (liffBaseUrl) {
    footerButtons.push({
      type: "button" as const,
      action: {
        type: "uri" as const,
        label: "查看我的預約",
        uri: `${liffBaseUrl}/my-bookings`,
      },
      style: "secondary" as const,
      height: "sm" as const,
    });
  }

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
          color: "#003D2B",
        },
      ],
      backgroundColor: "#FFF8F1",
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
            ...(price != null ? [infoRow("價格", `NT$${price.toLocaleString()}`)] : []),
            ...(shopAddress ? [infoRow("地址", shopAddress)] : []),
          ],
        },
        {
          type: "text",
          text: "24 小時前可免費取消，改期隨時可線上操作",
          size: "xs",
          color: "#809A8E",
          margin: "xl",
          wrap: true,
        },
      ],
    },
    footer: {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      contents: footerButtons,
      backgroundColor: "#FFF8F1",
    },
  };

  return {
    type: "flex",
    altText: `預約確認：${date} ${startTime} ${serviceName}`,
    contents: bubble,
  };
}

/**
 * Transfer reported Flex Message — sent after customer submits last-5 digits.
 *
 * 2026-04-29 v4: 緊湊版 + 明確「對帳中」狀態。
 * - 跟 paymentReceivedMessage 視覺明確區隔（這張說「收到回報、對帳中」，
 *   那張才說「對帳完成、款項已收」）
 * - 拿掉 receipt 虛線、邀評 CTA、VIP 文案、displayName 個人化（移到 Step 2）
 * - body 只 3 行：服務 / 金額 / 末五碼，砍一半版面
 */
export function transferReportedMessage(params: {
  serviceName: string;
  date: string;
  startTime: string;
  endTime: string;
  price: number;
  transferLastFive: string;
  // googleReviewUrl + displayName + isVip 保留參數位避免 caller break，但 v4 不再使用
  googleReviewUrl?: string;
  displayName?: string;
  isVip?: boolean;
}): FlexMessage {
  const {
    serviceName,
    date,
    startTime,
    endTime,
    price,
    transferLastFive,
  } = params;
  void params.googleReviewUrl;
  void params.displayName;
  void params.isVip;
  void startTime;
  void endTime; // v4 不再顯示時間範圍

  const humanDate = formatHumanDate(date);

  const bubble: FlexBubble = {
    type: "bubble",
    header: {
      type: "box",
      layout: "vertical",
      paddingAll: "md",
      contents: [
        {
          type: "text",
          text: "💳 已收到回報",
          weight: "bold",
          size: "md",
          color: "#003D2B",
        },
        {
          type: "box",
          layout: "horizontal",
          margin: "sm",
          contents: [
            {
              type: "text",
              text: "🔍 對帳中",
              size: "xs",
              color: "#809A8E",
              flex: 0,
            },
            {
              type: "text",
              text: humanDate,
              size: "xs",
              color: "#9CB1A4",
              align: "end",
            },
          ],
        },
      ],
      backgroundColor: "#FAF1E0",
    },
    body: {
      type: "box",
      layout: "vertical",
      paddingAll: "md",
      spacing: "sm",
      contents: [
        infoRow("服務", serviceName),
        infoRow("金額", `NT$ ${price.toLocaleString()}`),
        infoRow("末五碼", transferLastFive),
        {
          type: "text",
          text: "老闆對帳完成後會再通知您 🙏",
          size: "xs",
          color: "#9CB1A4",
          margin: "md",
          align: "center",
          wrap: true,
        },
      ],
    },
  };

  return {
    type: "flex",
    altText: `已收到末五碼 ${transferLastFive}，對帳中`,
    contents: bubble,
  };
}


/**
 * Payment received Flex Message — sent when admin clicks「✓ 確認收款」.
 *
 * 2026-04-28 新增。取代原本 mark-received 路由送的純文字訊息，視覺一致 receipt-style，
 * 跟 transferReportedMessage 形成完整體驗閉環（客人收到「款到了」+ 慶祝感）。
 */
export function paymentReceivedMessage(params: {
  serviceName: string;
  date: string;
  amount: number;
  displayName?: string;
  isVip?: boolean;
  googleReviewUrl?: string;
}): FlexMessage {
  const { serviceName, date, amount, displayName, isVip, googleReviewUrl } = params;
  const humanDate = formatHumanDate(date);
  void displayName; // v4: 不再個人化 header（避免太過情緒勒索）

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const footerButtons: any[] = [];
  if (googleReviewUrl) {
    footerButtons.push({
      type: "button" as const,
      action: {
        type: "uri" as const,
        label: "⭐ 給我們五星好評",
        uri: googleReviewUrl,
      },
      style: "primary" as const,
      color: "#C88B3B",
      height: "sm" as const,
    });
  }

  const bubble: FlexBubble = {
    type: "bubble",
    header: {
      type: "box",
      layout: "vertical",
      paddingAll: "md",
      contents: [
        {
          type: "text",
          text: "✅ 已確認收款",
          weight: "bold",
          size: "md",
          color: "#003D2B",
        },
        {
          type: "box",
          layout: "horizontal",
          margin: "sm",
          contents: [
            {
              type: "text",
              text: "✓ 對帳完成",
              size: "xs",
              color: "#5B8266",
              flex: 0,
            },
            {
              type: "text",
              text: humanDate,
              size: "xs",
              color: "#9CB1A4",
              align: "end",
            },
          ],
        },
      ],
      backgroundColor: "#FAF1E0",
    },
    body: {
      type: "box",
      layout: "vertical",
      paddingAll: "md",
      spacing: "sm",
      contents: [
        infoRow("服務", serviceName),
        infoRow("金額", `NT$ ${amount.toLocaleString()}`),
        {
          type: "text",
          text: isVip
            ? "💚 感謝 VIP 顧客的長期支持"
            : "💚 感謝您的光臨，期待下次",
          size: "sm",
          color: isVip ? "#C88B3B" : "#003D2B",
          weight: "bold",
          align: "center",
          margin: "lg",
          wrap: true,
        },
      ],
    },
    footer: footerButtons.length
      ? {
          type: "box",
          layout: "vertical",
          paddingAll: "md",
          contents: footerButtons,
        }
      : undefined,
  };

  return {
    type: "flex",
    altText: `已收款確認 — ${serviceName} NT$${amount.toLocaleString()}`,
    contents: bubble,
  };
}

/** Cash selected Flex Message — sent after customer chooses pay-at-store */
export function cashSelectedMessage(params: {
  serviceName: string;
  date: string;
  startTime: string;
  endTime: string;
  price: number;
  shopName?: string;
  shopAddress?: string;
  liffBaseUrl?: string;
}): FlexMessage {
  const { serviceName, date, startTime, endTime, price, shopName, shopAddress, liffBaseUrl } = params;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const footerButtons: any[] = [];
  if (liffBaseUrl) {
    footerButtons.push({
      type: "button" as const,
      action: {
        type: "uri" as const,
        label: "查看我的預約",
        uri: `${liffBaseUrl}/my-bookings`,
      },
      style: "secondary" as const,
      height: "sm" as const,
    });
  }

  const bubble: FlexBubble = {
    type: "bubble",
    header: {
      type: "box",
      layout: "vertical",
      contents: [
        { type: "text", text: "已選擇到店現金付款 ✓", weight: "bold", size: "lg", color: "#003D2B" },
      ],
      backgroundColor: "#FFF8F1",
    },
    body: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "box",
          layout: "vertical",
          spacing: "sm",
          contents: [
            infoRow("服務", serviceName),
            infoRow("日期", date),
            infoRow("時間", `${startTime} - ${endTime}`),
            infoRow("應付金額", `NT$${price.toLocaleString()}`),
            ...(shopAddress ? [infoRow("地址", shopAddress)] : []),
          ],
        },
        {
          type: "text",
          text: `到店時直接付現給${shopName ?? "老闆"}即可，期待為您服務 🪮`,
          size: "xs",
          color: "#809A8E",
          margin: "xl",
          wrap: true,
        },
      ],
    },
    footer: footerButtons.length
      ? {
          type: "box",
          layout: "vertical",
          spacing: "sm",
          contents: footerButtons,
          backgroundColor: "#FFF8F1",
        }
      : undefined,
  };

  return {
    type: "flex",
    altText: `已選擇現金付款 NT$${price.toLocaleString()}`,
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
  bookingId?: string;
  liffBaseUrl?: string;
  shopAddress?: string;
}): FlexMessage {
  const { serviceName, date, startTime, shopName, hoursUntil, bookingId, liffBaseUrl, shopAddress } = params;
  const timeLabel = hoursUntil <= 2 ? "即將" : "明天";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const footerButtons: any[] = [];

  // 24h reminder: reschedule + navigation buttons
  // 2h reminder: navigation only (no cancel/reschedule to avoid last-minute cancellation)
  if (hoursUntil > 2 && bookingId && liffBaseUrl) {
    footerButtons.push({
      type: "button" as const,
      action: {
        type: "uri" as const,
        label: "需要改期？",
        uri: `${liffBaseUrl}/reschedule/${bookingId}`,
      },
      style: "secondary" as const,
      height: "sm" as const,
    });
  }

  if (shopAddress) {
    footerButtons.push({
      type: "button" as const,
      action: {
        type: "uri" as const,
        label: "導航至店家",
        uri: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(shopAddress)}`,
      },
      style: "primary" as const,
      color: "#003D2B",
      height: "sm" as const,
    });
  }

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
    ...(footerButtons.length > 0
      ? {
          footer: {
            type: "box" as const,
            layout: "vertical" as const,
            spacing: "sm" as const,
            contents: footerButtons,
            backgroundColor: "#FFF8F1",
          },
        }
      : {}),
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
  liffBaseUrl?: string;
}): FlexMessage {
  const { serviceName, date, startTime, isViolation, violationCount, liffBaseUrl } = params;

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
          color: "#A84A3B",
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
                color: "#A84A3B",
                margin: "lg" as const,
                wrap: true,
              },
            ]
          : []),
      ],
    },
    ...(liffBaseUrl
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
                  label: "重新預約",
                  uri: `${liffBaseUrl}/booking`,
                },
                style: "primary" as const,
                color: "#003D2B",
                height: "sm" as const,
              },
            ],
            backgroundColor: "#FFF8F1",
          },
        }
      : {}),
  };

  return {
    type: "flex",
    altText: `預約已取消：${date} ${startTime}`,
    contents: bubble,
  };
}

/**
 * Welcome Flex for new followers — 植物系極簡風格.
 * Dark green header band + minimal info body + 2-button CTA.
 * Secondary button uses LINE message action to send "服務" keyword,
 * keeping the user in-chat for the pricing carousel.
 */
export function welcomeMessage(params: {
  shopName: string;
  tagline?: string;
  hours?: string;
  closedDay?: string;
  phone?: string;
  liffUrl?: string;
}): FlexMessage {
  const {
    shopName,
    tagline = "台北中正區・植物系極簡風格",
    hours = "週二至週日 11:00-20:00",
    closedDay = "每週一",
    phone,
    liffUrl,
  } = params;

  const bubble: FlexBubble = {
    type: "bubble",
    header: {
      type: "box",
      layout: "vertical",
      paddingAll: "24px",
      backgroundColor: "#003D2B",
      contents: [
        {
          type: "text",
          text: shopName.toUpperCase(),
          weight: "bold",
          size: "xl",
          color: "#FFFFFF",
          align: "center",
        },
        {
          type: "text",
          text: tagline,
          size: "sm",
          color: "#B8CFC4",
          align: "center",
          margin: "sm",
          wrap: true,
        },
      ],
    },
    body: {
      type: "box",
      layout: "vertical",
      spacing: "md",
      contents: [
        {
          type: "text",
          text: "服務項目",
          weight: "bold",
          size: "sm",
          color: "#2D3A30",
        },
        {
          type: "text",
          text: "剪髮・染髮・燙髮・護髮",
          size: "sm",
          color: "#809A8E",
          margin: "xs",
        },
        { type: "separator", margin: "lg" },
        {
          type: "box",
          layout: "vertical",
          margin: "lg",
          spacing: "sm",
          contents: [
            infoRow("營業時間", hours),
            infoRow("公休", closedDay),
            ...(phone ? [infoRow("電話", phone)] : []),
          ],
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
                color: "#003D2B",
              },
              {
                type: "button" as const,
                action: {
                  type: "message" as const,
                  label: "查看服務與價格",
                  text: "服務",
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
  };
}

/**
 * Busy notice — sent at most once per 6h to users whose text doesn't match
 * any keyword. Lets them know the owner will reply later and nudges them
 * toward the rich menu for self-service.
 */
export function busyNoticeMessage(): { type: "text"; text: string } {
  return {
    type: "text",
    text: "收到您的訊息了！🙌\n老闆可能正在服務客人，看到會盡快回覆您 🙇\n\n若要預約或查看服務，可直接使用下方選單，免等老闆回覆 👇",
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
          color: "#809A8E",
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
          color: "#003D2B",
        },
      ],
    },
  };

  return {
    type: "flex",
    altText: "點此開始預約",
    contents: bubble,
  };
}

/** Pricing carousel Flex Message — used for keyword "價格" */
export function pricingCarouselMessage(
  services: Array<{
    id: string;
    name: string;
    price: number;
    duration: number;
    description?: string | null;
    imageUrl?: string | null;
  }>,
  liffUrl: string
): FlexMessage {
  // Derive category label from service name
  function getCategoryLabel(name: string): string {
    if (name.includes("剪")) return "HAIRCUT";
    if (name.includes("漂")) return "COLOR";
    if (name.includes("染")) return "COLOR";
    if (name.includes("燙")) return "PERM";
    if (name.includes("矯正")) return "STRAIGHTENING";
    if (name.includes("護")) return "TREATMENT";
    if (name.includes("頭皮")) return "SCALP CARE";
    return "SERVICE";
  }

  // Services with variable pricing (依長度/狀況定價)
  function formatPrice(svc: { name: string; price: number }): string {
    const variablePrice = ["漂髮", "染髮", "溫塑燙", "縮毛矯正", "補染", "頭皮調理"];
    const suffix = variablePrice.includes(svc.name) ? " 起" : "";
    return `NT$${svc.price.toLocaleString()}${suffix}`;
  }

  const bubbles: FlexBubble[] = services.map((svc) => {
    const bubble: FlexBubble = {
      type: "bubble" as const,
      size: "kilo" as const,
      ...(svc.imageUrl
        ? {
            hero: {
              type: "image" as const,
              url: svc.imageUrl,
              size: "full" as const,
              aspectRatio: "20:13" as const,
              aspectMode: "cover" as const,
            },
          }
        : {}),
      body: {
        type: "box" as const,
        layout: "vertical" as const,
        backgroundColor: "#FFF8F1",
        paddingAll: "20px",
        contents: [
          // Category label (uppercase, letter-spaced)
          {
            type: "text" as const,
            text: getCategoryLabel(svc.name),
            size: "xxs" as const,
            color: "#73a891",
            weight: "bold" as const,
          },
          // Service name
          {
            type: "text" as const,
            text: svc.name,
            size: "xl" as const,
            weight: "bold" as const,
            color: "#003D2B",
            margin: "sm" as const,
          },
          // Description
          {
            type: "text" as const,
            text: svc.description || "",
            size: "sm" as const,
            color: "#404944",
            margin: "sm" as const,
            wrap: true,
          },
          // Spacer
          {
            type: "box" as const,
            layout: "vertical" as const,
            contents: [],
            flex: 1,
          },
          // Price + Duration row
          {
            type: "box" as const,
            layout: "horizontal" as const,
            margin: "lg" as const,
            contents: [
              {
                type: "text" as const,
                text: formatPrice(svc),
                size: "md" as const,
                weight: "bold" as const,
                color: "#003D2B",
              },
              {
                type: "text" as const,
                text: `${svc.duration}min`,
                size: "xs" as const,
                color: "#707974",
                align: "end" as const,
                gravity: "bottom" as const,
              },
            ],
          },
        ],
      },
      footer: {
        type: "box" as const,
        layout: "vertical" as const,
        backgroundColor: "#FFF8F1",
        paddingAll: "12px",
        contents: [
          {
            type: "button" as const,
            action: {
              type: "uri" as const,
              label: "立即預約",
              uri: `${liffUrl}/booking?serviceId=${svc.id}`,
            },
            style: "primary" as const,
            color: "#003D2B",
            height: "sm" as const,
          },
        ],
      },
    };
    return bubble;
  });

  const carousel: FlexCarousel = {
    type: "carousel",
    contents: bubbles,
  };

  return {
    type: "flex",
    altText: "1008 Hair Studio 服務項目 — 左右滑動瀏覽",
    contents: carousel,
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
          color: "#809A8E",
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
          color: "#003D2B",
        },
      ],
    },
  };

  return {
    type: "flex",
    altText: "點此查看我的預約",
    contents: bubble,
  };
}

/** Dynamic "My Bookings" Flex Message — shows actual upcoming bookings as carousel */
export function myBookingsFlexMessage(params: {
  bookings: Array<{
    id: string;
    date: string;
    startTime: string;
    endTime: string;
    serviceName: string;
    price: number;
    paymentStatus: string | null;
    hoursUntilAppointment?: number;
  }>;
  liffBaseUrl: string;
  shopName: string;
}): FlexMessage {
  const { bookings, liffBaseUrl, shopName } = params;

  const bubbles: FlexBubble[] = bookings.map((b) => {
    const isPaid = b.paymentStatus === "RECEIVED";
    const hours = b.hoursUntilAppointment ?? 999;
    const canReschedule = hours > 0;    // Reschedule anytime before appointment (< 2h adds violation)
    const canCancel = hours >= 24;       // 24h for cancel
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const buttons: any[] = [];

    // Reschedule button
    if (canReschedule) {
      buttons.push({
        type: "button" as const,
        action: {
          type: "uri" as const,
          label: "改期",
          uri: `${liffBaseUrl}/reschedule/${b.id}`,
        },
        style: "primary" as const,
        color: "#003D2B",
        height: "sm" as const,
      });
    }

    // Cancel button
    if (canCancel) {
      buttons.push({
        type: "button" as const,
        action: {
          type: "uri" as const,
          label: "取消預約",
          uri: `${liffBaseUrl}/cancel/${b.id}`,
        },
        style: "secondary" as const,
        height: "sm" as const,
      });
    }

    // If neither reschedule nor cancel available, show phone prompt
    if (!canReschedule && !canCancel) {
      buttons.push({
        type: "button" as const,
        action: {
          type: "uri" as const,
          label: "改期/取消請致電店家",
          uri: `${liffBaseUrl}/cancel/${b.id}`,
        },
        style: "secondary" as const,
        height: "sm" as const,
      });
    } else if (canReschedule && !canCancel) {
      // Can reschedule but not cancel — show hint
      buttons.push({
        type: "button" as const,
        action: {
          type: "uri" as const,
          label: "取消請致電店家",
          uri: `${liffBaseUrl}/cancel/${b.id}`,
        },
        style: "secondary" as const,
        height: "sm" as const,
      });
    }

    // 2026-04-27: 「前往付款」按鈕已移除 — 用 Rich Menu「匯款資訊」直接付款。
    // (`isPaid` 仍在 body 顯示「待付款 / 已付款 ✓」狀態列。)

    return {
      type: "bubble" as const,
      body: {
        type: "box" as const,
        layout: "vertical" as const,
        contents: [
          {
            type: "text" as const,
            text: shopName,
            size: "xs" as const,
            color: "#809A8E",
          },
          {
            type: "text" as const,
            text: b.serviceName,
            weight: "bold" as const,
            size: "xl" as const,
            margin: "sm" as const,
          },
          {
            type: "separator" as const,
            margin: "lg" as const,
          },
          {
            type: "box" as const,
            layout: "vertical" as const,
            margin: "lg" as const,
            spacing: "sm" as const,
            contents: [
              infoRow("日期", b.date),
              infoRow("時間", `${b.startTime} - ${b.endTime}`),
              infoRow("價格", `NT$${b.price.toLocaleString()}`),
              ...(isPaid
                ? [infoRow("付款", "已付款 ✓")]
                : [infoRow("付款", "待付款")]),
            ],
          },
        ],
      },
      footer: {
        type: "box" as const,
        layout: "vertical" as const,
        spacing: "sm" as const,
        contents: buttons,
        backgroundColor: "#FFF8F1",
      },
    };
  });

  // If only one booking, return single bubble; otherwise carousel
  const contents: FlexBubble | FlexCarousel =
    bubbles.length === 1
      ? bubbles[0]
      : { type: "carousel", contents: bubbles };

  return {
    type: "flex",
    altText: `你有 ${bookings.length} 筆即將到來的預約`,
    contents,
  };
}

/** Empty state for "My Bookings" — no upcoming bookings */
export function myBookingsEmptyMessage(liffBaseUrl: string): FlexMessage {
  const bubble: FlexBubble = {
    type: "bubble",
    body: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "text",
          text: "目前沒有即將到來的預約",
          weight: "bold",
          size: "md",
          color: "#003D2B",
          align: "center" as const,
        },
        {
          type: "text",
          text: "想要預約嗎？隨時歡迎您！",
          size: "sm",
          color: "#809A8E",
          margin: "md",
          align: "center" as const,
          wrap: true,
        },
      ],
      justifyContent: "center" as const,
      paddingTop: "24px",
      paddingBottom: "8px",
    },
    footer: {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      contents: [
        {
          type: "button",
          action: {
            type: "uri",
            label: "立即預約",
            uri: `${liffBaseUrl}/booking`,
          },
          style: "primary" as const,
          color: "#003D2B",
          height: "sm" as const,
        },
        {
          type: "button",
          action: {
            type: "uri",
            label: "歷史記錄",
            uri: `${liffBaseUrl}/my-bookings`,
          },
          style: "secondary" as const,
          height: "sm" as const,
        },
      ],
      backgroundColor: "#FFF8F1",
    },
  };

  return {
    type: "flex",
    altText: "目前沒有即將到來的預約",
    contents: bubble,
  };
}

/** Admin daily settlement Flex Message — sent at 20:30 to shop owner */
export function dailySettlementMessage(params: {
  date: string;
  bookings: Array<{
    customerName: string;
    serviceName: string;
    startTime: string;
    status: string;
    price: number;
  }>;
  summary: {
    total: number;
    completed: number;
    noShow: number;
    unresolved: number;
    revenue: number;
  };
  dashboardUrl: string;
}): FlexMessage {
  const { date, summary, dashboardUrl } = params;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const footerContents: any[] = [];
  if (summary.unresolved > 0) {
    footerContents.push({
      type: "button" as const,
      action: {
        type: "uri" as const,
        label: `前往處理（${summary.unresolved} 筆待確認）`,
        uri: dashboardUrl,
      },
      style: "primary" as const,
      color: "#003D2B",
      height: "sm" as const,
    });
  }

  const bubble: FlexBubble = {
    type: "bubble",
    header: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "text",
          text: `📋 今日預約結算`,
          weight: "bold",
          size: "lg",
          color: "#003D2B",
        },
        {
          type: "text",
          text: date,
          size: "sm",
          color: "#809A8E",
        },
      ],
      backgroundColor: "#FFF8F1",
    },
    body: {
      type: "box",
      layout: "vertical",
      contents: [
        infoRow("總預約", `${summary.total} 筆`),
        infoRow("已完成", `${summary.completed} 筆`),
        infoRow("未到", `${summary.noShow} 筆`),
        infoRow("待確認", `${summary.unresolved} 筆`),
        {
          type: "separator" as const,
          margin: "lg" as const,
        },
        {
          type: "box" as const,
          layout: "horizontal" as const,
          margin: "lg" as const,
          contents: [
            {
              type: "text" as const,
              text: "營收",
              size: "sm" as const,
              color: "#809A8E",
              flex: 2,
            },
            {
              type: "text" as const,
              text: `NT$${summary.revenue.toLocaleString()}`,
              size: "lg" as const,
              color: "#003D2B",
              weight: "bold" as const,
              flex: 5,
            },
          ],
        },
      ],
    },
    ...(footerContents.length > 0
      ? {
          footer: {
            type: "box" as const,
            layout: "vertical" as const,
            spacing: "sm" as const,
            contents: footerContents,
            backgroundColor: "#FFF8F1",
          },
        }
      : {}),
  };

  return {
    type: "flex",
    altText: `今日預約結算：${summary.total} 筆，營收 NT$${summary.revenue.toLocaleString()}`,
    contents: bubble,
  };
}

/** Reschedule confirmation Flex Message */
export function rescheduleConfirmationMessage(params: {
  serviceName: string;
  oldDate: string;
  oldStartTime: string;
  newDate: string;
  newStartTime: string;
  newEndTime: string;
  shopName: string;
  liffBaseUrl?: string;
  bookingId?: string;
}): FlexMessage {
  const { serviceName, oldDate, oldStartTime, newDate, newStartTime, newEndTime, shopName, liffBaseUrl, bookingId } = params;

  const calendarUrl = buildGoogleCalendarUrl(serviceName, newDate, newStartTime, newEndTime);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const footerButtons: any[] = [
    {
      type: "button" as const,
      action: {
        type: "uri" as const,
        label: "加入 Google 行事曆",
        uri: calendarUrl,
      },
      style: "primary" as const,
      color: "#003D2B",
      height: "sm" as const,
    },
  ];

  if (liffBaseUrl && bookingId) {
    footerButtons.push({
      type: "button" as const,
      action: {
        type: "uri" as const,
        label: "查看我的預約",
        uri: `${liffBaseUrl}/my-bookings`,
      },
      style: "secondary" as const,
      height: "sm" as const,
    });
  }

  const bubble: FlexBubble = {
    type: "bubble",
    header: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "text",
          text: "預約改期成功 ✓",
          weight: "bold",
          size: "lg",
          color: "#003D2B",
        },
      ],
      backgroundColor: "#FFF8F1",
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
            infoRow("原時段", `${oldDate} ${oldStartTime}`),
            infoRow("新時段", `${newDate} ${newStartTime} - ${newEndTime}`),
          ],
        },
      ],
    },
    footer: {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      contents: footerButtons,
      backgroundColor: "#FFF8F1",
    },
  };

  return {
    type: "flex",
    altText: `預約改期成功：${newDate} ${newStartTime} ${serviceName}`,
    contents: bubble,
  };
}

/**
 * Payment guide Flex Message — used for keyword "匯款".
 *
 * Flow (2026-04-27 v2):
 *   1. paymentGuideMessage Flex 顯示銀行/戶名/帳號 + 該客最近一筆 booking 的金額
 *      + 兩顆按鈕：「📋 點此複製帳號」(clipboardAction) + 「✓ 確定完成匯款」(message)
 *   2. 客人點複製帳號 → 帳號直接寫進剪貼簿（LINE 2024 clipboardAction，不用長按）
 *   3. 客人點「✓ 確定完成匯款」→ bot 引導輸入末五碼（webhook 的 payment-confirm-done intent）
 *   4. 客人輸入 5 碼數字 → webhook payment-last5 intent → 寫 DB + 推播老闆 + Flex 確認
 *
 * Notes:
 *   - `amount` 由 webhook 從該客「最近一筆 CONFIRMED booking」帶入；查無預約則 omit。
 *   - clipboardAction 在 @line/bot-sdk v10.6 還沒入型別，用 cast 繞過；runtime API 認得。
 *   - 整套流程不再經過 LIFF /payment 頁（已於 2026-04-27 移除）。
 */
export function paymentGuideMessage(params: {
  bankName: string;
  bankAccountName: string;
  bankAccountNumber: string;
  amount?: number;
  serviceName?: string;
}): FlexMessage {
  const {
    bankName,
    bankAccountName,
    bankAccountNumber,
    amount,
    serviceName,
  } = params;

  const hasAmount = typeof amount === "number" && amount > 0;
  const cleanAccountForDisplay = bankAccountNumber.replace(/[\s-]/g, "");
  // 把帳號每 4 碼空一格，方便人眼掃讀（例：1234 5678 9012 3456）
  const formattedAccount = cleanAccountForDisplay.replace(/(.{4})(?=.)/g, "$1 ");

  const bodyContents: FlexComponent[] = [
    // 銀行 + 戶名（小字、置中）
    {
      type: "text",
      text: bankName,
      align: "center",
      size: "sm",
      color: "#003D2B",
      weight: "bold",
    },
    {
      type: "text",
      text: bankAccountName,
      align: "center",
      size: "xs",
      color: "#809A8E",
      margin: "xs",
    },
    { type: "separator", margin: "lg" },
    // ⭐ 帳號 — 客人唯一要記憶的資訊，用最大字級置中粗體
    {
      type: "text",
      text: formattedAccount,
      align: "center",
      size: "xl",
      weight: "bold",
      color: "#003D2B",
      margin: "lg",
    },
    {
      type: "text",
      text: "帳號",
      align: "center",
      size: "xs",
      color: "#9CB1A4",
      margin: "xs",
    },
  ];

  if (hasAmount) {
    const amountBlockContents: FlexComponent[] = [
      {
        type: "box",
        layout: "horizontal",
        contents: [
          {
            type: "text",
            text: "💰 本次金額",
            size: "sm",
            color: "#809A8E",
            flex: 3,
          },
          {
            type: "text",
            text: `NT$ ${amount!.toLocaleString("en-US")}`,
            size: "lg",
            weight: "bold",
            color: "#003D2B",
            flex: 4,
            align: "end",
          },
        ],
      },
    ];
    if (serviceName) {
      amountBlockContents.push({
        type: "text",
        text: serviceName,
        size: "xs",
        color: "#9CB1A4",
        align: "end",
      });
    }

    bodyContents.push(
      { type: "separator", margin: "lg" },
      {
        type: "box",
        layout: "vertical",
        margin: "lg",
        spacing: "sm",
        contents: amountBlockContents,
      }
    );
  }

  // 簡化文案：拿掉「完成步驟」標題、不再出現「現金付款」干擾文字
  // 動線靠 footer 兩顆按鈕引導即可（複製帳號 → 確定完成匯款）
  bodyContents.push(
    { type: "separator", margin: "lg" },
    {
      type: "text",
      text: "完成轉帳後，請點下方按鈕回報",
      size: "xs",
      margin: "lg",
      color: "#9CB1A4",
      align: "center",
      wrap: true,
    },
  );

  // 2024-09 LINE 推出 clipboardAction — 點按鈕直接把 clipboardText 寫進客人剪貼簿
  // (一鍵複製，不用長按)。@line/bot-sdk v10.6 的 type 還沒跟上，這裡用 cast 繞過；
  // runtime LINE API 認得這個 action type。
  // 參考：https://developers.line.biz/en/reference/messaging-api/#clipboard-action
  // 帳號去掉空白 / 連字符（已在上方 cleanAccountForDisplay 算過），複製按鈕用同一個值
  type ClipboardAction = { type: "clipboard"; label: string; clipboardText: string };
  const clipboardAction = (label: string, clipboardText: string): ClipboardAction => ({
    type: "clipboard",
    label,
    clipboardText,
  });

  // Footer 兩段式視覺層級：
  //   Step 1 (複製帳號)        — 森林綠 primary，size sm
  //   分隔線 + 「完成轉帳後 →」 hint
  //   Step 2 (確定完成匯款)    — 金黃 primary，size md（更明顯）
  // 確定完成匯款是整個 flow 的關鍵 CTA，所以用更暖、更大的視覺強調
  const footerContents: (FlexButton | FlexComponent)[] = [
    {
      type: "button",
      action: clipboardAction("📋 點此複製帳號", cleanAccountForDisplay) as unknown as FlexButton["action"],
      style: "primary",
      color: "#003D2B",
      height: "sm",
    },
    {
      type: "separator",
      margin: "md",
    },
    {
      type: "text",
      text: "✅ 完成轉帳後請點下方",
      size: "xs",
      color: "#809A8E",
      align: "center",
      margin: "md",
    },
    {
      // 2026-04-27 v2: 視覺升級。message action 故意讓 chat 留下
      // 「確定完成匯款」氣泡，作為客人完成轉帳的明確 timestamp
      type: "button",
      action: {
        type: "message",
        label: "✓ 確定完成匯款",
        text: "確定完成匯款",
      },
      style: "primary",
      color: "#C88B3B", // 金黃色強調 — 與 brand 既有 accent 色一致
      height: "md",
    },
  ];

  const bubble: FlexBubble = {
    type: "bubble",
    header: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "text",
          text: "💳 匯款資訊",
          weight: "bold",
          size: "lg",
          color: "#003D2B",
        },
      ],
      backgroundColor: "#FAF1E0",
    },
    body: {
      type: "box",
      layout: "vertical",
      contents: bodyContents,
    },
    footer: {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      contents: footerContents as FlexComponent[],
    },
  };

  return {
    type: "flex",
    altText:
      hasAmount
        ? `匯款資訊 — NT$ ${amount!.toLocaleString("en-US")}`
        : "匯款資訊 — 銀行轉帳",
    contents: bubble,
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
          color: "#003D2B",
        },
        {
          type: "text",
          text: `感謝您在 ${shopName} 的消費，希望您滿意今天的${serviceName}服務。`,
          size: "sm",
          margin: "lg",
          wrap: true,
          color: "#809A8E",
        },
        {
          type: "text",
          text: "期待下次再為您服務！",
          size: "sm",
          margin: "md",
          wrap: true,
          color: "#809A8E",
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
          color: "#003D2B",
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
          color: "#003D2B",
        },
      ],
      backgroundColor: "#F3ECE4",
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
          color: "#A84A3B",
        },
      ],
      backgroundColor: "#F3ECE4",
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
          color: "#2D3A30",
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
          color: "#003D2B",
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

/** Launch lottery — congratulates a winner and explains how to redeem. */
export function lotteryWinnerMessage(params: { shopName: string }): FlexMessage {
  const { shopName } = params;
  const bubble: FlexBubble = {
    type: "bubble",
    header: {
      type: "box",
      layout: "vertical",
      backgroundColor: "#003D2B",
      paddingAll: "lg",
      contents: [
        {
          type: "text",
          text: "🎉 恭喜中獎！",
          weight: "bold",
          size: "xl",
          color: "#FFF8F1",
        },
      ],
    },
    body: {
      type: "box",
      layout: "vertical",
      spacing: "md",
      contents: [
        {
          type: "text",
          text: `${shopName} 上線抽獎活動`,
          size: "sm",
          color: "#666666",
        },
        {
          type: "text",
          text: "您獲得免費剪髮一次！",
          weight: "bold",
          size: "lg",
          color: "#003D2B",
          wrap: true,
        },
        {
          type: "separator",
          margin: "md",
        },
        {
          type: "text",
          text: "兌換方式",
          weight: "bold",
          size: "sm",
          color: "#003D2B",
          margin: "md",
        },
        {
          type: "text",
          text: "下次到店剪髮時，跟老闆說「我中獎了」即可免費。",
          size: "sm",
          color: "#666666",
          wrap: true,
        },
        {
          type: "text",
          text: "感謝您的支持！",
          size: "xs",
          color: "#999999",
          margin: "md",
        },
      ],
    },
  };
  return {
    type: "flex",
    altText: `🎉 恭喜！您獲得 ${shopName} 免費剪髮一次`,
    contents: bubble,
  };
}

/** Launch announcement Flex — broadcast to all users with deadline + form link. */
export function launchAnnouncementMessage(params: {
  shopName: string;
  profileUrl: string;
  deadlineLabel: string;
  prizeLabel: string;
}): FlexMessage {
  const { shopName, profileUrl, deadlineLabel, prizeLabel } = params;
  const bubble: FlexBubble = {
    type: "bubble",
    header: {
      type: "box",
      layout: "vertical",
      backgroundColor: "#003D2B",
      paddingAll: "lg",
      contents: [
        {
          type: "text",
          text: "📣 新系統上線",
          weight: "bold",
          size: "lg",
          color: "#FFF8F1",
        },
        {
          type: "text",
          text: shopName,
          size: "sm",
          color: "#FFF8F1",
        },
      ],
    },
    body: {
      type: "box",
      layout: "vertical",
      spacing: "md",
      contents: [
        {
          type: "text",
          text: "為慶祝 LINE 預約系統上線，30 秒填寫會員資料即可參加抽獎！",
          size: "sm",
          color: "#003D2B",
          wrap: true,
        },
        {
          type: "box",
          layout: "vertical",
          backgroundColor: "#003D2B0A",
          paddingAll: "md",
          cornerRadius: "md",
          spacing: "xs",
          contents: [
            {
              type: "text",
              text: "🎁 抽獎獎項",
              weight: "bold",
              size: "sm",
              color: "#003D2B",
            },
            {
              type: "text",
              text: prizeLabel,
              size: "sm",
              color: "#003D2B",
              wrap: true,
            },
            {
              type: "text",
              text: `⏰ 截止：${deadlineLabel}`,
              size: "xs",
              color: "#A84A3B",
              margin: "sm",
            },
          ],
        },
        {
          type: "text",
          text: "🔒 我們不會發行銷簡訊，手機只用於預約提醒。",
          size: "xs",
          color: "#999999",
          wrap: true,
          margin: "md",
        },
      ],
    },
    footer: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "button",
          style: "primary",
          color: "#003D2B",
          action: {
            type: "uri",
            label: "立即填寫（30 秒）",
            uri: profileUrl,
          },
        },
      ],
    },
  };
  return {
    type: "flex",
    altText: `📣 ${shopName} 上線抽獎，填會員資料抽免費剪髮，截止 ${deadlineLabel}`,
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
          color: "#003D2B",
        },
        {
          type: "text",
          text: `${period.from} ~ ${period.to}`,
          size: "xs",
          color: "#809A8E",
          margin: "sm",
        },
      ],
      backgroundColor: "#FFF8F1",
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
          color: "#2D3A30",
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
          color: "#2D3A30",
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
          color: "#2D3A30",
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

/** 7-day follow-up message for perm/color services with care tips */
export function followUpMessage(params: {
  serviceType: "perm" | "color";
  serviceName: string;
  shopName: string;
  liffUrl: string;
}): FlexMessage {
  const { serviceType, serviceName, shopName, liffUrl } = params;

  const isPerm = serviceType === "perm";

  const title = isPerm ? "燙髮後護理小提醒" : "染髮後護色小提醒";
  const tips = isPerm
    ? [
        "洗髮後用毛巾輕壓吸水，避免搓揉",
        "建議使用無硫酸鹽洗髮精",
        "每週使用一次深層護髮膜",
        "避免將頭髮綁太緊或用細橡皮筋",
        "減少使用高溫造型工具",
      ]
    : [
        "洗髮時使用溫涼水，避免過熱",
        "建議使用護色專用洗髮精",
        "減少高溫造型，保護髮色",
        "定期補色可維持最佳效果",
        "外出時可戴帽子防止紫外線褪色",
      ];

  const bubble: FlexBubble = {
    type: "bubble",
    header: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "text",
          text: `💆 ${title}`,
          weight: "bold",
          size: "lg",
          color: "#003D2B",
        },
      ],
      backgroundColor: "#FFF8F1",
    },
    body: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "text",
          text: `上次的${serviceName}還滿意嗎？以下是居家護理建議，幫助您維持最佳效果：`,
          size: "sm",
          wrap: true,
          color: "#809A8E",
        },
        {
          type: "separator",
          margin: "lg",
        },
        {
          type: "box",
          layout: "vertical",
          margin: "lg",
          spacing: "md",
          contents: tips.map((tip) => ({
            type: "box" as const,
            layout: "horizontal" as const,
            contents: [
              {
                type: "text" as const,
                text: "•",
                size: "sm" as const,
                color: "#003D2B",
                flex: 1,
              },
              {
                type: "text" as const,
                text: tip,
                size: "sm" as const,
                color: "#2D3A30",
                flex: 9,
                wrap: true,
              },
            ],
          })),
        },
        {
          type: "text",
          text: "有任何問題歡迎隨時詢問我們！",
          size: "xs",
          color: "#809A8E",
          margin: "xl",
          wrap: true,
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
            label: "預約回訪",
            uri: liffUrl,
          },
          style: "primary",
          color: "#003D2B",
        },
      ],
    },
  };

  return {
    type: "flex",
    altText: `${shopName}：${title}，為您整理居家護理建議`,
    contents: bubble,
  };
}

/** Birthday greeting message */
export function birthdayMessage(params: {
  displayName: string;
  shopName: string;
  liffUrl: string;
}): FlexMessage {
  const { displayName, shopName, liffUrl } = params;
  const name = displayName || "您";

  const bubble: FlexBubble = {
    type: "bubble",
    header: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "text",
          text: "🎂 生日快樂！",
          weight: "bold",
          size: "xl",
          color: "#003D2B",
        },
      ],
      backgroundColor: "#FFF8F1",
    },
    body: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "text",
          text: `親愛的 ${name}，`,
          weight: "bold",
          size: "md",
          color: "#2D3A30",
        },
        {
          type: "text",
          text: `${shopName} 祝您生日快樂！🎉\n祝您新的一歲健康快樂、天天好心情！`,
          size: "sm",
          margin: "lg",
          wrap: true,
          color: "#809A8E",
        },
        {
          type: "separator",
          margin: "xl",
        },
        {
          type: "text",
          text: "🎁 生日月來店消費享小驚喜",
          weight: "bold",
          size: "sm",
          margin: "lg",
          color: "#003D2B",
        },
        {
          type: "text",
          text: "預約時跟我們說是壽星，有專屬小禮物喔！",
          size: "xs",
          margin: "sm",
          wrap: true,
          color: "#809A8E",
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
          color: "#003D2B",
        },
      ],
    },
  };

  return {
    type: "flex",
    altText: `${shopName} 祝 ${name} 生日快樂！🎂 來店消費享驚喜`,
    contents: bubble,
  };
}

/**
 * Service inquiry Flex card — replies to keyword 「燙」/「染」 (PRD-v3 §7).
 *
 * 漂髮 (bleach) is intentionally NOT routed here — it goes through the
 * consultation flow (Wave 4a) which creates a ConsultationRequest record.
 * Perm/color is lighter touch: just ask the customer for the 3 things admin
 * needs to give a quote, then admin handles via LINE chat or LIFF booking.
 */
export function serviceInquiryFlexMessage(params: {
  serviceType: "perm" | "color";
  liffBaseUrl: string;
  shopName: string;
}): FlexMessage {
  const { serviceType, liffBaseUrl, shopName } = params;
  const isPerm = serviceType === "perm";
  const serviceLabel = isPerm ? "燙髮" : "染髮";
  const verbLabel = isPerm ? "燙" : "染";

  const bubble: FlexBubble = {
    type: "bubble",
    header: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "text",
          text: `想${verbLabel}嗎？`,
          weight: "bold",
          size: "xl",
          color: "#003D2B",
        },
        {
          type: "text",
          text: `${shopName}為您報價前，請提供 3 項資訊：`,
          size: "sm",
          color: "#809A8E",
          margin: "sm",
          wrap: true,
        },
      ],
      backgroundColor: "#F3ECE4",
      paddingAll: "lg",
    },
    body: {
      type: "box",
      layout: "vertical",
      spacing: "md",
      contents: [
        infoRow("A.", `上次${verbLabel}是什麼時候？（沒${verbLabel}過也告訴我）`),
        infoRow("B.", "現在頭髮狀況的照片（自然光、後腦勺一張）"),
        infoRow("C.", `期待的造型參考照（可截圖網路上的${serviceLabel}照）`),
        {
          type: "separator",
          margin: "lg",
        },
        {
          type: "text",
          text: "📸 直接傳照片到這個對話框即可，回覆後我們會盡快給你報價與時間建議。",
          size: "xs",
          color: "#809A8E",
          wrap: true,
          margin: "md",
        },
      ],
      paddingAll: "lg",
    },
    footer: {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      contents: [
        {
          type: "button",
          action: {
            type: "uri",
            label: `先預約看看（${serviceLabel}）`,
            uri: liffBaseUrl,
          },
          style: "primary",
          color: "#003D2B",
          height: "sm",
        },
      ],
      paddingAll: "lg",
    },
  };

  return {
    type: "flex",
    altText: `想${verbLabel}嗎？請提供：上次${verbLabel}時間、現況照片、期待造型`,
    contents: bubble,
  };
}

/**
 * 漂髮諮詢 Flex card — replies to keyword 「漂」 (PRD-v3 §3, Wave 4a).
 *
 * Bleach is high-judgement: outcome depends on hair condition + history. We
 * route to the consultation flow (LIFF /consultation) so the customer fills a
 * structured form and admin can triage in /consultations queue, instead of
 * lossy LINE-chat back-and-forth.
 */
export function bleachConsultationFlexMessage(params: {
  liffBaseUrl: string;
  consultationLiffUrl: string;
  shopName: string;
}): FlexMessage {
  const { consultationLiffUrl, shopName } = params;

  const bubble: FlexBubble = {
    type: "bubble",
    header: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "text",
          text: "想漂髮嗎？",
          weight: "bold",
          size: "xl",
          color: "#003D2B",
        },
        {
          type: "text",
          text: `${shopName}會先確認您的頭髮狀況再報價`,
          size: "sm",
          color: "#809A8E",
          margin: "sm",
          wrap: true,
        },
      ],
      backgroundColor: "#F3ECE4",
      paddingAll: "lg",
    },
    body: {
      type: "box",
      layout: "vertical",
      spacing: "md",
      contents: [
        {
          type: "text",
          text: "漂髮的時間與藥水會依以下條件決定：",
          size: "sm",
          color: "#2D3A30",
          wrap: true,
        },
        infoRow("•", "目前髮色 / 上次染燙時間"),
        infoRow("•", "想漂到的目標度數"),
        infoRow("•", "頭皮敏感與受損狀況"),
        {
          type: "separator",
          margin: "lg",
        },
        {
          type: "text",
          text: "請點下方按鈕填寫諮詢表單，我們會在 24 小時內回覆 🙏",
          size: "xs",
          color: "#809A8E",
          wrap: true,
          margin: "md",
        },
      ],
      paddingAll: "lg",
    },
    footer: {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      contents: [
        {
          type: "button",
          action: {
            type: "uri",
            label: "填寫諮詢表單",
            uri: consultationLiffUrl,
          },
          style: "primary",
          color: "#003D2B",
          height: "sm",
        },
        {
          type: "text",
          text: "📷 也可以直接傳照片到聊天室",
          size: "xxs",
          color: "#809A8E",
          align: "center",
          margin: "sm",
        },
      ],
      paddingAll: "lg",
    },
  };

  return {
    type: "flex",
    altText: `想漂髮嗎？請點開連結填寫諮詢表單，我們會回覆您`,
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
        color: "#809A8E",
        flex: 2,
      },
      {
        type: "text" as const,
        text: value,
        size: "sm" as const,
        color: "#2D3A30",
        flex: 5,
        wrap: true,
      },
    ],
  };
}
