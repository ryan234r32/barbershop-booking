import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminFromCookie } from "@/lib/auth/jwt";
import { errorResponse, UnauthorizedError, AppError } from "@/lib/utils/errors";
import { createBindToken } from "@/lib/booking/bind-token";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * POST /api/admin/bookings/[id]/bind-token
 *
 * Admin 點「邀請客人加 LINE」時呼叫。產生 10 分鐘 TTL 的綁定 token，
 * 回傳 QR code 該指向的 URL。
 *
 * 客人掃 QR → LINE 開對話框、預填 token → 客人按傳送 →
 * webhook 認 token → user.lineUserId 從 manual-* 改成真實 LINE id。
 *
 * 前提條件：
 *   - 該 booking 必須 belong to admin's tenant
 *   - 該 booking.user.lineUserId 必須仍是 manual-* （已綁 LINE 的不需要）
 */
export async function POST(_request: NextRequest, { params }: RouteParams) {
  try {
    const admin = await getAdminFromCookie(_request);
    if (!admin) throw new UnauthorizedError();

    const { id } = await params;

    const booking = await prisma.booking.findFirst({
      where: { id, tenantId: admin.tenantId },
      include: { user: { select: { id: true, lineUserId: true, displayName: true } } },
    });
    if (!booking) {
      return Response.json({ error: "Booking not found" }, { status: 404 });
    }

    if (!booking.user.lineUserId.startsWith("manual-")) {
      throw new AppError("此客戶已綁定 LINE，不需要再產 QR", 400, "ALREADY_BOUND");
    }

    const token = await createBindToken({
      bookingId: id,
      tenantId: admin.tenantId,
    });

    // OA basic ID（例：@1008hair）— 客人掃 QR 後 LINE 會自動加好友 + 開對話、
    // 預填 token 訊息。沒設 env 則回 fallback 文字版（讓老闆口頭報 token）。
    //
    // ⚠️ LINE URL scheme 文件範例用「字面 @」(https://line.me/R/oaMessage/@linedevelopers/?Hi)
    // 不能把 @ encode 成 %40 — 否則 LINE 會 strip 找不到該帳號顯示「找不到該用戶」。
    // 我們允許 env 含或不含 @，內部正規化 → 一律 prepend 字面 @。
    const oaBasicIdRaw = process.env.LINE_OA_BASIC_ID;
    const oaBasicId = oaBasicIdRaw
      ? oaBasicIdRaw.startsWith("@")
        ? oaBasicIdRaw
        : `@${oaBasicIdRaw}`
      : null;
    const qrUrl = oaBasicId
      ? `https://line.me/R/oaMessage/${oaBasicId}/?${encodeURIComponent(token)}`
      : null;

    return Response.json({
      token,
      qrUrl,
      expiresInSeconds: 600,
      // 給 UI 顯示用 — 客戶名 + 預約資訊讓 admin 確認沒按錯
      bookingPreview: {
        customerName: booking.user.displayName ?? "未填名稱",
        date: booking.date.toISOString().slice(0, 10),
        startTime: booking.startTime,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
