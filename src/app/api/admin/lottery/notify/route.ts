import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminFromCookie } from "@/lib/auth/jwt";
import { errorResponse } from "@/lib/utils/errors";
import { createTenantLineClient } from "@/lib/line/client";
import { lotteryWinnerMessage } from "@/lib/line/messages";
import { logger } from "@/lib/utils/logger";

const TAG_WINNER = "LAUNCH_LOTTERY_WINNER";
const TAG_NOTIFIED = "LAUNCH_LOTTERY_NOTIFIED";

/** POST /api/admin/lottery/notify
 *
 * Pushes a Flex congratulations to every winner who hasn't been notified yet.
 * Marks each successful push with LAUNCH_LOTTERY_NOTIFIED. Skips fake legacy
 * accounts (lineUserId starts with "legacy-") because those have no real
 * LINE user to push to — those would have been merged when they self-served.
 */
export async function POST(request: NextRequest) {
  try {
    const admin = await getAdminFromCookie(request);
    if (!admin) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const tenant = await prisma.tenant.findUnique({
      where: { id: admin.tenantId },
      select: {
        lineAccessToken: true,
        lineChannelSecret: true,
        businessName: true,
      },
    });
    if (!tenant) {
      return Response.json({ error: "Tenant not found" }, { status: 404 });
    }

    const winnersToNotify = await prisma.user.findMany({
      where: {
        tenantId: admin.tenantId,
        tags: { has: TAG_WINNER },
        NOT: { tags: { has: TAG_NOTIFIED } },
      },
      select: { id: true, lineUserId: true, displayName: true },
    });

    const lineClient = createTenantLineClient(
      tenant.lineAccessToken,
      tenant.lineChannelSecret,
    );
    const message = lotteryWinnerMessage({
      shopName: tenant.businessName,
    });

    let sent = 0;
    let skipped = 0;
    let failed = 0;

    for (const winner of winnersToNotify) {
      if (winner.lineUserId.startsWith("legacy-")) {
        skipped++;
        continue;
      }
      try {
        await lineClient.pushMessage(winner.lineUserId, message);
        await prisma.user.update({
          where: { id: winner.id },
          data: { tags: { push: TAG_NOTIFIED } },
        });
        sent++;
      } catch (err) {
        failed++;
        logger.error("lottery notify failed", "lottery", {
          userId: winner.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return Response.json({ sent, skipped, failed });
  } catch (error) {
    return errorResponse(error);
  }
}
