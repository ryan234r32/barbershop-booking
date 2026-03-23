import { describe, it, expect } from "vitest";
import {
  bookingConfirmationMessage,
  reminderMessage,
  cancellationMessage,
  welcomeMessage,
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
