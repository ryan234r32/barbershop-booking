import { describe, it, expect } from "vitest";
import {
  bookingConfirmationMessage,
  reminderMessage,
  cancellationMessage,
  welcomeMessage,
  campaignMessage,
  weeklyReportMessage,
  paymentGuideMessage,
  transferReportedMessage,
  paymentReceivedMessage,
  adminNewBookingMessage,
  adminCancellationMessage,
  serviceInquiryFlexMessage,
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
  it("includes shop name (uppercased in header)", () => {
    const msg = welcomeMessage({ shopName: "1008 Hair Studio" });
    expect(msg.altText).toContain("1008 Hair Studio");
    const bodyStr = JSON.stringify(msg.contents);
    expect(bodyStr).toContain("1008 HAIR STUDIO");
  });

  it("includes booking button when liffUrl is provided", () => {
    const msg = welcomeMessage({
      shopName: "1008 Hair Studio",
      liffUrl: "https://liff.line.me/1234567890-abcdefgh",
    });
    const bodyStr = JSON.stringify(msg.contents);
    expect(bodyStr).toContain("立即預約");
    expect(bodyStr).toContain("https://liff.line.me/1234567890-abcdefgh");
  });

  it("secondary button uses message action with '服務' keyword", () => {
    const msg = welcomeMessage({
      shopName: "1008 Hair Studio",
      liffUrl: "https://liff.line.me/test",
    });
    const bodyStr = JSON.stringify(msg.contents);
    expect(bodyStr).toContain("查看服務與價格");
    // Message action triggers keyword-reply flow instead of opening LIFF
    expect(bodyStr).toMatch(/"type":\s*"message".*"text":\s*"服務"/);
  });

  it("omits footer when liffUrl is not provided", () => {
    const msg = welcomeMessage({ shopName: "1008 Hair Studio" });
    const content = msg.contents as Record<string, unknown>;
    expect(content.footer).toBeUndefined();
  });

  it("includes phone row when phone is provided", () => {
    const msg = welcomeMessage({ shopName: "Test", phone: "02-2396-2306" });
    const bodyStr = JSON.stringify(msg.contents);
    expect(bodyStr).toContain("02-2396-2306");
    expect(bodyStr).toContain("電話");
  });

  it("omits phone row when phone is not provided", () => {
    const msg = welcomeMessage({ shopName: "Test" });
    const bodyStr = JSON.stringify(msg.contents);
    expect(bodyStr).not.toContain("電話");
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
    // Account number is now formatted with spaces every 4 digits (1234 5678 9012)
    expect(bodyStr).toContain("1234 5678 9012");
  });

  it("emphasizes account number visually (xl size, bold, centered)", () => {
    const msg = paymentGuideMessage(params);
    const bodyStr = JSON.stringify(msg.contents);
    // The account-number text element should carry size:xl and weight:bold
    expect(bodyStr).toMatch(/"text":"1234 5678 9012"[^}]*"size":"xl"/);
    expect(bodyStr).toMatch(/"text":"1234 5678 9012"[^}]*"weight":"bold"/);
  });

  it("guides customer to confirm-after-transfer (when amount provided)", () => {
    const msg = paymentGuideMessage({ ...params, amount: 800 });
    const bodyStr = JSON.stringify(msg.contents);
    expect(bodyStr).toContain("完成轉帳後");
    expect(bodyStr).toContain("確定完成匯款");
  });

  it("renders 匯款資訊 header (not 付款資訊)", () => {
    const msg = paymentGuideMessage(params);
    const bodyStr = JSON.stringify(msg.contents);
    expect(bodyStr).toContain("匯款資訊");
  });

  it("hides amount block when amount is omitted", () => {
    const msg = paymentGuideMessage(params);
    const bodyStr = JSON.stringify(msg.contents);
    expect(bodyStr).not.toContain("本次金額");
  });

  it("shows amount block with service name when amount is provided", () => {
    const msg = paymentGuideMessage({ ...params, amount: 800, serviceName: "男性剪髮" });
    const bodyStr = JSON.stringify(msg.contents);
    expect(bodyStr).toContain("本次金額");
    expect(bodyStr).toContain("NT$ 800");
    expect(bodyStr).toContain("男性剪髮");
  });

  it("shows booking context line (service · date · time range) when booking info provided", () => {
    const msg = paymentGuideMessage({
      ...params,
      amount: 800,
      serviceName: "男性剪髮",
      bookingDate: "2026-04-29",
      bookingStartTime: "14:00",
      bookingEndTime: "15:00",
    });
    const bodyStr = JSON.stringify(msg.contents);
    // Context joins service + date + time with " · "
    expect(bodyStr).toContain("男性剪髮 · ");
    expect(bodyStr).toContain("14:00–15:00");
  });

  it("never includes 複製金額 button (removed 2026-04-27 — redundant)", () => {
    const noAmount = paymentGuideMessage(params);
    const withAmount = paymentGuideMessage({ ...params, amount: 800 });
    expect(JSON.stringify(noAmount.contents)).not.toContain("複製金額");
    expect(JSON.stringify(withAmount.contents)).not.toContain("複製金額");
  });

  it("footer no longer routes to my-bookings (simplified flow — type 5 digits in chat)", () => {
    const msg = paymentGuideMessage(params);
    const bodyStr = JSON.stringify(msg.contents);
    expect(bodyStr).not.toContain("/my-bookings");
    expect(bodyStr).not.toContain("前往我的預約");
    expect(bodyStr).toContain("點此複製帳號");
  });

  it("uses clipboardAction with cleaned account number (strips dashes/spaces)", () => {
    const msg = paymentGuideMessage(params);
    const bodyStr = JSON.stringify(msg.contents);
    // Original account "1234-5678-9012" should be cleaned to "123456789012" for clipboard
    expect(bodyStr).toContain('"type":"clipboard"');
    expect(bodyStr).toContain('"clipboardText":"123456789012"');
  });

  it("includes a 確定完成匯款 button that triggers the 5-digit prompt (when hasAmount)", () => {
    const msg = paymentGuideMessage({ ...params, amount: 800 });
    const bodyStr = JSON.stringify(msg.contents);
    expect(bodyStr).toContain("確定完成匯款");
    expect(bodyStr).toContain('"text":"確定完成匯款"');
  });

  // ─── 2026-04-29 bug fix: avoid stale-amount + cross-booking 5-digit drift ───
  it("HIDES 確定完成匯款 button when no amount (no eligible booking)", () => {
    // When customer's bookings are all already paid, we must NOT show the
    // confirm-done button. Otherwise clicking → bot prompts 5-digit → 5-digit
    // submission says "查無待回報" → confused customer.
    const msg = paymentGuideMessage(params); // no amount
    const bodyStr = JSON.stringify(msg.contents);
    expect(bodyStr).not.toContain("確定完成匯款");
    // But copy-account button still there (customer may want it for other reason)
    expect(bodyStr).toContain("點此複製帳號");
  });

  it("shows 目前無待付款預約 note when amount omitted", () => {
    const msg = paymentGuideMessage(params); // no amount
    const bodyStr = JSON.stringify(msg.contents);
    expect(bodyStr).toContain("目前無待付款預約");
  });

});

describe("transferReportedMessage", () => {
  const baseParams = {
    serviceName: "男性剪髮",
    date: "2026-04-28",
    startTime: "14:00",
    endTime: "15:00",
    price: 800,
    transferLastFive: "12345",
  };

  it("includes booking details + last-5", () => {
    const msg = transferReportedMessage(baseParams);
    const bodyStr = JSON.stringify(msg.contents);
    expect(bodyStr).toContain("男性剪髮");
    expect(bodyStr).toContain("NT$ 800");
    expect(bodyStr).toContain("12345");
  });

  it("clearly says 已收到回報 + 對帳中 (NOT 已收款)", () => {
    const msg = transferReportedMessage(baseParams);
    const bodyStr = JSON.stringify(msg.contents);
    expect(bodyStr).toContain("已收到回報");
    expect(bodyStr).toContain("對帳中");
    // Must NOT use 已收款 wording — that's reserved for paymentReceivedMessage (post-admin-confirm)
    expect(bodyStr).not.toContain("已收款");
    expect(bodyStr).not.toContain("已確認收款");
  });

  it("v4: removes Google review CTA from this step (premature; moved to paymentReceivedMessage)", () => {
    const msg = transferReportedMessage({
      ...baseParams,
      googleReviewUrl: "https://g.page/r/abc/review",
    });
    const bodyStr = JSON.stringify(msg.contents);
    expect(bodyStr).not.toContain("五星好評");
  });

  it("v4: removes VIP tagline from this step (moved to paymentReceivedMessage)", () => {
    const vip = transferReportedMessage({ ...baseParams, isVip: true });
    expect(JSON.stringify(vip.contents)).not.toContain("VIP");
  });

  it("does NOT promise a reconciliation ETA (老闆 may settle in evening)", () => {
    const msg = transferReportedMessage(baseParams);
    const bodyStr = JSON.stringify(msg.contents);
    expect(bodyStr).not.toMatch(/\d+\s*分鐘/);
    expect(bodyStr).toContain("會再通知您");
  });
});

describe("paymentReceivedMessage", () => {
  const baseParams = {
    serviceName: "男性剪髮",
    date: "2026-04-28",
    amount: 800,
  };

  it("includes booking detail (compact: only 服務 + 金額, no 末五碼)", () => {
    const msg = paymentReceivedMessage(baseParams);
    const bodyStr = JSON.stringify(msg.contents);
    expect(bodyStr).toContain("男性剪髮");
    expect(bodyStr).toContain("NT$ 800");
  });

  it("clearly says 已確認收款 + 對帳完成 (distinct from transferReportedMessage)", () => {
    const msg = paymentReceivedMessage(baseParams);
    const bodyStr = JSON.stringify(msg.contents);
    expect(bodyStr).toContain("已確認收款");
    expect(bodyStr).toContain("對帳完成");
  });

  it("VIP tagline differs from regular tagline", () => {
    const regular = paymentReceivedMessage(baseParams);
    const vip = paymentReceivedMessage({ ...baseParams, isVip: true });
    expect(JSON.stringify(regular.contents)).not.toContain("VIP");
    expect(JSON.stringify(vip.contents)).toContain("VIP");
  });

  it("includes Google review CTA when googleReviewUrl provided", () => {
    const msg = paymentReceivedMessage({
      ...baseParams,
      googleReviewUrl: "https://maps.app.goo.gl/abc",
    });
    const bodyStr = JSON.stringify(msg.contents);
    expect(bodyStr).toContain("五星好評");
    expect(bodyStr).toContain("maps.app.goo.gl/abc");
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

describe("serviceInquiryFlexMessage", () => {
  const baseParams = {
    liffBaseUrl: "https://liff.line.me/test",
    shopName: "測試店",
  };

  it("perm: title says 想燙嗎？", () => {
    const msg = serviceInquiryFlexMessage({ ...baseParams, serviceType: "perm" });
    const bodyStr = JSON.stringify(msg.contents);
    expect(bodyStr).toContain("想燙嗎？");
    expect(msg.altText).toContain("燙");
  });

  it("color: title says 想染嗎？", () => {
    const msg = serviceInquiryFlexMessage({ ...baseParams, serviceType: "color" });
    const bodyStr = JSON.stringify(msg.contents);
    expect(bodyStr).toContain("想染嗎？");
    expect(msg.altText).toContain("染");
  });

  it("asks for the 3 things admin needs (last service date / current photo / target style)", () => {
    const msg = serviceInquiryFlexMessage({ ...baseParams, serviceType: "perm" });
    const bodyStr = JSON.stringify(msg.contents);
    expect(bodyStr).toContain("A.");
    expect(bodyStr).toContain("B.");
    expect(bodyStr).toContain("C.");
    expect(bodyStr).toContain("照片");
    expect(bodyStr).toContain("造型");
  });

  it("includes shop name in subtitle", () => {
    const msg = serviceInquiryFlexMessage({ ...baseParams, serviceType: "color" });
    const bodyStr = JSON.stringify(msg.contents);
    expect(bodyStr).toContain("測試店");
  });

  it("CTA button links to LIFF", () => {
    const msg = serviceInquiryFlexMessage({ ...baseParams, serviceType: "perm" });
    const bodyStr = JSON.stringify(msg.contents);
    expect(bodyStr).toContain("https://liff.line.me/test");
  });
});
