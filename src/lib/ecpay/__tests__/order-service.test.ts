import { describe, it, expect, beforeEach, vi } from "vitest";

// ── Prisma mock ────────────────────────────────────────────────────────────
const bookingFindFirst = vi.fn();
const paymentCreate = vi.fn();
const paymentUpdate = vi.fn();
const ecpayOrderCreate = vi.fn();
const ecpayOrderUpdate = vi.fn();
const ecpayAggregate = vi.fn();
const txFn = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    booking: { findFirst: (...a: unknown[]) => bookingFindFirst(...a) },
    payment: {
      create: (...a: unknown[]) => paymentCreate(...a),
      update: (...a: unknown[]) => paymentUpdate(...a),
    },
    eCPayOrder: {
      create: (...a: unknown[]) => ecpayOrderCreate(...a),
      update: (...a: unknown[]) => ecpayOrderUpdate(...a),
      aggregate: (...a: unknown[]) => ecpayAggregate(...a),
    },
    $transaction: (...a: unknown[]) => txFn(...a),
  },
}));

// ── Lock mock ──────────────────────────────────────────────────────────────
const acquireLock = vi.fn();
const releaseLock = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/ecpay/locks", () => ({
  acquireEcpayCreateLock: (...a: unknown[]) => acquireLock(...a),
  releaseEcpayCreateLock: (...a: unknown[]) => releaseLock(...a),
}));

// ── Config mock: always enabled ────────────────────────────────────────────
const fakeConfig = {
  sdk: {
    OperationMode: "Test" as const,
    MercProfile: {
      MerchantID: "2000132",
      HashKey: "5294y06JbISpM5x9",
      HashIV: "v77hoKGq4kWxNNIS",
    },
    IgnorePayment: [],
    IsProjectContractor: false,
  },
  returnUrl: "https://example.com/api/webhooks/ecpay/return",
  paymentInfoUrl: "https://example.com/api/webhooks/ecpay/payment-info",
  clientRedirectUrl: "https://example.com/payment/result",
  enabled: true,
};
const loadConfig = vi.fn<() => typeof fakeConfig | null>(() => fakeConfig);
vi.mock("@/lib/ecpay/config", () => ({
  loadECPayConfig: () => loadConfig(),
  isEcpayEnabled: () => loadConfig() !== null,
}));

// Do NOT mock the SDK — we use the real one (as instructed).

import { createEcpayAtmOrder } from "@/lib/ecpay/order-service";
import { AppError } from "@/lib/utils/errors";

const FAKE_LOCK = { release: vi.fn() } as unknown as import("@upstash/lock").Lock;

const futureDate = () => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 7);
  d.setUTCHours(0, 0, 0, 0);
  return d;
};

const makeBooking = (overrides: Record<string, unknown> = {}) => ({
  id: "b1",
  tenantId: "t1",
  status: "CONFIRMED",
  date: futureDate(),
  startTime: "14:00",
  service: { name: "剪髮", price: 500 },
  payment: null,
  ecpayOrders: [],
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  loadConfig.mockReturnValue(fakeConfig);
  acquireLock.mockResolvedValue(FAKE_LOCK);
  ecpayAggregate.mockResolvedValue({ _sum: { amount: 0 } });
  // Default tx runs the callback with a tx client that proxies to the mocked delegates.
  txFn.mockImplementation(async (arg: unknown) => {
    if (typeof arg === "function") {
      const tx = {
        payment: { create: paymentCreate, update: paymentUpdate },
        eCPayOrder: { create: ecpayOrderCreate, update: ecpayOrderUpdate },
      };
      return arg(tx);
    }
    // Array form (rollback): just resolve each.
    return Promise.all(arg as Promise<unknown>[]);
  });
  paymentCreate.mockResolvedValue({ id: "p1" });
  paymentUpdate.mockResolvedValue({ id: "p1" });
  ecpayOrderCreate.mockResolvedValue({ id: "o1" });
  ecpayOrderUpdate.mockResolvedValue({ id: "o1" });
});

const ACTOR = { type: "liff" as const, lineUserId: "Uabc" };

describe("createEcpayAtmOrder", () => {
  it("happy path returns html + merchantTradeNo + amount", async () => {
    bookingFindFirst.mockResolvedValue(makeBooking());
    const res = await createEcpayAtmOrder({
      bookingId: "b1",
      tenantId: "t1",
      actor: ACTOR,
    });
    expect(res.amount).toBe(500);
    expect(res.merchantTradeNo).toMatch(/^TS[A-Z0-9]{17}$/);
    expect(res.html).toContain("<form");
    expect(res.html).toContain("CheckMacValue");
    expect(paymentCreate).toHaveBeenCalled();
    expect(ecpayOrderCreate).toHaveBeenCalled();
    expect(releaseLock).toHaveBeenCalledWith(FAKE_LOCK);
  });

  it("ECPAY_DISABLED when config is null", async () => {
    loadConfig.mockReturnValue(null);
    await expect(
      createEcpayAtmOrder({ bookingId: "b1", tenantId: "t1", actor: ACTOR })
    ).rejects.toMatchObject({ code: "ECPAY_DISABLED", statusCode: 503 });
  });

  it("LOCK_BUSY when lock can't be acquired", async () => {
    acquireLock.mockResolvedValue(null);
    await expect(
      createEcpayAtmOrder({ bookingId: "b1", tenantId: "t1", actor: ACTOR })
    ).rejects.toMatchObject({ code: "LOCK_BUSY", statusCode: 409 });
  });

  it("booking not found → 404", async () => {
    bookingFindFirst.mockResolvedValue(null);
    await expect(
      createEcpayAtmOrder({ bookingId: "b1", tenantId: "t1", actor: ACTOR })
    ).rejects.toMatchObject({ code: "BOOKING_NOT_FOUND", statusCode: 404 });
    expect(releaseLock).toHaveBeenCalled();
  });

  it("booking not CONFIRMED → 409", async () => {
    bookingFindFirst.mockResolvedValue(makeBooking({ status: "CANCELLED" }));
    await expect(
      createEcpayAtmOrder({ bookingId: "b1", tenantId: "t1", actor: ACTOR })
    ).rejects.toMatchObject({ code: "BOOKING_NOT_CONFIRMED", statusCode: 409 });
  });

  it("booking in past → 409", async () => {
    const past = new Date();
    past.setUTCDate(past.getUTCDate() - 5);
    past.setUTCHours(0, 0, 0, 0);
    bookingFindFirst.mockResolvedValue(makeBooking({ date: past }));
    await expect(
      createEcpayAtmOrder({ bookingId: "b1", tenantId: "t1", actor: ACTOR })
    ).rejects.toMatchObject({ code: "BOOKING_IN_PAST", statusCode: 409 });
  });

  it("already RECEIVED → 409 PAYMENT_LOCKED", async () => {
    bookingFindFirst.mockResolvedValue(
      makeBooking({ payment: { id: "p1", status: "RECEIVED", amount: 500 } })
    );
    await expect(
      createEcpayAtmOrder({ bookingId: "b1", tenantId: "t1", actor: ACTOR })
    ).rejects.toMatchObject({ code: "PAYMENT_LOCKED", statusCode: 409 });
  });

  it("already WAIVED → 409 PAYMENT_LOCKED", async () => {
    bookingFindFirst.mockResolvedValue(
      makeBooking({ payment: { id: "p1", status: "WAIVED", amount: 500 } })
    );
    await expect(
      createEcpayAtmOrder({ bookingId: "b1", tenantId: "t1", actor: ACTOR })
    ).rejects.toMatchObject({ code: "PAYMENT_LOCKED" });
  });

  it("monthly cap exceeded → 409 MONTHLY_CAP_EXCEEDED", async () => {
    bookingFindFirst.mockResolvedValue(makeBooking());
    ecpayAggregate.mockResolvedValue({ _sum: { amount: 279_999 } });
    await expect(
      createEcpayAtmOrder({ bookingId: "b1", tenantId: "t1", actor: ACTOR })
    ).rejects.toMatchObject({ code: "MONTHLY_CAP_EXCEEDED", statusCode: 409 });
  });

  it("existing live PENDING order is superseded (marked FAILED) before new one is created", async () => {
    bookingFindFirst.mockResolvedValue(
      makeBooking({
        ecpayOrders: [
          {
            id: "old-order",
            status: "PENDING",
            expireDate: new Date(Date.now() + 86400_000),
          },
        ],
      })
    );
    await createEcpayAtmOrder({ bookingId: "b1", tenantId: "t1", actor: ACTOR });
    // First update call = supersede the old order.
    expect(ecpayOrderUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "old-order" },
        data: expect.objectContaining({
          status: "FAILED",
          failureReason: "superseded",
        }),
      })
    );
    expect(ecpayOrderCreate).toHaveBeenCalled();
  });

  it("tenant isolation: findFirst filters by tenantId", async () => {
    bookingFindFirst.mockResolvedValue(makeBooking());
    await createEcpayAtmOrder({
      bookingId: "b1",
      tenantId: "t1",
      actor: ACTOR,
    });
    expect(bookingFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "b1", tenantId: "t1" },
      })
    );
  });

  it("releases lock even when an error is thrown", async () => {
    bookingFindFirst.mockRejectedValue(new AppError("boom", 500));
    await expect(
      createEcpayAtmOrder({ bookingId: "b1", tenantId: "t1", actor: ACTOR })
    ).rejects.toBeInstanceOf(AppError);
    expect(releaseLock).toHaveBeenCalledWith(FAKE_LOCK);
  });
});
