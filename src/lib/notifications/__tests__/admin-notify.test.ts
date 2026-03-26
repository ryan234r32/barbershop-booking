import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock LINE client
const mockPushMessage = vi.fn().mockResolvedValue({});
vi.mock("@/lib/line/client", () => ({
  getLineClient: () => ({
    pushMessage: mockPushMessage,
  }),
}));

import { notifyAdminNewBooking, notifyAdminCancellation } from "../admin-notify";

describe("notifyAdminNewBooking", () => {
  const bookingParams = {
    displayName: "王小明",
    serviceName: "男性剪髮",
    date: "2026-03-25",
    startTime: "14:00",
    endTime: "15:00",
    price: 500,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    delete process.env.ADMIN_LINE_USER_ID;
  });

  it("skips when ADMIN_LINE_USER_ID is not set", async () => {
    delete process.env.ADMIN_LINE_USER_ID;
    await notifyAdminNewBooking(bookingParams);
    expect(mockPushMessage).not.toHaveBeenCalled();
  });

  it("sends LINE push when ADMIN_LINE_USER_ID is set", async () => {
    process.env.ADMIN_LINE_USER_ID = "U1234567890abcdef";
    await notifyAdminNewBooking(bookingParams);

    expect(mockPushMessage).toHaveBeenCalledOnce();
    expect(mockPushMessage).toHaveBeenCalledWith(
      "U1234567890abcdef",
      expect.objectContaining({ type: "flex" })
    );
  });

  it("passes correct booking info to the message", async () => {
    process.env.ADMIN_LINE_USER_ID = "U1234567890abcdef";
    await notifyAdminNewBooking(bookingParams);

    const message = mockPushMessage.mock.calls[0][1];
    expect(message.altText).toContain("王小明");
    expect(message.altText).toContain("男性剪髮");
  });
});

describe("notifyAdminCancellation", () => {
  const cancelParams = {
    displayName: "王小明",
    serviceName: "男性剪髮",
    date: "2026-03-25",
    startTime: "14:00",
    isViolation: false,
    cancelledBy: "customer" as const,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    delete process.env.ADMIN_LINE_USER_ID;
  });

  it("skips when ADMIN_LINE_USER_ID is not set", async () => {
    delete process.env.ADMIN_LINE_USER_ID;
    await notifyAdminCancellation(cancelParams);
    expect(mockPushMessage).not.toHaveBeenCalled();
  });

  it("sends LINE push when ADMIN_LINE_USER_ID is set", async () => {
    process.env.ADMIN_LINE_USER_ID = "U1234567890abcdef";
    await notifyAdminCancellation(cancelParams);

    expect(mockPushMessage).toHaveBeenCalledOnce();
    expect(mockPushMessage).toHaveBeenCalledWith(
      "U1234567890abcdef",
      expect.objectContaining({ type: "flex" })
    );
  });

  it("passes correct cancellation info to the message", async () => {
    process.env.ADMIN_LINE_USER_ID = "U1234567890abcdef";
    await notifyAdminCancellation(cancelParams);

    const message = mockPushMessage.mock.calls[0][1];
    expect(message.altText).toContain("王小明");
    expect(message.altText).toContain("2026-03-25");
  });

  it("handles violation cancellation", async () => {
    process.env.ADMIN_LINE_USER_ID = "U1234567890abcdef";
    await notifyAdminCancellation({ ...cancelParams, isViolation: true });

    const message = mockPushMessage.mock.calls[0][1];
    const bodyStr = JSON.stringify(message.contents);
    expect(bodyStr).toContain("違規");
  });

  it("handles admin-initiated cancellation", async () => {
    process.env.ADMIN_LINE_USER_ID = "U1234567890abcdef";
    await notifyAdminCancellation({ ...cancelParams, cancelledBy: "admin" });

    const message = mockPushMessage.mock.calls[0][1];
    const bodyStr = JSON.stringify(message.contents);
    expect(bodyStr).toContain("店家取消");
  });
});
