import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

const orderUpdateMany = vi.fn();
const orderFindMany = vi.fn();
const paymentUpdateMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    eCPayOrder: {
      updateMany: (...a: unknown[]) => orderUpdateMany(...a),
      findMany: (...a: unknown[]) => orderFindMany(...a),
    },
    payment: {
      updateMany: (...a: unknown[]) => paymentUpdateMany(...a),
    },
    // Our route uses $transaction([tx.a.updateMany(...), tx.b.updateMany(...)])
    // with the top-level prisma client — the promises already resolve via the
    // mocked updateMany fns above. So we just Promise.all the argument array.
    $transaction: async (arg: unknown) => Promise.all(arg as Promise<unknown>[]),
  },
}));

import { GET } from "@/app/api/cron/ecpay-sweeper/route";

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = "s3cret";
  orderUpdateMany.mockResolvedValue({ count: 0 });
  orderFindMany.mockResolvedValue([]);
  paymentUpdateMany.mockResolvedValue({ count: 0 });
});

function authedReq() {
  return new NextRequest(new URL("http://x/api/cron/ecpay-sweeper"), {
    headers: { authorization: "Bearer s3cret" },
  });
}

function unauthedReq() {
  return new NextRequest(new URL("http://x/api/cron/ecpay-sweeper"));
}

describe("GET /api/cron/ecpay-sweeper", () => {
  it("requires CRON_SECRET → 401 without auth", async () => {
    const res = await GET(unauthedReq());
    expect(res.status).toBe(401);
    expect(orderUpdateMany).not.toHaveBeenCalled();
  });

  it("marks stale CREATED as FAILED(stale_created)", async () => {
    orderUpdateMany.mockResolvedValueOnce({ count: 3 });
    const res = await GET(authedReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.stale).toBe(3);

    const firstCall = orderUpdateMany.mock.calls[0][0];
    expect(firstCall.where.status).toBe("CREATED");
    expect(firstCall.where.createdAt.lt).toBeInstanceOf(Date);
    expect(firstCall.data.status).toBe("FAILED");
    expect(firstCall.data.failureReason).toBe("stale_created");
  });

  it("marks expired PENDING + flips linked AWAITING_BANK payment to EXPIRED", async () => {
    orderUpdateMany.mockResolvedValueOnce({ count: 0 }); // stale pass
    orderFindMany.mockResolvedValueOnce([
      { id: "o1", paymentId: "p1" },
      { id: "o2", paymentId: "p2" },
    ]);
    orderUpdateMany.mockResolvedValueOnce({ count: 2 }); // expired pass inside tx
    paymentUpdateMany.mockResolvedValueOnce({ count: 2 });

    const res = await GET(authedReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.expired).toBe(2);

    const expiredCall = orderUpdateMany.mock.calls[1][0];
    expect(expiredCall.where.id.in).toEqual(["o1", "o2"]);
    expect(expiredCall.data.status).toBe("EXPIRED");

    const payCall = paymentUpdateMany.mock.calls[0][0];
    expect(payCall.where.id.in.sort()).toEqual(["p1", "p2"]);
    expect(payCall.where.status).toBe("AWAITING_BANK");
    expect(payCall.data.status).toBe("EXPIRED");
  });

  it("no expired orders → skips payment update entirely", async () => {
    orderUpdateMany.mockResolvedValueOnce({ count: 0 });
    orderFindMany.mockResolvedValueOnce([]);
    const res = await GET(authedReq());
    expect(res.status).toBe(200);
    expect(paymentUpdateMany).not.toHaveBeenCalled();
  });
});
