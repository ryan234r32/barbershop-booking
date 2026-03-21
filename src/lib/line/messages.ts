import { FlexMessage, FlexBubble } from "@line/bot-sdk";

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
          text: `歡迎加入 ${shopName}！`,
          weight: "bold",
          size: "lg",
        },
        {
          type: "text",
          text: "您現在可以直接透過 LINE 預約服務，隨時查看可用時段。",
          size: "sm",
          margin: "lg",
          wrap: true,
        },
      ],
    },
    ...(liffUrl ? {
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
    } : {}),
  };

  return {
    type: "flex",
    altText: `歡迎加入 ${shopName}！點此預約`,
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
