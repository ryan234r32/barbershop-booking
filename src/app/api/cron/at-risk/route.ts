import { NextRequest } from "next/server";
import { recalculateSegments } from "@/lib/crm/segmentation";

/** GET /api/cron/at-risk — weekly CRM segmentation recalculation */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await recalculateSegments();
    return Response.json({ success: true, ...result });
  } catch (error) {
    console.error("Cron at-risk error:", error);
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}
