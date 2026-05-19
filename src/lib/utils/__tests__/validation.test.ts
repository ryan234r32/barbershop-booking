import { describe, it, expect } from "vitest";
import {
  createBookingSchema,
  cancelBookingSchema,
  createServiceSchema,
  adminLoginSchema,
  updateSettingsSchema,
  addBookingServiceSchema,
} from "@/lib/utils/validation";

describe("createBookingSchema", () => {
  const validBooking = {
    tenantId: "39662028-4caf-4149-9b2a-bc37087c0272",
    serviceId: "7859e438-2adf-4a96-93b8-7d15d9377ec8",
    date: "2026-03-25",
    startTime: "14:00",
    lineUserId: "U1234567890abcdef",
  };

  it("accepts valid booking input", () => {
    const result = createBookingSchema.safeParse(validBooking);
    expect(result.success).toBe(true);
  });

  it("accepts booking without tenantId (optional, uses DEFAULT_TENANT_ID)", () => {
    const { tenantId: _tenantId, ...withoutTenant } = validBooking;
    void _tenantId;
    const result = createBookingSchema.safeParse(withoutTenant);
    expect(result.success).toBe(true);
  });

  it("accepts booking with optional notes", () => {
    const result = createBookingSchema.safeParse({
      ...validBooking,
      notes: "第一次來，頭皮比較敏感",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid UUID for tenantId when provided", () => {
    const result = createBookingSchema.safeParse({
      ...validBooking,
      tenantId: "not-a-uuid",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid date format (slash-separated)", () => {
    const result = createBookingSchema.safeParse({
      ...validBooking,
      date: "2026/03/25",
    });
    expect(result.success).toBe(false);
  });

  it("rejects date with extra characters", () => {
    const result = createBookingSchema.safeParse({
      ...validBooking,
      date: "2026-03-25T00:00:00",
    });
    expect(result.success).toBe(false);
  });

  // V3.7 Tier 1.4 §0a E-E: HH:30 是 admin-only start time（schema 允許，
  // 但 bookings/route.ts 在 auth.type === "liff" 時會 400 攔下）。
  // 故 schema 允許 HH:00 和 HH:30，其他 minute 仍拒絕。
  it("accepts HH:30 startTime at schema level (admin path enforces auth)", () => {
    const result = createBookingSchema.safeParse({
      ...validBooking,
      startTime: "14:30",
    });
    expect(result.success).toBe(true);
  });

  it("rejects non-half-hour startTime (e.g. 14:15 / 14:45)", () => {
    for (const bad of ["14:15", "14:45", "14:05", "14:59"]) {
      const result = createBookingSchema.safeParse({
        ...validBooking,
        startTime: bad,
      });
      expect(result.success, `should reject ${bad}`).toBe(false);
    }
  });

  it("rejects startTime without zero-padding", () => {
    const result = createBookingSchema.safeParse({
      ...validBooking,
      startTime: "9:00",
    });
    expect(result.success).toBe(false);
  });

  it.skip("rejects empty lineUserId", () => {
    // Deprecated: lineUserId is now derived from auth context (LIFF cookie /
    // admin session), not the request body. The schema marks it optional.
    const result = createBookingSchema.safeParse({
      ...validBooking,
      lineUserId: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing required fields", () => {
    const result = createBookingSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

// V3.7 P3 (5/19) — Service+Variant + 諮詢制 input shapes
describe("createBookingSchema — V3.7 P3 services[] + variants", () => {
  const baseInput = {
    tenantId: "39662028-4caf-4149-9b2a-bc37087c0272",
    date: "2026-06-01",
    startTime: "14:00",
    lineUserId: "U1234567890abcdef",
  };

  const serviceId = "7859e438-2adf-4a96-93b8-7d15d9377ec8";
  const variantId = "11111111-2222-4222-8333-555555555555";
  const otherServiceId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

  it("parses preferred shape: services: [{ serviceId }]", () => {
    const result = createBookingSchema.safeParse({
      ...baseInput,
      services: [{ serviceId }],
    });
    expect(result.success).toBe(true);
  });

  it("parses services with variantId", () => {
    const result = createBookingSchema.safeParse({
      ...baseInput,
      services: [{ serviceId, variantId }],
    });
    expect(result.success).toBe(true);
  });

  it("parses legacy shape: serviceIds: [uuid]", () => {
    const result = createBookingSchema.safeParse({
      ...baseInput,
      serviceIds: [serviceId, otherServiceId],
    });
    expect(result.success).toBe(true);
  });

  it("parses legacy shape: serviceId: uuid", () => {
    const result = createBookingSchema.safeParse({
      ...baseInput,
      serviceId,
    });
    expect(result.success).toBe(true);
  });

  it("rejects when none of serviceId / serviceIds / services is provided", () => {
    const result = createBookingSchema.safeParse(baseInput);
    expect(result.success).toBe(false);
    if (!result.success) {
      // refine() error should point at services
      expect(result.error.issues.some((i) => i.path.includes("services"))).toBe(true);
    }
  });

  it("rejects empty services array", () => {
    const result = createBookingSchema.safeParse({
      ...baseInput,
      services: [],
    });
    expect(result.success).toBe(false);
  });

  it("rejects services array with more than 8 entries", () => {
    const tooMany = Array.from({ length: 9 }, () => ({ serviceId }));
    const result = createBookingSchema.safeParse({
      ...baseInput,
      services: tooMany,
    });
    expect(result.success).toBe(false);
  });

  it("accepts services array with exactly 8 entries", () => {
    const eight = Array.from({ length: 8 }, () => ({ serviceId }));
    const result = createBookingSchema.safeParse({
      ...baseInput,
      services: eight,
    });
    expect(result.success).toBe(true);
  });

  it("rejects services entry with non-uuid serviceId", () => {
    const result = createBookingSchema.safeParse({
      ...baseInput,
      services: [{ serviceId: "not-a-uuid" }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects services entry with non-uuid variantId", () => {
    const result = createBookingSchema.safeParse({
      ...baseInput,
      services: [{ serviceId, variantId: "not-a-uuid" }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects serviceIds empty array", () => {
    const result = createBookingSchema.safeParse({
      ...baseInput,
      serviceIds: [],
    });
    expect(result.success).toBe(false);
  });
});

describe("addBookingServiceSchema — V3.7 P3", () => {
  const serviceId = "7859e438-2adf-4a96-93b8-7d15d9377ec8";
  const variantId = "11111111-2222-4222-8333-555555555555";

  it("parses serviceId without variantId", () => {
    const result = addBookingServiceSchema.safeParse({ serviceId });
    expect(result.success).toBe(true);
  });

  it("parses serviceId + variantId", () => {
    const result = addBookingServiceSchema.safeParse({ serviceId, variantId });
    expect(result.success).toBe(true);
  });

  it("parses with optional expectedUpdatedAt (ISO datetime)", () => {
    const result = addBookingServiceSchema.safeParse({
      serviceId,
      variantId,
      expectedUpdatedAt: "2026-05-19T10:00:00.000Z",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing serviceId", () => {
    const result = addBookingServiceSchema.safeParse({ variantId });
    expect(result.success).toBe(false);
  });

  it("rejects non-uuid serviceId", () => {
    const result = addBookingServiceSchema.safeParse({ serviceId: "nope" });
    expect(result.success).toBe(false);
  });

  it("rejects non-uuid variantId", () => {
    const result = addBookingServiceSchema.safeParse({ serviceId, variantId: "nope" });
    expect(result.success).toBe(false);
  });
});

describe("cancelBookingSchema", () => {
  it("accepts empty object (reason is optional)", () => {
    const result = cancelBookingSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts cancel with reason", () => {
    const result = cancelBookingSchema.safeParse({
      reason: "臨時有事",
    });
    expect(result.success).toBe(true);
  });
});

describe("createServiceSchema", () => {
  const validService = {
    name: "男性剪髮",
    duration: 60,
    slotsNeeded: 1,
    price: 1000,
  };

  it("accepts valid service input", () => {
    const result = createServiceSchema.safeParse(validService);
    expect(result.success).toBe(true);
  });

  it("accepts service with all optional fields", () => {
    const result = createServiceSchema.safeParse({
      ...validService,
      description: "洗+剪+造型",
      sortOrder: 1,
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty service name", () => {
    const result = createServiceSchema.safeParse({
      ...validService,
      name: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects service name over 50 characters", () => {
    const result = createServiceSchema.safeParse({
      ...validService,
      name: "a".repeat(51),
    });
    expect(result.success).toBe(false);
  });

  it("rejects duration under 30 minutes", () => {
    const result = createServiceSchema.safeParse({
      ...validService,
      duration: 15,
    });
    expect(result.success).toBe(false);
  });

  it("rejects duration over 480 minutes (8 hours)", () => {
    const result = createServiceSchema.safeParse({
      ...validService,
      duration: 500,
    });
    expect(result.success).toBe(false);
  });

  it("rejects zero slotsNeeded", () => {
    const result = createServiceSchema.safeParse({
      ...validService,
      slotsNeeded: 0,
    });
    expect(result.success).toBe(false);
  });

  it("rejects slotsNeeded over 8", () => {
    const result = createServiceSchema.safeParse({
      ...validService,
      slotsNeeded: 9,
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative price", () => {
    const result = createServiceSchema.safeParse({
      ...validService,
      price: -100,
    });
    expect(result.success).toBe(false);
  });

  it("accepts zero price (free service)", () => {
    const result = createServiceSchema.safeParse({
      ...validService,
      price: 0,
    });
    expect(result.success).toBe(true);
  });

  it("rejects non-integer price", () => {
    const result = createServiceSchema.safeParse({
      ...validService,
      price: 99.5,
    });
    expect(result.success).toBe(false);
  });
});

describe("adminLoginSchema", () => {
  it("accepts valid login credentials", () => {
    const result = adminLoginSchema.safeParse({
      email: "admin@1008hair.com",
      password: "admin123",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid email format", () => {
    const result = adminLoginSchema.safeParse({
      email: "not-an-email",
      password: "admin123",
    });
    expect(result.success).toBe(false);
  });

  it("rejects password shorter than 6 characters", () => {
    const result = adminLoginSchema.safeParse({
      email: "admin@1008hair.com",
      password: "12345",
    });
    expect(result.success).toBe(false);
  });

  it("accepts exactly 6 character password", () => {
    const result = adminLoginSchema.safeParse({
      email: "admin@1008hair.com",
      password: "123456",
    });
    expect(result.success).toBe(true);
  });
});

describe("updateSettingsSchema", () => {
  it("accepts partial update with only businessName", () => {
    const result = updateSettingsSchema.safeParse({
      businessName: "1008 Hair Studio",
    });
    expect(result.success).toBe(true);
  });

  it("accepts full settings update", () => {
    const result = updateSettingsSchema.safeParse({
      businessName: "1008 Hair Studio",
      phone: "02-2396-2306",
      address: "台北市中正區新生南路一段144-10號",
      bankInfo: "台北富邦銀行",
      bankAccountName: "陳老闆",
      bankAccountNumber: "123456789",
    });
    expect(result.success).toBe(true);
  });

  it("accepts empty object (all fields optional)", () => {
    const result = updateSettingsSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("rejects empty businessName string", () => {
    const result = updateSettingsSchema.safeParse({
      businessName: "",
    });
    expect(result.success).toBe(false);
  });
});
