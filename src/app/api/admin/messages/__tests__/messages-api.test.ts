import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock prisma
const queryRaw = vi.fn();
const findFirstUser = vi.fn();
const findManyMessage = vi.fn();
const findFirstMessage = vi.fn();
const createMessage = vi.fn();
const updateManyMessage = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRaw: (...args: unknown[]) => queryRaw(...args),
    user: {
      findFirst: (args: unknown) => findFirstUser(args),
    },
    message: {
      findMany: (args: unknown) => findManyMessage(args),
      findFirst: (args: unknown) => findFirstMessage(args),
      create: (args: unknown) => createMessage(args),
      updateMany: (args: unknown) => updateManyMessage(args),
    },
  },
}));

// Mock auth
const mockAdmin = vi.fn();
vi.mock("@/lib/auth/jwt", () => ({
  getAdminFromCookie: (req: NextRequest) => mockAdmin(req),
}));

// Mock LINE client
const mockPushMessage = vi.fn();
vi.mock("@/lib/line/client", () => ({
  getLineClient: () => ({ pushMessage: mockPushMessage }),
}));

import { GET as listHandler } from "../route";
import { GET as detailHandler } from "../[lineUserId]/route";
import { POST as replyHandler } from "../[lineUserId]/reply/route";
import { PATCH as readHandler } from "../[lineUserId]/read/route";

const ADMIN_T1 = { adminId: "a1", tenantId: "t1", role: "OWNER" };

function req(url: string, init?: { method?: string; body?: string }) {
  return new NextRequest(url, init);
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("GET /api/admin/messages (list)", () => {
  it("returns 401 when not authenticated", async () => {
    mockAdmin.mockResolvedValueOnce(null);
    const res = await listHandler(req("http://x/api/admin/messages"));
    expect(res.status).toBe(401);
  });

  it("returns conversations with totalUnread", async () => {
    mockAdmin.mockResolvedValueOnce(ADMIN_T1);
    queryRaw.mockResolvedValueOnce([
      {
        line_user_id: "U1",
        user_id: "user-1",
        display_name: "Alice",
        picture_url: null,
        last_content: "hi",
        last_direction: "INBOUND",
        last_created_at: new Date("2026-04-14T10:00:00Z"),
        unread_count: 2,
      },
      {
        line_user_id: "U2",
        user_id: null,
        display_name: null,
        picture_url: null,
        last_content: "[貼圖]",
        last_direction: "INBOUND",
        last_created_at: new Date("2026-04-14T09:00:00Z"),
        unread_count: 1,
      },
    ]);
    const res = await listHandler(req("http://x/api/admin/messages"));
    const body = await res.json();
    expect(body.conversations).toHaveLength(2);
    expect(body.totalUnread).toBe(3);
    // Sorted: U1 (newer) first
    expect(body.conversations[0].lineUserId).toBe("U1");
  });

  it("returns empty list gracefully", async () => {
    mockAdmin.mockResolvedValueOnce(ADMIN_T1);
    queryRaw.mockResolvedValueOnce([]);
    const res = await listHandler(req("http://x/api/admin/messages"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.conversations).toEqual([]);
    expect(body.totalUnread).toBe(0);
  });

  it("scopes queries to admin.tenantId (CRITICAL — cross-tenant isolation)", async () => {
    mockAdmin.mockResolvedValueOnce(ADMIN_T1);
    queryRaw.mockResolvedValueOnce([]);
    await listHandler(req("http://x/api/admin/messages"));
    // The raw query interpolates tenantId via Prisma.sql template.
    // Prisma.sql passes tenantId as a parameter — we can't easily inspect it,
    // but we can at least confirm $queryRaw was called.
    expect(queryRaw).toHaveBeenCalledOnce();
    // And the values array contains tenantId
    const call = queryRaw.mock.calls[0];
    const flattened = JSON.stringify(call);
    expect(flattened).toContain("t1");
  });
});

describe("GET /api/admin/messages/[lineUserId] (detail)", () => {
  it("returns 401 when not authenticated", async () => {
    mockAdmin.mockResolvedValueOnce(null);
    const res = await detailHandler(
      req("http://x/api/admin/messages/U1"),
      { params: Promise.resolve({ lineUserId: "U1" }) },
    );
    expect(res.status).toBe(401);
  });

  it("returns messages + user summary", async () => {
    mockAdmin.mockResolvedValueOnce(ADMIN_T1);
    findManyMessage.mockResolvedValueOnce([
      { id: "m1", direction: "INBOUND", type: "TEXT", content: "hi", isRead: false, createdAt: new Date() },
    ]);
    findFirstUser.mockResolvedValueOnce({
      id: "user-1", displayName: "Alice", pictureUrl: null, phone: "09", segment: "VIP",
    });
    const res = await detailHandler(
      req("http://x/api/admin/messages/U1"),
      { params: Promise.resolve({ lineUserId: "U1" }) },
    );
    const body = await res.json();
    expect(body.messages).toHaveLength(1);
    expect(body.user.displayName).toBe("Alice");
  });

  it("returns 200 + empty array when no messages exist", async () => {
    mockAdmin.mockResolvedValueOnce(ADMIN_T1);
    findManyMessage.mockResolvedValueOnce([]);
    findFirstUser.mockResolvedValueOnce(null);
    const res = await detailHandler(
      req("http://x/api/admin/messages/U_new"),
      { params: Promise.resolve({ lineUserId: "U_new" }) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.messages).toEqual([]);
    expect(body.user).toBeNull();
  });
});

describe("POST /api/admin/messages/[lineUserId]/reply", () => {
  it("returns 401 when not authenticated", async () => {
    mockAdmin.mockResolvedValueOnce(null);
    const res = await replyHandler(
      req("http://x", { method: "POST", body: JSON.stringify({ text: "hi" }) }),
      { params: Promise.resolve({ lineUserId: "U1" }) },
    );
    expect(res.status).toBe(401);
  });

  it("rejects empty text", async () => {
    mockAdmin.mockResolvedValueOnce(ADMIN_T1);
    const res = await replyHandler(
      req("http://x", { method: "POST", body: JSON.stringify({ text: "   " }) }),
      { params: Promise.resolve({ lineUserId: "U1" }) },
    );
    expect(res.status).toBe(400);
  });

  it("rejects message longer than 5000 chars", async () => {
    mockAdmin.mockResolvedValueOnce(ADMIN_T1);
    const res = await replyHandler(
      req("http://x", { method: "POST", body: JSON.stringify({ text: "a".repeat(5001) }) }),
      { params: Promise.resolve({ lineUserId: "U1" }) },
    );
    expect(res.status).toBe(400);
  });

  it("🔴 CRITICAL: blocks cross-tenant reply (403)", async () => {
    mockAdmin.mockResolvedValueOnce(ADMIN_T1);
    // Customer belongs to a different tenant → findFirst returns null
    findFirstUser.mockResolvedValueOnce(null);
    const res = await replyHandler(
      req("http://x", { method: "POST", body: JSON.stringify({ text: "hi" }) }),
      { params: Promise.resolve({ lineUserId: "U_other_tenant" }) },
    );
    expect(res.status).toBe(403);
    expect(mockPushMessage).not.toHaveBeenCalled();
    expect(createMessage).not.toHaveBeenCalled();
  });

  it("sends LINE pushMessage and persists OUTBOUND on success", async () => {
    mockAdmin.mockResolvedValueOnce(ADMIN_T1);
    findFirstUser.mockResolvedValueOnce({ id: "user-1" });
    findFirstMessage.mockResolvedValueOnce(null); // no idempotency hit
    mockPushMessage.mockResolvedValueOnce({});
    createMessage.mockResolvedValueOnce({ id: "stored-msg" });

    const res = await replyHandler(
      req("http://x", {
        method: "POST",
        body: JSON.stringify({ text: "回覆", clientMessageId: "cid-1" }),
      }),
      { params: Promise.resolve({ lineUserId: "U1" }) },
    );
    expect(res.status).toBe(200);
    expect(mockPushMessage).toHaveBeenCalledOnce();
    expect(mockPushMessage).toHaveBeenCalledWith("U1", { type: "text", text: "回覆" });
    expect(createMessage).toHaveBeenCalledOnce();
    const arg = createMessage.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(arg.data.direction).toBe("OUTBOUND");
    expect(arg.data.tenantId).toBe("t1");
    expect(arg.data.clientMessageId).toBe("cid-1");
  });

  it("returns 500 and does not persist if LINE API fails", async () => {
    mockAdmin.mockResolvedValueOnce(ADMIN_T1);
    findFirstUser.mockResolvedValueOnce({ id: "user-1" });
    findFirstMessage.mockResolvedValueOnce(null);
    mockPushMessage.mockRejectedValueOnce(new Error("LINE down"));

    const res = await replyHandler(
      req("http://x", { method: "POST", body: JSON.stringify({ text: "hi" }) }),
      { params: Promise.resolve({ lineUserId: "U1" }) },
    );
    expect(res.status).toBe(500);
    expect(createMessage).not.toHaveBeenCalled();
  });

  it("returns stored message on clientMessageId replay (idempotent)", async () => {
    mockAdmin.mockResolvedValue(ADMIN_T1);
    findFirstUser.mockResolvedValue({ id: "user-1" });
    const existing = { id: "old-msg", direction: "OUTBOUND", content: "original" };
    findFirstMessage.mockResolvedValue(existing);

    const res = await replyHandler(
      req("http://x", {
        method: "POST",
        body: JSON.stringify({ text: "重送", clientMessageId: "dup-cid" }),
      }),
      { params: Promise.resolve({ lineUserId: "U1" }) },
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.message).toEqual(existing);
    expect(mockPushMessage).not.toHaveBeenCalled();
    expect(createMessage).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/admin/messages/[lineUserId]/read", () => {
  it("returns 401 when not authenticated", async () => {
    mockAdmin.mockResolvedValueOnce(null);
    const res = await readHandler(
      req("http://x", { method: "PATCH" }),
      { params: Promise.resolve({ lineUserId: "U1" }) },
    );
    expect(res.status).toBe(401);
  });

  it("marks all inbound messages as read (tenant-scoped)", async () => {
    mockAdmin.mockResolvedValueOnce(ADMIN_T1);
    updateManyMessage.mockResolvedValueOnce({ count: 3 });
    const res = await readHandler(
      req("http://x", { method: "PATCH" }),
      { params: Promise.resolve({ lineUserId: "U1" }) },
    );
    const body = await res.json();
    expect(body.updated).toBe(3);
    const arg = updateManyMessage.mock.calls[0][0] as { where: Record<string, unknown> };
    expect(arg.where.tenantId).toBe("t1");
    expect(arg.where.lineUserId).toBe("U1");
    expect(arg.where.direction).toBe("INBOUND");
  });
});
