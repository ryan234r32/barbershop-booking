import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { errorResponse, UnauthorizedError, AppError } from "@/lib/utils/errors";
import { verifyLiffIdToken, LiffTokenVerificationError } from "@/lib/auth/line-liff";
import { logger } from "@/lib/utils/logger";

/** POST /api/liff/init — initialize LIFF session, return user + tenant data
 *
 * Auth: requires X-LIFF-ID-Token header (LINE ID token verified server-side).
 * The body's `lineUserId` is no longer trusted — identity comes from the verified
 * token's `sub`. This closes the impersonation vector where anyone could overwrite
 * any user's profile + harvest the shop's bank account info.
 */
export async function POST(request: NextRequest) {
  try {
    const idToken = request.headers.get("x-liff-id-token");
    if (!idToken) {
      throw new UnauthorizedError("請先登入 LINE");
    }

    const channelId = process.env.LINE_CHANNEL_ID;
    if (!channelId) {
      throw new AppError("Server LINE_CHANNEL_ID not configured", 500, "CONFIG");
    }

    let verified;
    try {
      verified = await verifyLiffIdToken(idToken, channelId);
    } catch (e) {
      if (e instanceof LiffTokenVerificationError) {
        logger.warn("liff init rejected", "liff-init", { reason: e.reason });
        if (e.reason === "network") {
          throw new AppError("LINE 驗證服務暫時無法使用", 503, "LINE_VERIFY_DOWN");
        }
        throw new UnauthorizedError("LIFF 驗證失敗，請重新開啟 LINE 頁面");
      }
      throw e;
    }

    const lineUserId = verified.sub;
    const tenantId = process.env.DEFAULT_TENANT_ID!;

    // Body can still supply optional profile fields, but only for the verified user.
    const body = await request.json().catch(() => ({}));
    const displayName = verified.name || body.displayName || undefined;
    const pictureUrl = verified.picture || body.pictureUrl || undefined;

    // Get or create user
    const user = await prisma.user.upsert({
      where: {
        tenantId_lineUserId: { tenantId, lineUserId },
      },
      update: {
        displayName: displayName,
        pictureUrl: pictureUrl,
      },
      create: {
        tenantId,
        lineUserId,
        displayName,
        pictureUrl,
      },
    });

    // Tenant display info — never expose bankAccountNumber or lineAccessToken.
    // bankInfo is a free-text payment instruction shown to customers, so keep it.
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        businessName: true,
        phone: true,
        address: true,
        bankInfo: true,
        bankAccountName: true,
      },
    });

    return Response.json({ user, tenant });
  } catch (error) {
    return errorResponse(error);
  }
}
