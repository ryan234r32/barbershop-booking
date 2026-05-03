import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";

// Mock emergency-alert BEFORE importing the route
const triggerEmergencyAlert = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/notifications/emergency-alert", () => ({
  triggerEmergencyAlert: (...a: unknown[]) => triggerEmergencyAlert(...a),
}));

import { POST } from "@/app/api/webhook/uptime-alert/route";

const SECRET = "test-secret-32-chars-abcdefghij12";
const URL = "https://example.test/api/webhook/uptime-alert";
const MONITOR = "https://barbershop-booking.vercel.app/api/health";

function buildRequest(body: unknown): NextRequest {
  return new NextRequest(URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const prevSecret = process.env.UPTIME_WEBHOOK_SECRET;

beforeEach(() => {
  vi.clearAllMocks();
  process.env.UPTIME_WEBHOOK_SECRET = SECRET;
});

afterEach(() => {
  if (prevSecret === undefined) delete process.env.UPTIME_WEBHOOK_SECRET;
  else process.env.UPTIME_WEBHOOK_SECRET = prevSecret;
});

describe("POST /api/webhook/uptime-alert", () => {
  it("happy path: status=down → 200 + triggerEmergencyAlert called with external_monitor + DOWN summary", async () => {
    const res = await POST(
      buildRequest({
        secret: SECRET,
        monitor: MONITOR,
        status: "down",
        detail: "503 Service Unavailable for 3 consecutive checks",
      }),
    );

    expect(res.status).toBe(200);
    const json = (await res.json()) as { ok: boolean };
    expect(json.ok).toBe(true);

    expect(triggerEmergencyAlert).toHaveBeenCalledOnce();
    const call = triggerEmergencyAlert.mock.calls[0][0] as {
      kind: string;
      summary: string;
      url: string;
    };
    expect(call.kind).toBe("external_monitor");
    expect(call.url).toBe(MONITOR);
    expect(call.summary).toContain("DOWN");
    expect(call.summary).toContain(MONITOR);
    expect(call.summary).toContain("503 Service Unavailable");
  });

  it("happy path: status=up → 200 + triggerEmergencyAlert called with RECOVERY summary", async () => {
    const res = await POST(
      buildRequest({
        secret: SECRET,
        monitor: MONITOR,
        status: "up",
      }),
    );

    expect(res.status).toBe(200);
    expect(triggerEmergencyAlert).toHaveBeenCalledOnce();
    const call = triggerEmergencyAlert.mock.calls[0][0] as {
      kind: string;
      summary: string;
    };
    expect(call.kind).toBe("external_monitor");
    expect(call.summary).toContain("RECOVERY");
  });

  it("invalid secret → 401, no alert fired", async () => {
    const res = await POST(
      buildRequest({
        secret: "wrong-secret",
        monitor: MONITOR,
        status: "down",
      }),
    );

    expect(res.status).toBe(401);
    expect(triggerEmergencyAlert).not.toHaveBeenCalled();
  });

  it("UPTIME_WEBHOOK_SECRET not set → fail closed with 401, no alert fired", async () => {
    delete process.env.UPTIME_WEBHOOK_SECRET;
    const res = await POST(
      buildRequest({
        secret: SECRET,
        monitor: MONITOR,
        status: "down",
      }),
    );

    expect(res.status).toBe(401);
    expect(triggerEmergencyAlert).not.toHaveBeenCalled();
  });

  it("malformed payload (missing required fields) → 400 via errorResponse, no alert fired", async () => {
    const res = await POST(
      buildRequest({
        secret: SECRET,
        // missing monitor + status
      }),
    );

    expect(res.status).toBe(400);
    const json = (await res.json()) as { code: string; issues?: unknown[] };
    expect(json.code).toBe("VALIDATION_ERROR");
    expect(triggerEmergencyAlert).not.toHaveBeenCalled();
  });

  it("malformed payload (invalid status enum) → 400, no alert fired", async () => {
    const res = await POST(
      buildRequest({
        secret: SECRET,
        monitor: MONITOR,
        status: "maybe", // not "up" | "down"
      }),
    );

    expect(res.status).toBe(400);
    expect(triggerEmergencyAlert).not.toHaveBeenCalled();
  });

  it("malformed payload (non-JSON body) → 500 via errorResponse, no alert fired", async () => {
    // request.json() will throw → caught by try/catch → errorResponse generic 500
    const res = await POST(buildRequest("this is not json {"));
    expect(res.status).toBe(500);
    expect(triggerEmergencyAlert).not.toHaveBeenCalled();
  });

  it("alert push rejecting should not turn the response into 5xx (fire-and-forget)", async () => {
    // Real triggerEmergencyAlert is async + never-throws; this simulates the
    // case where it returns a rejected promise (e.g. LINE API down). `void`
    // in the route swallows the promise rejection, so the webhook still 200s
    // and the monitor doesn't retry.
    triggerEmergencyAlert.mockRejectedValueOnce(new Error("LINE API down"));

    const res = await POST(
      buildRequest({
        secret: SECRET,
        monitor: MONITOR,
        status: "down",
      }),
    );

    expect(res.status).toBe(200);
  });
});
