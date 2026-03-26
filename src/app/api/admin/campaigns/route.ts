import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminFromCookie } from "@/lib/auth/jwt";
import { errorResponse } from "@/lib/utils/errors";
import { createTenantLineClient } from "@/lib/line/client";
import { campaignMessage } from "@/lib/line/messages";
import { logger } from "@/lib/utils/logger";
import type { CustomerSegment } from "@prisma/client";

const MAX_MESSAGES_PER_CAMPAIGN = 200;

const VALID_SEGMENTS = ["AT_RISK", "LAPSED", "VIP", "REGULAR", "NEW", "ALL"] as const;
type CampaignSegment = (typeof VALID_SEGMENTS)[number];

/** POST /api/admin/campaigns — send a targeted push message to a customer segment */
export async function POST(request: NextRequest) {
  try {
    const admin = await getAdminFromCookie(request);
    if (!admin) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { segment, message, includeBookingButton } = body as {
      segment: CampaignSegment;
      message: string;
      includeBookingButton?: boolean;
    };

    // Validate segment
    if (!segment || !VALID_SEGMENTS.includes(segment)) {
      return Response.json(
        { error: "無效的客群分類", validSegments: VALID_SEGMENTS },
        { status: 400 }
      );
    }

    // Validate message
    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return Response.json({ error: "訊息內容不能為空" }, { status: 400 });
    }
    if (message.length > 500) {
      return Response.json({ error: "訊息內容不得超過 500 字" }, { status: 400 });
    }

    const tenantId = admin.tenantId;

    // Fetch tenant for LINE credentials and LIFF URL
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        lineAccessToken: true,
        lineChannelSecret: true,
        liffId: true,
      },
    });

    if (!tenant) {
      return Response.json({ error: "找不到商家資料" }, { status: 404 });
    }

    const liffUrl = `https://liff.line.me/${tenant.liffId}`;

    // Query users in the specified segment
    const whereClause: { tenantId: string; lineUserId?: { not: "" }; segment?: CustomerSegment } = {
      tenantId,
      lineUserId: { not: "" },
    };

    if (segment !== "ALL") {
      whereClause.segment = segment as CustomerSegment;
    }

    const users = await prisma.user.findMany({
      where: whereClause,
      select: { lineUserId: true },
      take: MAX_MESSAGES_PER_CAMPAIGN,
    });

    // Filter out users with empty/null lineUserId
    const validUsers = users.filter((u) => u.lineUserId && u.lineUserId.trim() !== "");

    if (validUsers.length === 0) {
      return Response.json({
        success: true,
        sent: 0,
        failed: 0,
        message: "該客群目前沒有可推播的用戶",
      });
    }

    // Create tenant-specific LINE client
    const lineClient = createTenantLineClient(
      tenant.lineAccessToken,
      tenant.lineChannelSecret
    );

    let sent = 0;
    let failed = 0;

    // Send messages one by one to handle individual failures gracefully
    for (const user of validUsers) {
      try {
        if (includeBookingButton) {
          const flexMsg = campaignMessage(message.trim(), liffUrl);
          await lineClient.pushMessage(user.lineUserId, flexMsg);
        } else {
          await lineClient.pushMessage(user.lineUserId, {
            type: "text",
            text: message.trim(),
          });
        }
        sent++;
      } catch (err) {
        failed++;
        logger.error(
          `Campaign push failed for user ${user.lineUserId}`,
          err,
          "campaigns"
        );
      }
    }

    logger.info("Campaign sent", "campaigns", {
      tenantId,
      segment,
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

/** GET /api/admin/campaigns — get segment counts for campaign targeting */
export async function GET(request: NextRequest) {
  try {
    const admin = await getAdminFromCookie(request);
    if (!admin) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenantId = admin.tenantId;

    // Get counts per segment (only users with valid lineUserId)
    const segmentCounts = await prisma.user.groupBy({
      by: ["segment"],
      where: {
        tenantId,
        lineUserId: { not: "" },
      },
      _count: true,
    });

    const counts: Record<string, number> = {};
    let total = 0;
    for (const s of segmentCounts) {
      counts[s.segment] = s._count;
      total += s._count;
    }
    counts["ALL"] = total;

    return Response.json({ counts });
  } catch (error) {
    return errorResponse(error);
  }
}
