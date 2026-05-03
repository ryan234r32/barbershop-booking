/**
 * V3.8 incident response: admin「報告問題」按鈕後端。
 *
 * 流程：
 *   1. admin 在 admin 頁右下角點「⚠️ 報告問題」
 *   2. 跳 modal 描述問題 + 自動帶上 URL / userAgent / admin name
 *   3. 送到此 endpoint
 *   4. POST 收到後 → console.log + 推 LINE 給 DEV_LINE_USER_ID
 *      （沒設則 fallback 推給 ADMIN_LINE_USER_ID 自己 — 至少老闆知道訊息收到）
 *
 * 不存 DB 因為這是「快速通報通道」，dev 該即時看 LINE 處理。
 * 想存 audit trail 的話 console.log 會被 Vercel logs / Sentry breadcrumb
 * 抓到，已經有 trail 了。
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { getAdminFromCookie } from "@/lib/auth/jwt";
import { errorResponse, UnauthorizedError } from "@/lib/utils/errors";
import { getLineClient } from "@/lib/line/client";
import { logger } from "@/lib/utils/logger";

const ReportSchema = z.object({
  description: z.string().min(1).max(500),
  url: z.string().min(1).max(500),
  userAgent: z.string().max(500).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const adminAuth = await getAdminFromCookie(request);
    if (!adminAuth) throw new UnauthorizedError();

    const body = await request.json();
    const parsed = ReportSchema.parse(body);

    // 把 adminId 換成顯示名 (JWT payload 沒有 name，要查 DB)
    const { prisma } = await import("@/lib/prisma");
    const admin = await prisma.adminUser.findUnique({
      where: { id: adminAuth.adminId },
      select: { name: true, email: true },
    });
    const adminLabel = admin?.name ?? admin?.email ?? `admin#${adminAuth.adminId.slice(0, 8)}`;

    // 1. structured log（Vercel 抓得到 + Sentry breadcrumb）
    logger.info(
      `[issue-report] admin=${adminLabel} url=${parsed.url} desc="${parsed.description.slice(0, 80)}"`,
      "report-issue",
    );

    // 2. push 給 dev (or fallback admin)
    const devLineUserId = process.env.DEV_LINE_USER_ID;
    const adminLineUserId = process.env.ADMIN_LINE_USER_ID;
    const target = devLineUserId ?? adminLineUserId;

    if (target) {
      const text = [
        "🐛 系統異常回報",
        "",
        `回報人：${adminLabel}`,
        `頁面：${parsed.url}`,
        "",
        "問題描述：",
        parsed.description,
        "",
        parsed.userAgent ? `裝置：${parsed.userAgent.slice(0, 100)}` : "",
        `⏰ ${new Date().toLocaleString("zh-TW", { timeZone: "Asia/Taipei" })}`,
      ]
        .filter(Boolean)
        .join("\n");
      try {
        const client = getLineClient();
        await client.pushMessage(target, { type: "text", text });
      } catch (err) {
        // Don't surface to admin — log + return 200 so the button still feels
        // responsive. Vercel logs catch the failure for dev to review.
        logger.error(
          "report-issue LINE push failed",
          err instanceof Error ? err : new Error(String(err)),
          "report-issue",
        );
      }
    }

    return Response.json({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}
