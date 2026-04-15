import { NextRequest, NextResponse } from "next/server";
import { isEcpayEnabled } from "@/lib/ecpay/config";
import { getAdminFromCookie } from "@/lib/auth/jwt";

/**
 * GET /api/payments/config?lineUserId=U...
 *
 * Public, auth-free feature-flag endpoint for the LIFF payment page.
 * Returns only the single boolean the UI needs to decide whether to render
 * the Tier S (ECPay virtual account) option — no secrets, no tenant data.
 *
 * Allowlist semantics:
 *   - `ECPAY_ENABLED=false` (or config missing) → always false
 *   - `ECPAY_ALLOWED_USER_IDS` empty/unset    → enabled for everyone
 *     (normal post-GA state)
 *   - `ECPAY_ALLOWED_USER_IDS` set            → only listed LINE user IDs get true
 *     (dogfood-in-prod mode; comma-separated, whitespace tolerated)
 *
 * The `lineUserId` query param is the LIFF user's profile ID. We do not verify
 * the ID token here — this is a feature-visibility probe, not an auth gate.
 * Spoofing the ID only reveals that the *supplied* ID is allowlisted; actual
 * order creation still requires requireBookingAuth.
 */
export const runtime = "nodejs";

function parseAllowlist(raw: string | undefined): Set<string> | null {
  if (!raw) return null;
  const ids = raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return ids.length === 0 ? null : new Set(ids);
}

export async function GET(request: NextRequest) {
  const baseEnabled = isEcpayEnabled();
  if (!baseEnabled) {
    return NextResponse.json({ ecpayEnabled: false });
  }

  // Authenticated admins always see the feature (trusted operator context).
  // This keeps /admin/payments' ATM tab working during dogfood without needing
  // the admin's LINE userId in the allowlist.
  const admin = await getAdminFromCookie(request);
  if (admin) {
    return NextResponse.json({ ecpayEnabled: true });
  }

  const allowlist = parseAllowlist(process.env.ECPAY_ALLOWED_USER_IDS);
  if (!allowlist) {
    return NextResponse.json({ ecpayEnabled: true });
  }

  const lineUserId = request.nextUrl.searchParams.get("lineUserId") ?? "";
  return NextResponse.json({ ecpayEnabled: allowlist.has(lineUserId) });
}
