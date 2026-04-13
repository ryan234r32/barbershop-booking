import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock prisma
vi.mock("@/lib/prisma", () => ({
  prisma: {
    notification: {
      createMany: vi.fn().mockResolvedValue({ count: 2 }),
      create: vi.fn().mockResolvedValue({ id: "test-notification-id" }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
  },
}));

import { scheduleReminders, scheduleThankYou, cancelBookingNotifications } from "../scheduler";
import { prisma } from "@/lib/prisma";

describe("scheduleReminders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates 24h and 2h reminders for future booking", async () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 3);

    await scheduleReminders({
      tenantId: "tenant-1",
      bookingId: "booking-1",
      lineUserId: "user-1",
      bookingDate: futureDate,
      startTime: "14:00",
    });

    // Should create 2 individual notifications (24h + 2h)
    const createCalls = vi.mocked(prisma.notification.create).mock.calls;
    expect(createCalls.length).toBe(2);

    const types = createCalls.map((call) => (call[0] as { data: { type: string } }).data.type);
    expect(types).toContain("REMINDER_24H");
    expect(types).toContain("REMINDER_2H");
  });
});

describe("scheduleThankYou", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a THANK_YOU notification scheduled 30 min from now", async () => {
    const before = Date.now();

    await scheduleThankYou({
      tenantId: "tenant-1",
      bookingId: "booking-1",
      lineUserId: "user-1",
    });

    expect(prisma.notification.create).toHaveBeenCalledOnce();
    const callArg = vi.mocked(prisma.notification.create).mock.calls[0][0] as {
      data: { type: string; status: string; scheduledAt: string };
    };
    expect(callArg.data.type).toBe("THANK_YOU");
    expect(callArg.data.status).toBe("PENDING");

    const scheduledTime = new Date(callArg.data.scheduledAt).getTime();
    const expectedMin = before + 29 * 60 * 1000;
    const expectedMax = before + 31 * 60 * 1000;
    expect(scheduledTime).toBeGreaterThan(expectedMin);
    expect(scheduledTime).toBeLessThan(expectedMax);
  });
});

describe("cancelBookingNotifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("cancels all pending notifications for a booking", async () => {
    await cancelBookingNotifications("booking-1");

    expect(prisma.notification.updateMany).toHaveBeenCalledWith({
      where: { bookingId: "booking-1", status: "PENDING" },
      data: { status: "CANCELLED" },
    });
  });
});
