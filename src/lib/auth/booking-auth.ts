/**
 * Unified auth guard for booking creation.
 *
 * POST /api/bookings accepts two caller types:
 *   1. Admin: authenticated via admin_token cookie or Authorization: Bearer header
 *      (existing JWT). Identity = { type:"admin", adminId, tenantId }.
 *   2. LIFF customer: authenticated via X-LIFF-ID-Token header, verified against
 *      LINE's oauth2/v2.1/verify endpoint. Identity = { type:"liff", lineUserId,
 *      tenantId, displayName? }.
 *
 * Anything else throws UnauthorizedError (→ 401).
 */

import { NextRequest } from "next/server";
import { getAdminFromCookie } from "./jwt";
import { verifyLiffIdToken, LiffTokenVerificationError } from "./line-liff";
import { UnauthorizedError, AppError } from "@/lib/utils/errors";
import { logger } from "@/lib/utils/logger";

export type BookingAuth =
  | {
      type: "admin";
      adminId: string;
      tenantId: string;
    }
  | {
      type: "liff";
      lineUserId: string;
      displayName?: string;
      tenantId: string;
    };

/**
 * Resolution order:
 *   1. Admin cookie/Bearer → admin identity (fast, local JWT verify)
 *   2. X-LIFF-ID-Token header → LIFF identity (slower, hits LINE API)
 *   3. Neither → UnauthorizedError
 */
export async function requireBookingAuth(request: NextRequest): Promise<BookingAuth> {
  // 1. Try admin auth first (local, fast)
  const admin = await getAdminFromCookie(request);
  if (admin) {
    return { type: "admin", adminId: admin.adminId, tenantId: admin.tenantId };
  }

  // 2. Try LIFF ID token
  const liffToken = request.headers.get("x-liff-id-token");
  if (liffToken) {
    const channelId = process.env.LINE_CHANNEL_ID;
    if (!channelId) {
      throw new AppError("Server LINE_CHANNEL_ID not configured", 500, "CONFIG");
    }
    try {
      const payload = await verifyLiffIdToken(liffToken, channelId);
      const tenantId = process.env.DEFAULT_TENANT_ID!;
      return {
        type: "liff",
        lineUserId: payload.sub,
        displayName: payload.name,
        tenantId,
      };
    } catch (e) {
      if (e instanceof LiffTokenVerificationError) {
        logger.warn("liff token rejected", "booking-auth", { reason: e.reason });
        if (e.reason === "network") {
          throw new AppError("LINE 驗證服務暫時無法使用", 503, "LINE_VERIFY_DOWN");
        }
        throw new UnauthorizedError("LIFF 驗證失敗，請重新開啟 LINE 頁面");
      }
      throw e;
    }
  }

  throw new UnauthorizedError();
}

/**
 * Require that the authenticated caller is allowed to modify the given booking.
 * - Admin: must be for the same tenant as the booking.
 * - LIFF customer: must be the booking's owner (lineUserId match).
 * Throws UnauthorizedError otherwise.
 */
export function requireBookingOwnership(
  auth: BookingAuth,
  booking: { tenantId: string; user: { lineUserId: string } }
): void {
  if (auth.type === "admin") {
    if (auth.tenantId !== booking.tenantId) {
      throw new UnauthorizedError("無權存取此預約");
    }
    return;
  }
  // LIFF: must own the booking
  if (auth.lineUserId !== booking.user.lineUserId) {
    throw new UnauthorizedError("無權存取此預約");
  }
}

/**
 * Require the caller to be admin. Use on endpoints that should never be
 * callable by customers (e.g. marking a booking as completed / no-show).
 */
export function requireAdmin(auth: BookingAuth): asserts auth is Extract<
  BookingAuth,
  { type: "admin" }
> {
  if (auth.type !== "admin") {
    throw new UnauthorizedError("僅限店家人員操作");
  }
}
