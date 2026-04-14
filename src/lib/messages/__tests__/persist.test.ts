import { describe, it, expect, vi, beforeEach } from "vitest";
import type { MessageEvent } from "@line/bot-sdk";

// Mock prisma
const createMessage = vi.fn();
const findUniqueUser = vi.fn();
const findUniqueUserById = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    message: { create: (args: unknown) => createMessage(args) },
    user: {
      findUnique: (args: { where: { tenantId_lineUserId?: unknown; id?: string } }) =>
        args.where.id ? findUniqueUserById(args) : findUniqueUser(args),
    },
  },
}));

// Mock web-push
const mockSendPush = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/push/web-push", () => ({
  sendWebPushToAdmin: (...args: unknown[]) => mockSendPush(...args),
}));

import { persistInboundMessage, persistOutboundMessage } from "../persist";

// Helper to flush microtasks the fire-and-forget IIFE schedules
const flush = () => new Promise((r) => setImmediate(r));

function makeMessageEvent(overrides: Partial<MessageEvent> = {}): MessageEvent {
  return {
    type: "message",
    mode: "active",
    timestamp: Date.now(),
    source: { type: "user", userId: "U_customer_1" },
    webhookEventId: "evt-1",
    deliveryContext: { isRedelivery: false },
    replyToken: "reply-token",
    message: {
      id: "line-msg-1",
      type: "text",
      text: "你好",
    },
    ...overrides,
  } as MessageEvent;
}

describe("persistInboundMessage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findUniqueUser.mockResolvedValue({ id: "user-1" });
    findUniqueUserById.mockResolvedValue({ displayName: "王小明" });
    createMessage.mockResolvedValue({ id: "msg-created" });
  });

  it("writes an INBOUND row for a text message", async () => {
    persistInboundMessage(makeMessageEvent(), "tenant-1");
    await flush();
    expect(createMessage).toHaveBeenCalledOnce();
    const arg = createMessage.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(arg.data.direction).toBe("INBOUND");
    expect(arg.data.type).toBe("TEXT");
    expect(arg.data.content).toBe("你好");
    expect(arg.data.lineMessageId).toBe("line-msg-1");
    expect(arg.data.tenantId).toBe("tenant-1");
  });

  it("writes STICKER type for sticker messages", async () => {
    persistInboundMessage(
      makeMessageEvent({
        message: { id: "m1", type: "sticker", packageId: "1", stickerId: "2" } as MessageEvent["message"],
      }),
      "tenant-1",
    );
    await flush();
    const arg = createMessage.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(arg.data.type).toBe("STICKER");
    expect(arg.data.content).toBe("[貼圖]");
  });

  it("swallows P2002 duplicate errors silently (LINE replay dedup)", async () => {
    createMessage.mockRejectedValueOnce({ code: "P2002" });
    expect(() => persistInboundMessage(makeMessageEvent(), "tenant-1")).not.toThrow();
    await flush();
    expect(createMessage).toHaveBeenCalledOnce();
    // No throw, no uncaught rejection
  });

  it("does not throw when DB write fails", async () => {
    createMessage.mockRejectedValueOnce(new Error("DB down"));
    expect(() => persistInboundMessage(makeMessageEvent(), "tenant-1")).not.toThrow();
    await flush();
  });

  it("skips when source has no userId", async () => {
    persistInboundMessage(
      makeMessageEvent({ source: { type: "group", groupId: "g1" } as MessageEvent["source"] }),
      "tenant-1",
    );
    await flush();
    expect(createMessage).not.toHaveBeenCalled();
  });

  it("triggers Web Push after successful write", async () => {
    persistInboundMessage(makeMessageEvent(), "tenant-1");
    await flush();
    await flush();
    expect(mockSendPush).toHaveBeenCalledOnce();
    const [tenantId, payload] = mockSendPush.mock.calls[0];
    expect(tenantId).toBe("tenant-1");
    expect(payload.title).toContain("王小明");
    expect(payload.url).toBe("/messages/U_customer_1");
  });
});

describe("persistOutboundMessage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findUniqueUser.mockResolvedValue({ id: "user-1" });
    createMessage.mockResolvedValue({ id: "out-1" });
  });

  it("writes an OUTBOUND text message", async () => {
    persistOutboundMessage({
      tenantId: "tenant-1",
      lineUserId: "U_customer_1",
      message: { type: "text", text: "回覆內容" },
    });
    await flush();
    const arg = createMessage.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(arg.data.direction).toBe("OUTBOUND");
    expect(arg.data.type).toBe("TEXT");
    expect(arg.data.content).toBe("回覆內容");
    expect(arg.data.isRead).toBe(true);
  });

  it("records flex messages with altText content", async () => {
    persistOutboundMessage({
      tenantId: "tenant-1",
      lineUserId: "U1",
      message: {
        type: "flex",
        altText: "歡迎訊息",
        contents: { type: "bubble", body: { type: "box", layout: "vertical", contents: [] } },
      },
    });
    await flush();
    const arg = createMessage.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(arg.data.type).toBe("OTHER");
    expect(arg.data.content).toBe("歡迎訊息");
  });

  it("does not throw on P2002 (clientMessageId replay)", async () => {
    createMessage.mockRejectedValueOnce({ code: "P2002" });
    expect(() =>
      persistOutboundMessage({
        tenantId: "t",
        lineUserId: "U1",
        message: { type: "text", text: "hi" },
        clientMessageId: "dup-uuid",
      }),
    ).not.toThrow();
    await flush();
  });
});
