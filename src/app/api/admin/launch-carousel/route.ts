import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminFromCookie } from "@/lib/auth/jwt";
import { errorResponse } from "@/lib/utils/errors";
import { createTenantLineClient } from "@/lib/line/client";
import { launchCarouselMessage } from "@/lib/line/messages";
import { logger } from "@/lib/utils/logger";

const HARD_CAP = 1000;

/**
 * POST /api/admin/launch-carousel
 *
 * One-shot switch-day broadcast: pushes the launch Flex Carousel to every
 * LINE friend (subject to HARD_CAP). Body accepts an optional `dryRun` flag
 * which skips the actual push but reports who would receive it.
 *
 * Use sparingly — sending duplicates trains users to ignore broadcasts.
 */
export async function POST(request: NextRequest) {
  try {
    const admin = await getAdminFromCookie(request);
    if (!admin) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const dryRun: boolean = body?.dryRun === true;

    const tenant = await prisma.tenant.findUnique({
      where: { id: admin.tenantId },
      select: {
        businessName: true,
        phone: true,
        liffId: true,
        lineAccessToken: true,
        lineChannelSecret: true,
      },
    });

    if (!tenant || !tenant.liffId || !tenant.lineAccessToken) {
      return Response.json(
        { error: "商家 LINE / LIFF 設定不完整" },
        { status: 400 }
      );
    }

    const users = await prisma.user.findMany({
      where: {
        tenantId: admin.tenantId,
        lineUserId: { not: "" },
      },
      select: { lineUserId: true },
      take: HARD_CAP,
    });

    const validUsers = users.filter((u) => {
      const id = u.lineUserId.trim();
      return id !== "" && !id.startsWith("manual-") && !id.startsWith("legacy-");
    });

    if (dryRun) {
      return Response.json({
        success: true,
        dryRun: true,
        wouldSend: validUsers.length,
      });
    }

    if (validUsers.length === 0) {
      return Response.json({
        success: true,
        sent: 0,
        failed: 0,
        message: "沒有可推播的用戶",
      });
    }

    const flexMsg = launchCarouselMessage({
      shopName: tenant.businessName,
      liffBaseUrl: `https://liff.line.me/${tenant.liffId}`,
      shopPhone: tenant.phone || "",
    });

    const lineClient = createTenantLineClient(
      tenant.lineAccessToken,
      tenant.lineChannelSecret
    );

    let sent = 0;
    let failed = 0;
    for (const u of validUsers) {
      try {
        await lineClient.pushMessage(u.lineUserId, flexMsg);
        sent++;
      } catch (err) {
        failed++;
        logger.error(
          `Launch carousel push failed for user ${u.lineUserId}`,
          err,
          "launch-carousel"
        );
      }
    }

    logger.info("Launch carousel broadcast complete", "launch-carousel", {
      tenantId: admin.tenantId,
      sent,
      failed,
      total: validUsers.length,
    });

    return Response.json({
      success: true,
      sent,
      failed,
      total: validUsers.length,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
