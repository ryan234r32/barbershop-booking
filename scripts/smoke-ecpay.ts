/**
 * ECPay Tier S 煙霧測試 — 打通 PR1/2/3 整個自動對帳流程
 *
 * 跑法：
 *   1. 確認 dev server 已啟動 (http://localhost:3000)
 *   2. 確認 .env.local 已加 ECPAY_* sandbox 變數
 *   3. npx tsx scripts/smoke-ecpay.ts
 *
 * 驗收檢查點：
 *   [A] create-order 回傳 HTML form (含 CheckMacValue)
 *   [B] DB 已有 Payment(AWAITING_BANK) + ECPayOrder(PENDING)
 *   [C] PaymentInfoURL webhook 處理後 vAccount 寫入
 *   [D] ReturnURL webhook (正確金額) 標 PAID + Payment=RECEIVED
 *   [E] ReturnURL webhook (錯誤金額) 不變更狀態 + 建立 admin alert Notification
 *   [F] idempotency: 同樣 ReturnURL 第二次送，狀態不變、不重複 enqueue notification
 */

import "dotenv/config";
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local", override: true });

import { prisma } from "../src/lib/prisma";
import { signAdminToken } from "../src/lib/auth/jwt";

const BASE = "http://localhost:3000";
const TENANT_ID = process.env.DEFAULT_TENANT_ID!;


// 染成色的 console 輸出
const c = {
  ok: (s: string) => console.log(`\x1b[32m✓\x1b[0m ${s}`),
  fail: (s: string) => console.log(`\x1b[31m✗\x1b[0m ${s}`),
  info: (s: string) => console.log(`\x1b[36m›\x1b[0m ${s}`),
  warn: (s: string) => console.log(`\x1b[33m!\x1b[0m ${s}`),
};

async function assert(label: string, cond: boolean, detail?: unknown) {
  if (cond) c.ok(label);
  else {
    c.fail(label);
    if (detail !== undefined) console.log("  detail:", detail);
  }
  return cond;
}

async function signFormParams(params: Record<string, string>): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const ECPayPayment = require("ecpay_aio_nodejs");
  const client = new ECPayPayment({
    OperationMode: "Test",
    MercProfile: {
      MerchantID: process.env.ECPAY_MERCHANT_ID!,
      HashKey: process.env.ECPAY_HASH_KEY!,
      HashIV: process.env.ECPAY_HASH_IV!,
    },
    IgnorePayment: [],
    IsProjectContractor: false,
  });
  return (
    client.payment_client.helper.gen_chk_mac_value as (p: Record<string, string>) => string
  )(params);
}

async function postForm(url: string, params: Record<string, string>): Promise<Response> {
  const body = new URLSearchParams(params).toString();
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
}

async function main() {
  c.info(`Base URL: ${BASE}`);
  c.info(`Tenant:   ${TENANT_ID}`);

  // --- Prep: 找一個 admin + 建一個測試預約 ---
  const admin = await prisma.adminUser.findFirst({
    where: { tenantId: TENANT_ID, isActive: true },
  });
  if (!admin) throw new Error("No active admin found — can't auth");
  c.ok(`Admin found: ${admin.email}`);

  const service = await prisma.service.findFirst({
    where: { tenantId: TENANT_ID, isActive: true },
  });
  if (!service) throw new Error("No active service");
  c.ok(`Service: ${service.name} @ NT$${service.price}`);

  // Use a realistic (non-manual-) lineUserId so the webhook's customer-notify
  // branch fires. Real LINE userIds start with "U" + 32 hex; we fake that shape.
  const testLineUserId = `Usmokecust${Date.now().toString(16).padStart(22, "0")}`;
  const user = await prisma.user.upsert({
    where: { tenantId_lineUserId: { tenantId: TENANT_ID, lineUserId: testLineUserId } },
    create: {
      tenantId: TENANT_ID,
      lineUserId: testLineUserId,
      displayName: "煙霧測試客戶",
    },
    update: {},
  });

  // 建立一筆測試 booking（預約明天）
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);

  const booking = await prisma.booking.create({
    data: {
      tenantId: TENANT_ID,
      userId: user.id,
      serviceId: service.id,
      date: tomorrow,
      startTime: "14:00",
      endTime: `${14 + service.slotsNeeded}:00`.padStart(5, "0"),
      slotsOccupied: service.slotsNeeded,
      status: "CONFIRMED",
      source: "ADMIN",
    },
  });
  c.ok(`Test booking created: ${booking.id}`);

  const adminJwt = signAdminToken({
    adminId: admin.id,
    tenantId: admin.tenantId,
    role: admin.role,
  });
  const authHeaders = { Authorization: `Bearer ${adminJwt}` };

  // === [A] create-order ===
  console.log("\n--- [A] POST /api/payments/[id]/ecpay/create-order ---");
  const createRes = await fetch(
    `${BASE}/api/payments/${booking.id}/ecpay/create-order`,
    { method: "POST", headers: authHeaders },
  );
  const createBody = (await createRes.json().catch(() => ({}))) as {
    html?: string;
    merchantTradeNo?: string;
    amount?: number;
    error?: string;
  };
  await assert(
    `[A] create-order returns 201 + html`,
    createRes.status === 201 && typeof createBody.html === "string" && createBody.html.includes("<form"),
    { status: createRes.status, body: createBody },
  );
  await assert(
    `[A] html contains CheckMacValue`,
    createBody.html?.includes("CheckMacValue") ?? false,
  );
  const mtn = createBody.merchantTradeNo;
  if (!mtn) {
    c.fail("Missing merchantTradeNo — aborting remaining checks");
    return;
  }
  c.info(`merchantTradeNo=${mtn}, amount=${createBody.amount}`);

  // === [B] DB state check ===
  console.log("\n--- [B] DB state after create-order ---");
  const payment1 = await prisma.payment.findUnique({ where: { bookingId: booking.id } });
  await assert(
    `[B] Payment.status === AWAITING_BANK`,
    payment1?.status === "AWAITING_BANK",
    payment1,
  );
  const order1 = await prisma.eCPayOrder.findUnique({ where: { merchantTradeNo: mtn } });
  await assert(
    `[B] ECPayOrder.status === PENDING`,
    order1?.status === "PENDING",
    order1,
  );

  // === [C] Simulate PaymentInfoURL webhook ===
  console.log("\n--- [C] Simulate PaymentInfoURL webhook ---");
  const payInfoParams: Record<string, string> = {
    MerchantID: process.env.ECPAY_MERCHANT_ID!,
    MerchantTradeNo: mtn,
    RtnCode: "2",
    RtnMsg: "Get VirtualAccount Succeeded",
    TradeNo: "2604150002SMOKE",
    TradeAmt: String(createBody.amount),
    PaymentType: "ATM_BOT",
    TradeDate: "2026/04/15 14:30:00",
    BankCode: "806",
    vAccount: "1234567890",
    ExpireDate: "2026/04/16",
    StoreID: "",
    CustomField1: "",
    CustomField2: "",
    CustomField3: "",
    CustomField4: "",
  };
  payInfoParams.CheckMacValue = await signFormParams(payInfoParams);
  const payInfoRes = await postForm(
    `${BASE}/api/webhooks/ecpay/payment-info`,
    payInfoParams,
  );
  const payInfoBody = await payInfoRes.text();
  await assert(
    `[C] PaymentInfoURL returns "1|OK"`,
    payInfoBody.trim() === "1|OK",
    { status: payInfoRes.status, body: payInfoBody },
  );
  const order2 = await prisma.eCPayOrder.findUnique({ where: { merchantTradeNo: mtn } });
  await assert(
    `[C] ECPayOrder.vAccount written`,
    order2?.vAccount === "1234567890",
    { vAccount: order2?.vAccount, bankCode: order2?.bankCode },
  );

  // === [D] ReturnURL webhook (correct amount → PAID) ===
  console.log("\n--- [D] Simulate ReturnURL webhook (正確金額) ---");
  const notifBefore = await prisma.notification.count({
    where: { messagePayload: { path: ["bookingId"], equals: booking.id } },
  });

  const returnParams: Record<string, string> = {
    MerchantID: process.env.ECPAY_MERCHANT_ID!,
    MerchantTradeNo: mtn,
    RtnCode: "1",
    RtnMsg: "交易成功",
    TradeNo: "2604150002SMOKE",
    TradeAmt: String(createBody.amount),
    PaymentDate: "2026/04/15 15:00:00",
    PaymentType: "ATM_BOT",
    PaymentTypeChargeFee: "10",
    TradeDate: "2026/04/15 14:30:00",
    SimulatePaid: "0",
    StoreID: "",
    CustomField1: "",
    CustomField2: "",
    CustomField3: "",
    CustomField4: "",
  };
  returnParams.CheckMacValue = await signFormParams(returnParams);
  const retRes = await postForm(`${BASE}/api/webhooks/ecpay/return`, returnParams);
  const retBody = await retRes.text();
  await assert(
    `[D] Return returns "1|OK"`,
    retBody.trim() === "1|OK",
    { status: retRes.status, body: retBody },
  );
  const order3 = await prisma.eCPayOrder.findUnique({ where: { merchantTradeNo: mtn } });
  const payment3 = await prisma.payment.findUnique({ where: { bookingId: booking.id } });
  await assert(`[D] ECPayOrder.status === PAID`, order3?.status === "PAID", order3?.status);
  await assert(`[D] Payment.status === RECEIVED`, payment3?.status === "RECEIVED", payment3?.status);

  const notifAfter = await prisma.notification.count({
    where: { messagePayload: { path: ["bookingId"], equals: booking.id } },
  });
  await assert(
    `[D] Notifications enqueued (≥1)`,
    notifAfter > notifBefore,
    { before: notifBefore, after: notifAfter },
  );

  // === [E] Amount-mismatch on FRESH order ===
  console.log("\n--- [E] Amount-mismatch guard (create second order, send wrong amount) ---");
  // Build a second order with a different merchantTradeNo
  const booking2 = await prisma.booking.create({
    data: {
      tenantId: TENANT_ID,
      userId: user.id,
      serviceId: service.id,
      date: tomorrow,
      startTime: "16:00",
      endTime: `${16 + service.slotsNeeded}:00`.padStart(5, "0"),
      slotsOccupied: service.slotsNeeded,
      status: "CONFIRMED",
      source: "ADMIN",
    },
  });
  const createRes2 = await fetch(
    `${BASE}/api/payments/${booking2.id}/ecpay/create-order`,
    { method: "POST", headers: authHeaders },
  );
  const createBody2 = (await createRes2.json()) as { html: string; merchantTradeNo: string; amount: number };
  const mtn2 = createBody2.merchantTradeNo;

  const mismatchParams: Record<string, string> = {
    ...returnParams,
    MerchantTradeNo: mtn2,
    TradeAmt: String(createBody2.amount + 9999), // wrong!
    TradeNo: "2604150999SMOKE",
  };
  delete (mismatchParams as Record<string, string>).CheckMacValue;
  mismatchParams.CheckMacValue = await signFormParams(mismatchParams);

  const alertNotifBefore = await prisma.notification.count({
    where: { messagePayload: { path: ["kind"], equals: "ecpay_amount_mismatch" } },
  });
  const mmRes = await postForm(`${BASE}/api/webhooks/ecpay/return`, mismatchParams);
  const mmBody = await mmRes.text();
  const order4 = await prisma.eCPayOrder.findUnique({ where: { merchantTradeNo: mtn2 } });
  const payment4 = await prisma.payment.findUnique({ where: { bookingId: booking2.id } });
  await assert(
    `[E] Amount-mismatch still ACKs 1|OK (避免 ECPay retry)`,
    mmBody.trim() === "1|OK",
    mmBody,
  );
  await assert(
    `[E] ECPayOrder.status NOT PAID (still PENDING)`,
    order4?.status === "PENDING",
    order4?.status,
  );
  await assert(
    `[E] Payment.status NOT RECEIVED`,
    payment4?.status === "AWAITING_BANK",
    payment4?.status,
  );
  const alertNotifAfter = await prisma.notification.count({
    where: { messagePayload: { path: ["kind"], equals: "ecpay_amount_mismatch" } },
  });
  await assert(
    `[E] Admin alert Notification enqueued`,
    alertNotifAfter > alertNotifBefore,
    { before: alertNotifBefore, after: alertNotifAfter },
  );

  // === [F] Idempotency on ReturnURL ===
  console.log("\n--- [F] Idempotency: resend Return for the already-PAID order ---");
  const idempotentRes = await postForm(`${BASE}/api/webhooks/ecpay/return`, returnParams);
  const idempotentBody = await idempotentRes.text();
  await assert(`[F] Second Return returns "1|OK"`, idempotentBody.trim() === "1|OK");
  const notifAfterIdempotent = await prisma.notification.count({
    where: { messagePayload: { path: ["bookingId"], equals: booking.id } },
  });
  await assert(
    `[F] No duplicate Notifications created`,
    notifAfterIdempotent === notifAfter,
    { first: notifAfter, second: notifAfterIdempotent },
  );

  // === Cleanup ===
  console.log("\n--- Cleanup ---");
  await prisma.notification.deleteMany({
    where: {
      OR: [
        { messagePayload: { path: ["bookingId"], equals: booking.id } },
        { messagePayload: { path: ["bookingId"], equals: booking2.id } },
      ],
    },
  });
  await prisma.eCPayOrder.deleteMany({
    where: { bookingId: { in: [booking.id, booking2.id] } },
  });
  await prisma.payment.deleteMany({
    where: { bookingId: { in: [booking.id, booking2.id] } },
  });
  await prisma.booking.deleteMany({ where: { id: { in: [booking.id, booking2.id] } } });
  await prisma.user.delete({ where: { id: user.id } });
  c.ok("cleaned up test records");

  console.log("\n=== 煙霧測試完成 ===");
}

main()
  .catch((e) => {
    console.error("\n\x1b[31mSMOKE FAILED:\x1b[0m", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
