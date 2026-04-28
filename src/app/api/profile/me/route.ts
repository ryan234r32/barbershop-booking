import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { errorResponse, UnauthorizedError, AppError } from "@/lib/utils/errors";
import { verifyLiffIdToken, LiffTokenVerificationError } from "@/lib/auth/line-liff";
import { updateProfileSchema } from "@/lib/utils/validation";
import { logger } from "@/lib/utils/logger";

/**
 * POST /api/profile/me — customer self-service profile update.
 *
 * Auth: LIFF ID token (X-LIFF-ID-Token header). Identity comes from the verified
 * `sub`; body is never trusted for caller identity.
 *
 * Body (all optional):
 *   { phone, birthday: "YYYY-MM-DD", gender: MALE|FEMALE|OTHER|PREFER_NOT_TO_SAY,
 *     realName, legacyName }
 *
 * Legacy merge: if `legacyName` is provided AND the current user has no booking
 * history yet, look up legacy stub records (lineUserId starts with "legacy-")
 * with matching displayName. If exactly one match → transfer bookings + visit
 * stats to current user, then delete the legacy stub.
 *
 * Multiple matches or zero matches → no merge, but the legacyName is saved into
 * the user's notes for the owner to handle manually.
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
        logger.warn("profile update token rejected", "profile-me", { reason: e.reason });
        if (e.reason === "network") {
          throw new AppError("LINE 驗證服務暫時無法使用", 503, "LINE_VERIFY_DOWN");
        }
        throw new UnauthorizedError("LIFF 驗證失敗，請重新開啟 LINE 頁面");
      }
      throw e;
    }

    const lineUserId = verified.sub;
    const tenantId = process.env.DEFAULT_TENANT_ID!;
    const body = await request.json();
    const input = updateProfileSchema.parse(body);

    const phone = input.phone?.trim() || null;
    const realName = input.realName?.trim() || null;
    const gender = input.gender ?? null;
    const birthdayStr = input.birthday?.trim() || null;

    let birthday: Date | null = null;
    let birthdayMonth: number | null = null;
    let birthdayDay: number | null = null;
    if (birthdayStr) {
      const d = new Date(birthdayStr + "T00:00:00Z");
      if (Number.isNaN(d.getTime())) {
        throw new AppError("生日格式錯誤", 400, "INVALID_BIRTHDAY");
      }
      birthday = d;
      birthdayMonth = d.getUTCMonth() + 1;
      birthdayDay = d.getUTCDate();
    }

    // Ensure user record exists (in case form is opened before /api/liff/init has run).
    const me = await prisma.user.upsert({
      where: { tenantId_lineUserId: { tenantId, lineUserId } },
      update: {},
      create: {
        tenantId,
        lineUserId,
        displayName: verified.name ?? null,
        pictureUrl: verified.picture ?? null,
      },
      select: {
        id: true,
        displayName: true,
        phone: true,
        profileCompletedAt: true,
        bookings: { select: { id: true }, take: 1 },
      },
    });

    // Lottery eligibility: stamp profileCompletedAt the FIRST time a customer
    // self-fills a phone via this endpoint. Already-stamped users keep their
    // original timestamp (so re-edits don't reset their position in the window).
    const isFirstPhoneFill =
      !me.profileCompletedAt && !me.phone && phone !== null && phone !== "";

    let mergedCount = 0;
    let mergeNote: string | null = null;
    const legacyName = input.legacyName?.trim() || null;

    if (legacyName && me.bookings.length === 0) {
      const candidates = await prisma.user.findMany({
        where: {
          tenantId,
          displayName: legacyName,
          lineUserId: { startsWith: "legacy-" },
        },
        select: {
          id: true,
          firstVisitAt: true,
          lastVisitAt: true,
          totalVisits: true,
        },
      });

      if (candidates.length === 1) {
        const legacy = candidates[0];
        await prisma.$transaction(async (tx) => {
          await tx.booking.updateMany({
            where: { userId: legacy.id, tenantId },
            data: { userId: me.id },
          });
          await tx.cancellationRecord.updateMany({
            where: { userId: legacy.id },
            data: { userId: me.id },
          });
          await tx.user.update({
            where: { id: me.id },
            data: {
              firstVisitAt: legacy.firstVisitAt,
              lastVisitAt: legacy.lastVisitAt,
              totalVisits: legacy.totalVisits,
            },
          });
          await tx.user.delete({ where: { id: legacy.id } });
        });
        mergedCount = legacy.totalVisits;
        logger.info("legacy customer merged", "profile-me", {
          userId: me.id,
          legacyId: legacy.id,
          legacyName,
          totalVisits: legacy.totalVisits,
        });
      } else {
        mergeNote =
          candidates.length === 0
            ? `（自報）之前用名字：${legacyName}（無符合舊紀錄）`
            : `（自報）之前用名字：${legacyName}（有 ${candidates.length} 筆同名舊紀錄，待人工合併）`;
      }
    }

    const updated = await prisma.user.update({
      where: { id: me.id },
      data: {
        ...(phone !== null && { phone }),
        ...(realName !== null && { realName }),
        ...(gender !== null && { gender }),
        ...(birthdayStr !== null && { birthday, birthdayMonth, birthdayDay }),
        ...(isFirstPhoneFill && { profileCompletedAt: new Date() }),
        ...(mergeNote && {
          notes: mergeNote,
        }),
      },
      select: {
        id: true,
        displayName: true,
        realName: true,
        phone: true,
        birthday: true,
        gender: true,
        totalVisits: true,
      },
    });

    return Response.json({
      ok: true,
      user: updated,
      mergedCount,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
