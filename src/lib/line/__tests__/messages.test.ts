import { describe, it, expect } from "vitest";
import {
  bookingConfirmationMessage,
  reminderMessage,
  cancellationMessage,
  welcomeMessage,
  campaignMessage,
  weeklyReportMessage,
  paymentGuideMessage,
  defaultQuickReply,
  adminNewBookingMessage,
  adminCancellationMessage,
} from "@/lib/line/messages";

describe("bookingConfirmationMessage", () => {
  const params = {
    serviceName: "男性剪髮",
    date: "2026-03-25",
    startTime: "14:00",
    endTime: "15:00",
    shopName: "1008 Hair Studio",
  };

  it("returns a Flex message with type 'flex'", () => {
    const msg = bookingConfirmationMessage(params);
    expect(msg.type).toBe("flex");
  });

  it("includes service info in altText", () => {
    const msg = bookingConfirmationMessage(params);
    expect(msg.altText).toContain("男性剪髮");
    expect(msg.altText).toContain("2026-03-25");
    expect(msg.altText).toContain("14:00");
  });

  it("has bubble content structure", () => {
    const msg = bookingConfirmationMessage(params);
    expect(msg.contents).toBeDefined();
    expect(msg.contents.type).toBe("bubble");
  });

  it("includes shop address when provided", () => {
    const msg = bookingConfirmationMessage({
      ...params,
      shopAddress: "台北市中正區新生南路一段144-10號",
    });
    const bodyStr = JSON.stringify(msg.contents);
    expect(bodyStr).toContain("地址");
  });

  it("omits address section when not provided", () => {
    const msg = bookingConfirmationMessage(params);
    const bodyStr = JSON.stringify(msg.contents);
    expect(bodyStr).not.toContain("地址");
  });
});

describe("reminderMessage", () => {
  it("shows '明天' for 24-hour reminder", () => {
    const msg = reminderMessage({
      serviceName: "女性剪髮",
      date: "2026-03-25",
      startTime: "14:00",
      shopName: "1008 Hair Studio",
      hoursUntil: 24,
    });
    const bodyStr = JSON.stringify(msg.contents);
    expect(bodyStr).toContain("明天");
  });

  it("shows '即將' for 1-hour reminder", () => {
    const msg = reminderMessage({
      serviceName: "女性剪髮",
      date: "2026-03-25",
      startTime: "14:00",
      shopName: "1008 Hair Studio",
      hoursUntil: 1,
    });
    const bodyStr = JSON.stringify(msg.contents);
    expect(bodyStr).toContain("即將");
  });

  it("includes service name in altText", () => {
    const msg = reminderMessage({
      serviceName: "溫塑燙",
      date: "2026-03-25",
      startTime: "11:00",
      shopName: "1008 Hair Studio",
      hoursUntil: 24,
    });
    expect(msg.altText).toContain("溫塑燙");
  });
});

describe("cancellationMessage", () => {
  it("does not show violation warning when not a violation", () => {
    const msg = cancellationMessage({
      serviceName: "男性剪髮",
      date: "2026-03-25",
      startTime: "14:00",
      isViolation: false,
      violationCount: 0,
    });
    const bodyStr = JSON.stringify(msg.contents);
    expect(bodyStr).not.toContain("違規");
  });

  it("shows violation warning with count when violation", () => {
    const msg = cancellationMessage({
      serviceName: "男性剪髮",
      date: "2026-03-25",
      startTime: "14:00",
      isViolation: true,
      violationCount: 2,
    });
    const bodyStr = JSON.stringify(msg.contents);
    expect(bodyStr).toContain("違規");
    expect(bodyStr).toContain("2/3");
  });

  it("shows 3/3 for max violations", () => {
    const msg = cancellationMessage({
      serviceName: "男性剪髮",
      date: "2026-03-25",
      startTime: "14:00",
      isViolation: true,
      violationCount: 3,
    });
    const bodyStr = JSON.stringify(msg.contents);
    expect(bodyStr).toContain("3/3");
  });
});

describe("welcomeMessage", () => {
  it("includes shop name", () => {
    const msg = welcomeMessage("1008 Hair Studio");
    expect(msg.altText).toContain("1008 Hair Studio");
    const bodyStr = JSON.stringify(msg.contents);
    expect(bodyStr).toContain("1008 Hair Studio");
  });

  it("includes booking button when liffUrl is provided", () => {
    const msg = welcomeMessage(
      "1008 Hair Studio",
      "https://liff.line.me/1234567890-abcdefgh"
    );
    const bodyStr = JSON.stringify(msg.contents);
    expect(bodyStr).toContain("立即預約");
    expect(bodyStr).toContain("https://liff.line.me/1234567890-abcdefgh");
  });

  it("omits booking button when liffUrl is not provided", () => {
    const msg = welcomeMessage("1008 Hair Studio");
    const content = msg.contents as Record<string, unknown>;
    expect(content.footer).toBeUndefined();
  });
});

describe("defaultQuickReply", () => {
  it("returns 5 quick reply items", () => {
    const qr = defaultQuickReply();
    expect(qr.items).toHaveLength(5);
  });

  it("all items have type 'action'", () => {
    const qr = defaultQuickReply();
    for (const item of qr.items) {
      expect(item.type).toBe("action");
    }
  });

  it("includes common actions like booking and pricing", () => {
    const qr = defaultQuickReply();
    const labels = qr.items.map((item) => {
      const action = item.action as { label: string };
      return action.label;
    });
    expect(labels).toContain("立即預約");
    expect(labels).toContain("服務價目");
  });
});

describe("campaignMessage", () => {
  const text = "春季優惠！剪髮八折，快來預約！";
  const liffUrl = "https://liff.line.me/1234567890-abcdefgh";

  it("returns a valid Flex Message", () => {
    const msg = campaignMessage(text, liffUrl);
    expect(msg.type).toBe("flex");
    expect(msg.contents).toBeDefined();
    expect(msg.contents.type).toBe("bubble");
  });

  it("includes campaign text in the message body", () => {
    const msg = campaignMessage(text, liffUrl);
    const bodyStr = JSON.stringify(msg.contents);
    expect(bodyStr).toContain("春季優惠");
  });

  it("includes booking button with liffUrl", () => {
    const msg = campaignMessage(text, liffUrl);
    const bodyStr = JSON.stringify(msg.contents);
    expect(bodyStr).toContain("立即預約");
    expect(bodyStr).toContain(liffUrl);
  });

  it("truncates altText to 60 characters", () => {
    const longText = "A".repeat(100);
    const msg = campaignMessage(longText, liffUrl);
    expect(msg.altText.length).toBeLessThanOrEqual(60);
  });
});

describe("weeklyReportMessage", () => {
  const report = {
    period: { from: "2026-03-19", to: "2026-03-25" },
    summary: {
      totalBookings: 42,
      completedBookings: 35,
      cancelledBookings: 5,
      noShowBookings: 2,
      revenue: 25000,
      newCustomers: 8,
      returningCustomers: 12,
      avgBookingsPerDay: 6,
      topService: { name: "男性剪髮", count: 20 },
      occupancyRate: 75,
    },
    segmentChanges: {
      newToRegular: 3,
      regularToVip: 1,
      toAtRisk: 2,
      toLapsed: 0,
    },
  };

  it("returns a valid Flex Message", () => {
    const msg = weeklyReportMessage(report);
    expect(msg.type).toBe("flex");
    expect(msg.contents).toBeDefined();
    expect(msg.contents.type).toBe("bubble");
  });

  it("includes period in altText", () => {
    const msg = weeklyReportMessage(report);
    expect(msg.altText).toContain("2026-03-19");
    expect(msg.altText).toContain("2026-03-25");
  });

  it("includes booking stats in the body", () => {
    const msg = weeklyReportMessage(report);
    const bodyStr = JSON.stringify(msg.contents);
    expect(bodyStr).toContain("42");
    expect(bodyStr).toContain("35");
    expect(bodyStr).toContain("25,000");
  });

  it("includes customer segment changes", () => {
    const msg = weeklyReportMessage(report);
    const bodyStr = JSON.stringify(msg.contents);
    expect(bodyStr).toContain("新客→常客");
    expect(bodyStr).toContain("+3");
  });

  it("includes revenue in altText", () => {
    const msg = weeklyReportMessage(report);
    expect(msg.altText).toContain("25,000");
  });

  it("includes top service info", () => {
    const msg = weeklyReportMessage(report);
    const bodyStr = JSON.stringify(msg.contents);
    expect(bodyStr).toContain("男性剪髮");
  });
});

describe("paymentGuideMessage", () => {
  const params = {
    bankName: "台北富邦銀行",
    bankAccountName: "張美麗",
    bankAccountNumber: "1234-5678-9012",
    liffBaseUrl: "https://liff.line.me/1234567890-abcdefgh",
  };

  it("returns a valid Flex Message", () => {
    const msg = paymentGuideMessage(params);
    expect(msg.type).toBe("flex");
    expect(msg.contents).toBeDefined();
    expect(msg.contents.type).toBe("bubble");
  });

  it("includes bank info in the body", () => {
    const msg = paymentGuideMessage(params);
    const bodyStr = JSON.stringify(msg.contents);
    expect(bodyStr).toContain("台北富邦銀行");
    expect(bodyStr).toContain("張美麗");
    expect(bodyStr).toContain("1234-5678-9012");
  });

  it("includes payment steps", () => {
    const msg = paymentGuideMessage(params);
    const bodyStr = JSON.stringify(msg.contents);
    expect(bodyStr).toContain("付款步驟");
    expect(bodyStr).toContain("轉帳");
  });

  it("includes my-bookings link in footer button", () => {
    const msg = paymentGuideMessage(params);
    const bodyStr = JSON.stringify(msg.contents);
    expect(bodyStr).toContain("/my-bookings");
  });

  it("includes quick reply", () => {
    const msg = paymentGuideMessage(params);
    expect(msg.quickReply).toBeDefined();
    expect(msg.quickReply?.items).toHaveLength(5);
  });
});

describe("adminNewBookingMessage", () => {
  const params = {
    displayName: "王小明",
    serviceName: "男性剪髮",
    date: "2026-03-25",
    startTime: "14:00",
    endTime: "15:00",
    price: 500,
  };

  it("returns a valid Flex Message", () => {
    const msg = adminNewBookingMessage(params);
    expect(msg.type).toBe("flex");
    expect(msg.contents).toBeDefined();
    expect(msg.contents.type).toBe("bubble");
  });

  it("includes customer name and service in altText", () => {
    const msg = adminNewBookingMessage(params);
    expect(msg.altText).toContain("王小明");
    expect(msg.altText).toContain("男性剪髮");
  });

  it("includes all booking details in the body", () => {
    const msg = adminNewBookingMessage(params);
    const bodyStr = JSON.stringify(msg.contents);
    expect(bodyStr).toContain("王小明");
    expect(bodyStr).toContain("男性剪髮");
    expect(bodyStr).toContain("2026-03-25");
    expect(bodyStr).toContain("14:00 - 15:00");
    expect(bodyStr).toContain("NT$500");
  });

  it("has the new booking header styling", () => {
    const msg = adminNewBookingMessage(params);
    const bodyStr = JSON.stringify(msg.contents);
    expect(bodyStr).toContain("新預約通知");
  });
});

describe("adminCancellationMessage", () => {
  const params = {
    displayName: "王小明",
    serviceName: "男性剪髮",
    date: "2026-03-25",
    startTime: "14:00",
    isViolation: false,
    cancelledBy: "customer" as const,
  };

  it("returns a valid Flex Message", () => {
    const msg = adminCancellationMessage(params);
    expect(msg.type).toBe("flex");
    expect(msg.contents).toBeDefined();
    expect(msg.contents.type).toBe("bubble");
  });

  it("includes customer name in altText", () => {
    const msg = adminCancellationMessage(params);
    expect(msg.altText).toContain("王小明");
    expect(msg.altText).toContain("2026-03-25");
  });

  it("shows customer cancellation label", () => {
    const msg = adminCancellationMessage(params);
    const bodyStr = JSON.stringify(msg.contents);
    expect(bodyStr).toContain("顧客取消");
  });

  it("shows admin cancellation label when cancelled by admin", () => {
    const msg = adminCancellationMessage({ ...params, cancelledBy: "admin" });
    const bodyStr = JSON.stringify(msg.contents);
    expect(bodyStr).toContain("店家取消");
  });

  it("shows violation warning when isViolation is true", () => {
    const msg = adminCancellationMessage({ ...params, isViolation: true });
    const bodyStr = JSON.stringify(msg.contents);
    expect(bodyStr).toContain("違規");
  });

  it("does not show violation warning when isViolation is false", () => {
    const msg = adminCancellationMessage(params);
    const bodyStr = JSON.stringify(msg.contents);
    expect(bodyStr).not.toContain("違規");
  });

  it("has the cancellation header styling", () => {
    const msg = adminCancellationMessage(params);
    const bodyStr = JSON.stringify(msg.contents);
    expect(bodyStr).toContain("預約取消通知");
  });
});
