import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Mock web-push sender BEFORE importing admin-notify so the mock is the module
const sendWebPushToAdmin = vi.fn();
vi.mock("@/lib/push/web-push", () => ({
  sendWebPushToAdmin: (...a: unknown[]) => sendWebPushToAdmin(...a),
}));

// Mock LINE client
const mockPushMessage = vi.fn().mockResolvedValue({});
vi.mock("@/lib/line/client", () => ({
  getLineClient: () => ({ pushMessage: mockPushMessage }),
}));

import {
  notifyAdminNewBooking,
  notifyAdminCancellation,
} from "@/lib/notifications/admin-notify";

const BOOKING = {
  tenantId: "tenant-1",
  displayName: "王小明",
  serviceName: "男性剪髮",
  date: "2026-03-25",
  startTime: "14:00",
  endTime: "15:00",
  price: 500,
};

const CANCEL = {
  tenantId: "tenant-1",
  displayName: "王小明",
  serviceName: "男性剪髮",
  date: "2026-03-25",
  startTime: "14:00",
  isViolation: false,
  cancelledBy: "customer" as const,
};

beforeEach(() => {
  vi.clearAllMocks();
  // default: web-push reaches 0 devices (simulates "no admin has subscribed yet")
  sendWebPushToAdmin.mockResolvedValue({ sent: 0, failed: 0 });
});

afterEach(() => {
  delete process.env.ADMIN_LINE_USER_ID;
});

// ─── notifyAdminNewBooking ────────────────────────────────────────────

describe("notifyAdminNewBooking — dual-channel mutex", () => {
  it("REGRESSION: LINE set + 0 web subs → LINE fires (backward-compat)", async () => {
    process.env.ADMIN_LINE_USER_ID = "U1234567890abcdef";
    await notifyAdminNewBooking(BOOKING);
    expect(mockPushMessage).toHaveBeenCalledOnce();
    expect(mockPushMessage).toHaveBeenCalledWith(
      "U1234567890abcdef",
      expect.objectContaining({ type: "flex" })
    );
  });

  it("REGRESSION: LINE set + 1 web sub delivered → LINE SKIPPED", async () => {
    process.env.ADMIN_LINE_USER_ID = "U1234567890abcdef";
    sendWebPushToAdmin.mockResolvedValue({ sent: 1, failed: 0 });
    await notifyAdminNewBooking(BOOKING);
    expect(sendWebPushToAdmin).toHaveBeenCalledOnce();
    expect(mockPushMessage).not.toHaveBeenCalled();
  });

  it("No LINE env + 1 web sub → only web fires", async () => {
    sendWebPushToAdmin.mockResolvedValue({ sent: 1, failed: 0 });
    await notifyAdminNewBooking(BOOKING);
    expect(sendWebPushToAdmin).toHaveBeenCalledOnce();
    expect(mockPushMessage).not.toHaveBeenCalled();
  });

  it("No LINE env + 0 web subs → no channel fires (warn path)", async () => {
    await notifyAdminNewBooking(BOOKING);
    expect(mockPushMessage).not.toHaveBeenCalled();
  });

  it("Web Push throws → LINE fallback fires", async () => {
    process.env.ADMIN_LINE_USER_ID = "U1234567890abcdef";
    sendWebPushToAdmin.mockRejectedValue(new Error("boom"));
    await notifyAdminNewBooking(BOOKING);
    expect(mockPushMessage).toHaveBeenCalledOnce();
  });

  it("No tenantId → skip web-push entirely, try LINE", async () => {
    process.env.ADMIN_LINE_USER_ID = "U1234567890abcdef";
    await notifyAdminNewBooking({ ...BOOKING, tenantId: undefined });
    expect(sendWebPushToAdmin).not.toHaveBeenCalled();
    expect(mockPushMessage).toHaveBeenCalledOnce();
  });

  it("Sends expected payload to web-push", async () => {
    sendWebPushToAdmin.mockResolvedValue({ sent: 1, failed: 0 });
    await notifyAdminNewBooking(BOOKING);
    expect(sendWebPushToAdmin).toHaveBeenCalledWith(
      "tenant-1",
      expect.objectContaining({
        title: "新預約",
        url: "/calendar",
        tag: expect.stringContaining("booking-new-"),
      })
    );
  });
});

// ─── notifyAdminCancellation ──────────────────────────────────────────

describe("notifyAdminCancellation — dual-channel mutex", () => {
  it("REGRESSION: LINE set + 0 web subs → LINE fires", async () => {
    process.env.ADMIN_LINE_USER_ID = "U1234567890abcdef";
    await notifyAdminCancellation(CANCEL);
    expect(mockPushMessage).toHaveBeenCalledOnce();
  });

  it("Web sent → LINE skipped", async () => {
    process.env.ADMIN_LINE_USER_ID = "U1234567890abcdef";
    sendWebPushToAdmin.mockResolvedValue({ sent: 1, failed: 0 });
    await notifyAdminCancellation(CANCEL);
    expect(mockPushMessage).not.toHaveBeenCalled();
  });

  it("violation flag surfaces in Web Push title", async () => {
    sendWebPushToAdmin.mockResolvedValue({ sent: 1, failed: 0 });
    await notifyAdminCancellation({ ...CANCEL, isViolation: true });
    expect(sendWebPushToAdmin).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ title: expect.stringContaining("違規") })
    );
  });

  it("admin-initiated cancellation surfaces in title", async () => {
    sendWebPushToAdmin.mockResolvedValue({ sent: 1, failed: 0 });
    await notifyAdminCancellation({ ...CANCEL, cancelledBy: "admin" });
    expect(sendWebPushToAdmin).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ title: expect.stringContaining("店家取消") })
    );
  });
});
