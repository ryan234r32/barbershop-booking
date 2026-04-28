import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminFromCookie } from "@/lib/auth/jwt";
import { errorResponse, AppError } from "@/lib/utils/errors";
import { logger } from "@/lib/utils/logger";

const TAG_WINNER = "LAUNCH_LOTTERY_WINNER";
const TAG_NOTIFIED = "LAUNCH_LOTTERY_NOTIFIED";
const TAG_REDEEMED = "LAUNCH_LOTTERY_REDEEMED";

/** Lottery activity window — env-controlled. Defaults to a reasonable
 * 14-day window from now if env vars are missing (so the page works in dev). */
function getLotteryWindow(): { start: Date; end: Date } {
  const startEnv = process.env.LOTTERY_START_AT;
  const endEnv = process.env.LOTTERY_END_AT;
  if (startEnv && endEnv) {
    return { start: new Date(startEnv), end: new Date(endEnv) };
  }
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(start);
  end.setDate(start.getDate() + 14);
  return { start, end };
}

/** GET /api/admin/lottery
 *
 * Returns full lottery state:
 *   - window (start / end / closed)
 *   - eligible count and sample (first 5)
 *   - winners with notification + redemption state
 */
export async function GET(request: NextRequest) {
  try {
    const admin = await getAdminFromCookie(request);
    if (!admin) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { start, end } = getLotteryWindow();

    const eligibleWhere = {
      tenantId: admin.tenantId,
      profileCompletedAt: { gte: start, lte: end },
      NOT: { tags: { has: TAG_WINNER } },
    };

    const [eligibleCount, eligibleSample, winners] = await Promise.all([
      prisma.user.count({ where: eligibleWhere }),
      prisma.user.findMany({
        where: eligibleWhere,
        select: {
          id: true,
          displayName: true,
          realName: true,
          phone: true,
          profileCompletedAt: true,
        },
        orderBy: { profileCompletedAt: "desc" },
        take: 5,
      }),
      prisma.user.findMany({
        where: { tenantId: admin.tenantId, tags: { has: TAG_WINNER } },
        select: {
          id: true,
          lineUserId: true,
          displayName: true,
          realName: true,
          phone: true,
          profileCompletedAt: true,
          tags: true,
          updatedAt: true,
        },
        orderBy: { updatedAt: "desc" },
      }),
    ]);

    return Response.json({
      window: {
        start: start.toISOString(),
        end: end.toISOString(),
        closed: new Date() > end,
      },
      eligibleCount,
      eligibleSample,
      winners: winners.map((w) => ({
        id: w.id,
        displayName: w.displayName,
        realName: w.realName,
        phone: w.phone,
        notified: w.tags.includes(TAG_NOTIFIED),
        redeemed: w.tags.includes(TAG_REDEEMED),
      })),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

/** POST /api/admin/lottery/draw — pick N random winners (default 5)
 *
 * Body: { count?: number }
 *
 * Uses Postgres `ORDER BY random()` for fair sampling. Tags selected users
 * with LAUNCH_LOTTERY_WINNER. Idempotent re-draws would never re-select the
 * same person (already-tagged users excluded from the eligible pool).
 */
export async function POST(request: NextRequest) {
  try {
    const admin = await getAdminFromCookie(request);
    if (!admin) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const count = Math.max(1, Math.min(20, Number(body.count) || 5));

    const { start, end } = getLotteryWindow();

    // Postgres random sampling — Prisma doesn't support ORDER BY random() natively.
    const winnerIds = await prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM users
      WHERE tenant_id = ${admin.tenantId}
        AND profile_completed_at >= ${start}
        AND profile_completed_at <= ${end}
        AND NOT (${TAG_WINNER} = ANY(tags))
      ORDER BY random()
      LIMIT ${count}
    `;

    if (winnerIds.length === 0) {
      throw new AppError("沒有符合資格的客人可以抽獎", 400, "NO_ELIGIBLE");
    }

    const ids = winnerIds.map((w) => w.id);
    await prisma.user.updateMany({
      where: { id: { in: ids } },
      data: { tags: { push: TAG_WINNER } },
    });

    const winners = await prisma.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, displayName: true, realName: true, phone: true },
    });

    logger.info("lottery draw", "lottery", {
      tenantId: admin.tenantId,
      count: winners.length,
      ids,
    });

    return Response.json({ winners });
  } catch (error) {
    return errorResponse(error);
  }
}
