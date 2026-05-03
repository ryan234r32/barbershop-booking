/**
 * V3.8 incident monitoring — periodic health check + emergency alert.
 *
 * 跑頻率：每 15 分鐘（vercel.json 排程）
 * 行為：
 *   - DB ping 失敗 → trigger emergency alert (db_unreachable)
 *   - Redis ping 失敗 → trigger emergency alert (redis_unreachable)
 *   - 兩個都 ok → 無事發生（不推播）
 *
 * 預期上線後使用方式：
 *   - 平常 cron 跑 → 輸出 200 / silent
 *   - 第三方掛掉 → 老闆 LINE 收到 alert，知道「現在系統不對勁，先別打開或請客戶稍後」
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRedis } from "@/lib/redis";
import { verifyCronSecret } from "@/lib/utils/cron-auth";
import { triggerEmergencyAlert } from "@/lib/notifications/emergency-alert";
import { pingHealthcheck } from "@/lib/notifications/healthcheck-ping";
import { logger } from "@/lib/utils/logger";

export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const checks: Record<string, { status: "ok" | "error"; latencyMs?: number }> = {};

  // Database
  const dbStart = Date.now();
  try {
    await prisma.$queryRawUnsafe("SELECT 1");
    checks.database = { status: "ok", latencyMs: Date.now() - dbStart };
  } catch (err) {
    checks.database = { status: "error", latencyMs: Date.now() - dbStart };
    logger.error("health-check: DB unreachable", err, "cron/health-check");
    void triggerEmergencyAlert({
      kind: "db_unreachable",
      summary: `Supabase DB ping 失敗。客戶預約 / admin 對帳暫時不可用。請打開 supabase status 看看。`,
    });
  }

  // Redis
  const redisStart = Date.now();
  try {
    const redis = getRedis();
    await redis.ping();
    checks.redis = { status: "ok", latencyMs: Date.now() - redisStart };
  } catch (err) {
    checks.redis = { status: "error", latencyMs: Date.now() - redisStart };
    logger.error("health-check: Redis unreachable", err, "cron/health-check");
    void triggerEmergencyAlert({
      kind: "redis_unreachable",
      summary: `Upstash Redis ping 失敗。預約 lock 機制受影響（極端 case 可能 race condition）。`,
    });
  }

  const allHealthy = Object.values(checks).every((c) => c.status === "ok");

  // V3.8: dead-man's switch — tell healthchecks.io we ran (success or fail).
  // Never await blocks the response — fire-and-forget so a slow ping can't
  // delay the cron's HTTP reply, but await here keeps logs ordered in dev.
  await pingHealthcheck(allHealthy);

  return Response.json(
    {
      status: allHealthy ? "ok" : "degraded",
      timestamp: new Date().toISOString(),
      checks,
    },
    { status: allHealthy ? 200 : 503 },
  );
}
