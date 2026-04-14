import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";

// Mock web-push BEFORE importing the module under test.
// Factory defines the error class inline so hoisting doesn't bite.
const sendNotification = vi.fn();
const setVapidDetails = vi.fn();

vi.mock("web-push", () => {
  class WebPushError extends Error {
    statusCode: number;
    constructor(statusCode: number, message = "web push error") {
      super(message);
      this.statusCode = statusCode;
      this.name = "WebPushError";
    }
  }
  return {
    default: {
      setVapidDetails: (...args: unknown[]) => setVapidDetails(...args),
      sendNotification: (...args: unknown[]) => sendNotification(...args),
      WebPushError,
    },
    WebPushError,
  };
});

// Construct an error-shaped object with statusCode (web-push v3 uses this shape)
function webPushError(statusCode: number): Error & { statusCode: number } {
  const e = new Error("web push error") as Error & { statusCode: number };
  e.statusCode = statusCode;
  return e;
}

// Prisma mock
const findMany = vi.fn();
const deleteOne = vi.fn();
const updateOne = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    pushSubscription: {
      findMany: (...a: unknown[]) => findMany(...a),
      delete: (...a: unknown[]) => deleteOne(...a),
      update: (...a: unknown[]) => updateOne(...a),
    },
  },
}));

// nowTaipei mock for quiet-hours tests
const nowTaipeiMock = vi.fn();
vi.mock("@/lib/utils/time", async (orig) => {
  const actual = await orig<typeof import("@/lib/utils/time")>();
  return { ...actual, nowTaipei: () => nowTaipeiMock() };
});

import {
  sendWebPushToAdmin,
  isInQuietHours,
  _resetVapidMemo,
} from "@/lib/push/web-push";

const TENANT = "tenant-1";
const SUB = {
  id: "sub-1",
  endpoint: "https://fcm.googleapis.com/fcm/send/AAA",
  p256dh: "p256dh-value",
  auth: "auth-value",
};

beforeEach(() => {
  vi.clearAllMocks();
  _resetVapidMemo();
  // Prisma mocks must return promises; default to resolved for delete/update.
  deleteOne.mockResolvedValue(undefined);
  updateOne.mockResolvedValue(undefined);
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = "BPUB" + "A".repeat(80);
  process.env.VAPID_PRIVATE_KEY = "priv" + "A".repeat(40);
  process.env.VAPID_SUBJECT = "mailto:test@example.com";
  nowTaipeiMock.mockReturnValue(new Date("2026-04-14T14:00:00+08:00")); // 14:00, not quiet
});

afterEach(() => {
  delete process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  delete process.env.VAPID_PRIVATE_KEY;
  delete process.env.VAPID_SUBJECT;
});

describe("isInQuietHours", () => {
  it("19:59 Taipei → not quiet", () => {
    expect(isInQuietHours(new Date("2026-04-14T19:59:00+08:00"))).toBe(false);
  });
  it("20:00 Taipei → quiet", () => {
    expect(isInQuietHours(new Date("2026-04-14T20:00:00+08:00"))).toBe(true);
  });
  it("23:59 Taipei → quiet", () => {
    expect(isInQuietHours(new Date("2026-04-14T23:59:00+08:00"))).toBe(true);
  });
  it("00:00 Taipei → quiet", () => {
    expect(isInQuietHours(new Date("2026-04-14T00:00:00+08:00"))).toBe(true);
  });
  it("07:59 Taipei → quiet", () => {
    expect(isInQuietHours(new Date("2026-04-14T07:59:00+08:00"))).toBe(true);
  });
  it("08:00 Taipei → not quiet", () => {
    expect(isInQuietHours(new Date("2026-04-14T08:00:00+08:00"))).toBe(false);
  });
});

describe("sendWebPushToAdmin", () => {
  it("no subscriptions → returns { sent: 0, failed: 0 }", async () => {
    findMany.mockResolvedValue([]);
    const r = await sendWebPushToAdmin(TENANT, { title: "t", body: "b" });
    expect(r).toEqual({ sent: 0, failed: 0 });
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it("one subscription, success → sent: 1", async () => {
    findMany.mockResolvedValue([SUB]);
    sendNotification.mockResolvedValue(undefined);
    const r = await sendWebPushToAdmin(TENANT, { title: "t", body: "b" });
    expect(r).toEqual({ sent: 1, failed: 0 });
  });

  it("410 Gone → deletes subscription", async () => {
    findMany.mockResolvedValue([SUB]);
    sendNotification.mockRejectedValue(webPushError(410));
    const r = await sendWebPushToAdmin(TENANT, { title: "t", body: "b" });
    expect(r).toEqual({ sent: 0, failed: 1 });
    expect(deleteOne).toHaveBeenCalledWith({ where: { id: "sub-1" } });
  });

  it("404 → deletes subscription", async () => {
    findMany.mockResolvedValue([SUB]);
    sendNotification.mockRejectedValue(webPushError(404));
    await sendWebPushToAdmin(TENANT, { title: "t", body: "b" });
    expect(deleteOne).toHaveBeenCalled();
    expect(updateOne).not.toHaveBeenCalled();
  });

  it("401 VAPID mismatch → deletes subscription", async () => {
    findMany.mockResolvedValue([SUB]);
    sendNotification.mockRejectedValue(webPushError(401));
    await sendWebPushToAdmin(TENANT, { title: "t", body: "b" });
    expect(deleteOne).toHaveBeenCalled();
  });

  it("429 rate limit → keeps subscription, bumps failureCount", async () => {
    findMany.mockResolvedValue([SUB]);
    sendNotification.mockRejectedValue(webPushError(429));
    await sendWebPushToAdmin(TENANT, { title: "t", body: "b" });
    expect(deleteOne).not.toHaveBeenCalled();
    expect(updateOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "sub-1" },
        data: expect.objectContaining({
          failureCount: { increment: 1 },
        }),
      })
    );
  });

  it("500 transient → keeps subscription, bumps failureCount", async () => {
    findMany.mockResolvedValue([SUB]);
    sendNotification.mockRejectedValue(webPushError(500));
    await sendWebPushToAdmin(TENANT, { title: "t", body: "b" });
    expect(deleteOne).not.toHaveBeenCalled();
    expect(updateOne).toHaveBeenCalled();
  });

  it("opts.respectQuietHours=true at 20:30 → skips send", async () => {
    nowTaipeiMock.mockReturnValue(new Date("2026-04-14T20:30:00+08:00"));
    findMany.mockResolvedValue([SUB]);
    const r = await sendWebPushToAdmin(
      TENANT,
      { title: "t", body: "b" },
      { respectQuietHours: true }
    );
    expect(r).toEqual({ sent: 0, failed: 0 });
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it("default (respectQuietHours not set) at 20:30 → still sends", async () => {
    nowTaipeiMock.mockReturnValue(new Date("2026-04-14T20:30:00+08:00"));
    findMany.mockResolvedValue([SUB]);
    sendNotification.mockResolvedValue(undefined);
    const r = await sendWebPushToAdmin(TENANT, { title: "t", body: "b" });
    expect(r).toEqual({ sent: 1, failed: 0 });
  });

  it("missing VAPID env → noop, no throw", async () => {
    delete process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    _resetVapidMemo();
    const r = await sendWebPushToAdmin(TENANT, { title: "t", body: "b" });
    expect(r).toEqual({ sent: 0, failed: 0 });
    expect(findMany).not.toHaveBeenCalled();
  });

  it("multiple subs, mixed outcomes → partial counts", async () => {
    findMany.mockResolvedValue([
      { ...SUB, id: "sub-1" },
      { ...SUB, id: "sub-2", endpoint: "https://fcm.googleapis.com/fcm/send/BBB" },
      { ...SUB, id: "sub-3", endpoint: "https://fcm.googleapis.com/fcm/send/CCC" },
    ]);
    sendNotification
      .mockResolvedValueOnce(undefined) // sub-1 ok
      .mockRejectedValueOnce(webPushError(410)) // sub-2 dead
      .mockRejectedValueOnce(webPushError(500)); // sub-3 transient
    const r = await sendWebPushToAdmin(TENANT, { title: "t", body: "b" });
    expect(r).toEqual({ sent: 1, failed: 2 });
  });
});
