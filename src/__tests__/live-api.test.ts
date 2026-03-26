/**
 * Live API integration tests.
 * Tests actual endpoints on the deployed production site.
 *
 * User scenarios tested:
 * 1. Customer views available services
 * 2. Customer checks available time slots
 * 3. Admin login flow
 * 4. Cron job security (unauthorized access blocked)
 * 5. Booking API validation
 * 6. Webhook endpoint accessibility
 */
import { describe, it, expect } from "vitest";

const RUN_LIVE = process.env.LIVE_API_TESTS === "true";
const describeIf = RUN_LIVE ? describe : describe.skip;

const BASE_URL =
  process.env.LIVE_API_BASE_URL ||
  "https://barbershop-booking-swart.vercel.app";

// Known IDs from seed data
const TENANT_ID = "39662028-4caf-4149-9b2a-bc37087c0272";

describeIf("Live API — Customer: View Services", () => {
  it("returns services list without tenantId (uses DEFAULT_TENANT_ID)", async () => {
    const res = await fetch(`${BASE_URL}/api/services`);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.services).toBeDefined();
    expect(data.services.length).toBeGreaterThan(0);
  });

  it("returns services with correct structure", async () => {
    const res = await fetch(`${BASE_URL}/api/services`);
    const data = await res.json();

    const service = data.services[0];
    expect(service).toHaveProperty("id");
    expect(service).toHaveProperty("name");
    expect(service).toHaveProperty("duration");
    expect(service).toHaveProperty("slotsNeeded");
    expect(service).toHaveProperty("price");
    expect(service).toHaveProperty("isActive");
    expect(service.isActive).toBe(true);
  });

  it("returns expected 1008 Hair Studio services", async () => {
    const res = await fetch(`${BASE_URL}/api/services`);
    const data = await res.json();
    const names = data.services.map((s: { name: string }) => s.name);

    expect(names).toContain("男性剪髮");
    expect(names).toContain("女性剪髮");
    expect(names).toContain("溫塑燙");
    expect(names).toContain("縮毛矯正");
  });

  it("returns services sorted by sortOrder", async () => {
    const res = await fetch(`${BASE_URL}/api/services`);
    const data = await res.json();
    const orders = data.services.map((s: { sortOrder: number }) => s.sortOrder);

    for (let i = 1; i < orders.length; i++) {
      expect(orders[i]).toBeGreaterThanOrEqual(orders[i - 1]);
    }
  });

  it("returns correct pricing for 男性剪髮", async () => {
    const res = await fetch(`${BASE_URL}/api/services`);
    const data = await res.json();
    const haircut = data.services.find(
      (s: { name: string }) => s.name === "男性剪髮"
    );

    expect(haircut).toBeDefined();
    expect(haircut.price).toBe(1000);
    expect(haircut.duration).toBe(60);
    expect(haircut.slotsNeeded).toBe(1);
  });
});

describeIf("Live API — Customer: Check Available Slots", () => {
  let serviceId: string;

  it("fetches a service ID for slot queries", async () => {
    const res = await fetch(`${BASE_URL}/api/services`);
    const data = await res.json();
    serviceId = data.services[0].id;
    expect(serviceId).toBeDefined();
  });

  it("returns slots for a future open day", async () => {
    // Find next Tuesday (dayOfWeek=2, always open)
    const today = new Date();
    const daysUntilTuesday = ((2 - today.getDay() + 7) % 7) || 7;
    const nextTuesday = new Date(today);
    nextTuesday.setDate(today.getDate() + daysUntilTuesday);
    const dateStr = nextTuesday.toISOString().split("T")[0];

    const res = await fetch(
      `${BASE_URL}/api/slots?date=${dateStr}&serviceId=${serviceId}`
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.slots).toBeDefined();
    expect(data.slots.length).toBeGreaterThan(0);
  });

  it("returns slots with correct structure", async () => {
    const today = new Date();
    const daysUntilWed = ((3 - today.getDay() + 7) % 7) || 7;
    const nextWed = new Date(today);
    nextWed.setDate(today.getDate() + daysUntilWed);
    const dateStr = nextWed.toISOString().split("T")[0];

    const res = await fetch(
      `${BASE_URL}/api/slots?date=${dateStr}&serviceId=${serviceId}`
    );
    const data = await res.json();

    if (data.slots.length > 0) {
      const slot = data.slots[0];
      expect(slot).toHaveProperty("startTime");
      expect(slot).toHaveProperty("endTime");
      expect(slot).toHaveProperty("isRecommended");
      expect(slot.startTime).toMatch(/^\d{2}:00$/);
    }
  });

  it("returns empty slots for Monday (closed day)", async () => {
    const today = new Date();
    const daysUntilMonday = ((1 - today.getDay() + 7) % 7) || 7;
    const nextMonday = new Date(today);
    nextMonday.setDate(today.getDate() + daysUntilMonday);
    const dateStr = nextMonday.toISOString().split("T")[0];

    const res = await fetch(
      `${BASE_URL}/api/slots?date=${dateStr}&serviceId=${serviceId}`
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.slots).toEqual([]);
  });

  it("returns 400 when date is missing", async () => {
    const res = await fetch(`${BASE_URL}/api/slots?serviceId=${serviceId}`);
    expect(res.status).toBe(400);
  });

  it("returns 400 when serviceId is missing", async () => {
    const res = await fetch(`${BASE_URL}/api/slots?date=2026-04-01`);
    expect(res.status).toBe(400);
  });
});

describeIf("Live API — Customer: Booking Validation", () => {
  it("rejects booking with missing required fields", async () => {
    const res = await fetch(`${BASE_URL}/api/bookings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it("rejects booking with invalid date format", async () => {
    const res = await fetch(`${BASE_URL}/api/bookings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tenantId: TENANT_ID,
        serviceId: "7859e438-2adf-4a96-93b8-7d15d9377ec8",
        date: "25/03/2026", // wrong format
        startTime: "14:00",
        lineUserId: "Utest123",
      }),
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it("rejects booking with non-hourly startTime", async () => {
    const res = await fetch(`${BASE_URL}/api/bookings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tenantId: TENANT_ID,
        serviceId: "7859e438-2adf-4a96-93b8-7d15d9377ec8",
        date: "2026-03-25",
        startTime: "14:30", // not hourly
        lineUserId: "Utest123",
      }),
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});

describeIf("Live API — Admin: Authentication", () => {
  it("rejects login with wrong credentials", async () => {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "admin@1008hair.com",
        password: "wrongpassword",
      }),
    });

    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBeDefined();
  });

  it("rejects login with invalid email format", async () => {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "not-an-email",
        password: "admin123",
      }),
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it("rejects login with short password", async () => {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "admin@1008hair.com",
        password: "12345",
      }),
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it("returns 401 for /api/auth/me without cookie", async () => {
    const res = await fetch(`${BASE_URL}/api/auth/me`);
    expect(res.status).toBe(401);
  });
});

describeIf("Live API — Security: Cron Jobs", () => {
  it("blocks reminders cron without auth", async () => {
    const res = await fetch(`${BASE_URL}/api/cron/reminders`);
    expect(res.status).toBe(401);
  });

  it("blocks cleanup cron without auth", async () => {
    const res = await fetch(`${BASE_URL}/api/cron/cleanup`);
    expect(res.status).toBe(401);
  });

  it("blocks at-risk cron without auth", async () => {
    const res = await fetch(`${BASE_URL}/api/cron/at-risk`);
    expect(res.status).toBe(401);
  });

  it("blocks cron with wrong secret", async () => {
    const res = await fetch(`${BASE_URL}/api/cron/reminders`, {
      headers: { Authorization: "Bearer wrong-secret" },
    });
    expect(res.status).toBe(401);
  });
});

describeIf("Live API — Security: Admin-Only Endpoints", () => {
  it("blocks service creation without admin auth", async () => {
    const res = await fetch(`${BASE_URL}/api/services`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Test Service",
        duration: 60,
        slotsNeeded: 1,
        price: 500,
      }),
    });
    expect(res.status).toBe(401);
  });

  it("blocks customer list without admin auth", async () => {
    const res = await fetch(`${BASE_URL}/api/customers`);
    expect(res.status).toBe(401);
  });

  it("blocks settings update without admin auth", async () => {
    const res = await fetch(`${BASE_URL}/api/admin/settings`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ businessName: "Hacked" }),
    });
    expect(res.status).toBe(401);
  });
});

describeIf("Live API — LINE: Webhook", () => {
  it("rejects GET requests (only POST allowed)", async () => {
    const res = await fetch(`${BASE_URL}/api/webhook`);
    expect(res.status).toBe(405);
  });

  it("rejects POST with invalid signature", async () => {
    const res = await fetch(`${BASE_URL}/api/webhook`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-line-signature": "invalid-signature",
      },
      body: JSON.stringify({ events: [] }),
    });
    expect(res.status).toBe(403);
  });

  it("rejects POST without signature header", async () => {
    const res = await fetch(`${BASE_URL}/api/webhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ events: [] }),
    });
    expect(res.status).toBe(403);
  });
});

describeIf("Live API — LIFF: Session Init", () => {
  it("rejects init without lineUserId", async () => {
    const res = await fetch(`${BASE_URL}/api/liff/init`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("lineUserId");
  });
});
