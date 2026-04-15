import { NextResponse } from "next/server";
import { isEcpayEnabled } from "@/lib/ecpay/config";

/**
 * GET /api/payments/config
 *
 * Public, auth-free feature-flag endpoint for the LIFF payment page.
 * Returns only the single boolean the UI needs to decide whether to render
 * the Tier S (ECPay virtual account) option — no secrets, no tenant data.
 */
export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ ecpayEnabled: isEcpayEnabled() });
}
