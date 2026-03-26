import { NextRequest } from "next/server";
import { recalculateSegments } from "@/lib/crm/segmentation";
import { verifyCronSecret } from "@/lib/utils/cron-auth";
import { logger } from "@/lib/utils/logger";

/** GET /api/cron/at-risk — weekly CRM segmentation recalculation */
export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await recalculateSegments();
    return Response.json({ success: true, ...result });
  } catch (error) {
    logger.error("Cron at-risk segmentation failed", error, "cron/at-risk");
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}
