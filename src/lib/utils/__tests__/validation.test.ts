import { describe, it, expect } from "vitest";
import {
  createBookingSchema,
  cancelBookingSchema,
  createServiceSchema,
  adminLoginSchema,
  updateSettingsSchema,
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
    const { tenantId: _, ...withoutTenant } = validBooking;
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

  it("rejects non-hourly startTime", () => {
    const result = createBookingSchema.safeParse({
      ...validBooking,
      startTime: "14:30",
    });
    expect(result.success).toBe(false);
  });

  it("rejects startTime without zero-padding", () => {
    const result = createBookingSchema.safeParse({
      ...validBooking,
      startTime: "9:00",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty lineUserId", () => {
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
