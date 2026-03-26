import { prisma } from "@/lib/prisma";
import { getRedis } from "@/lib/redis";

/** GET /api/health — Health check for uptime monitoring (no auth required) */
export async function GET() {
  const checks: Record<string, "ok" | "error"> = {
    database: "error",
    redis: "error",
  };

  // Check database connectivity
  try {
    await prisma.$queryRawUnsafe("SELECT 1");
    checks.database = "ok";
  } catch {
    // database unreachable
  }

  // Check Redis connectivity
  try {
    const redis = getRedis();
    await redis.ping();
    checks.redis = "ok";
  } catch {
    // redis unreachable
  }

  const allHealthy = Object.values(checks).every((v) => v === "ok");
  const status = allHealthy ? "ok" : "degraded";
  const httpStatus = allHealthy ? 200 : 503;

  return Response.json(
    {
      status,
      version: "1.1.0",
      timestamp: new Date().toISOString(),
      checks,
    },
    { status: httpStatus }
  );
}
