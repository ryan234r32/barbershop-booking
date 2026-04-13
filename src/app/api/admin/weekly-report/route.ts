import { NextRequest } from "next/server";
import { getAdminFromCookie } from "@/lib/auth/jwt";
import { errorResponse } from "@/lib/utils/errors";
import { generateWeeklyReport } from "@/lib/reports/weekly-report";

/** GET /api/admin/weekly-report — generate a weekly business summary */
export async function GET(request: NextRequest) {
  try {
    const admin = await getAdminFromCookie(request);
    if (!admin) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenantId = admin.tenantId;
    const report = await generateWeeklyReport(tenantId);

    return Response.json(report);
  } catch (error) {
    return errorResponse(error);
  }
}
