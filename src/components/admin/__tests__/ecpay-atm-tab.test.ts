import { describe, it, expect } from "vitest";
import {
  partitionOrders,
  summaryTone,
  type ECPayOrderDTO,
} from "@/components/admin/ecpay-atm-tab";

const mk = (overrides: Partial<ECPayOrderDTO>): ECPayOrderDTO => ({
  id: "o",
  merchantTradeNo: "TS",
  tradeNo: null,
  amount: 500,
  bankCode: "008",
  vAccount: "123",
  expireDate: null,
  status: "PENDING",
  failureReason: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  booking: {
    id: "b",
    date: "2026-04-15",
    startTime: "14:00",
    endTime: "15:00",
    status: "CONFIRMED",
    service: { name: "剪髮", price: 500, slotsNeeded: 1 },
    user: { id: "u", displayName: "客", phone: null, lineUserId: null },
  },
  payment: null,
  ...overrides,
});

describe("partitionOrders", () => {
  it("PENDING → pending bucket", () => {
    const out = partitionOrders([mk({ status: "PENDING" })]);
    expect(out.pending).toHaveLength(1);
    expect(out.paid).toHaveLength(0);
    expect(out.trouble).toHaveLength(0);
  });

  it("CREATED → pending bucket (treated as pending UX-wise)", () => {
    const out = partitionOrders([mk({ id: "c", status: "CREATED" })]);
    expect(out.pending).toHaveLength(1);
  });

  it("PAID within 7 days → paid bucket", () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 86_400_000).toISOString();
    const out = partitionOrders([
      mk({ status: "PAID", updatedAt: twoDaysAgo }),
    ]);
    expect(out.paid).toHaveLength(1);
  });

  it("PAID older than 7 days → dropped", () => {
    const oldIso = new Date(Date.now() - 30 * 86_400_000).toISOString();
    const out = partitionOrders([
      mk({ status: "PAID", updatedAt: oldIso }),
    ]);
    expect(out.paid).toHaveLength(0);
  });

  it("EXPIRED + FAILED → trouble bucket", () => {
    const out = partitionOrders([
      mk({ id: "e", status: "EXPIRED" }),
      mk({ id: "f", status: "FAILED" }),
    ]);
    expect(out.trouble).toHaveLength(2);
  });
});

describe("summaryTone", () => {
  it("<90% → ok", () => {
    expect(summaryTone(0)).toBe("ok");
    expect(summaryTone(89)).toBe("ok");
  });

  it("90-99% → warn", () => {
    expect(summaryTone(90)).toBe("warn");
    expect(summaryTone(99)).toBe("warn");
  });

  it(">=100% → crit", () => {
    expect(summaryTone(100)).toBe("crit");
    expect(summaryTone(150)).toBe("crit");
  });
});
