import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminFromCookie } from "@/lib/auth/jwt";
import { errorResponse, AppError } from "@/lib/utils/errors";

const TAG_WINNER = "LAUNCH_LOTTERY_WINNER";
const TAG_REDEEMED = "LAUNCH_LOTTERY_REDEEMED";

type RouteParams = { params: Promise<{ userId: string }> };

/** PATCH /api/admin/lottery/[userId] — toggle a winner's redeemed flag.
 *
 * Body: { redeemed: boolean }
 *
 * Only acts on users already tagged LAUNCH_LOTTERY_WINNER. Removing the
 * winner tag itself is intentionally NOT supported here — re-running the
 * draw should be the way to undo, so the audit trail is clear.
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const admin = await getAdminFromCookie(request);
    if (!admin) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { userId } = await params;
    const body = await request.json();
    const redeemed: boolean = !!body.redeemed;

    const user = await prisma.user.findFirst({
      where: { id: userId, tenantId: admin.tenantId },
      select: { id: true, tags: true },
    });
    if (!user) {
      throw new AppError("找不到此客人", 404, "NOT_FOUND");
    }
    if (!user.tags.includes(TAG_WINNER)) {
      throw new AppError("此客人不是中獎名單", 400, "NOT_WINNER");
    }

    const tags = new Set(user.tags);
    if (redeemed) tags.add(TAG_REDEEMED);
    else tags.delete(TAG_REDEEMED);

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { tags: Array.from(tags) },
      select: { id: true, tags: true },
    });

    return Response.json({
      id: updated.id,
      redeemed: updated.tags.includes(TAG_REDEEMED),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
