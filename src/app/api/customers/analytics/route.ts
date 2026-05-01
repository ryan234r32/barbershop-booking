import { NextRequest } from "next/server";
import { errorResponse } from "@/lib/utils/errors";
import { getAdminFromCookie } from "@/lib/auth/jwt";
import { getCustomerAnalytics } from "@/lib/customers/analytics";

/** GET /api/customers/analytics — admin-only customer composition stats */
export async function GET(request: NextRequest) {
  try {
    const admin = await getAdminFromCookie(request);
    if (!admin) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    const data = await getCustomerAnalytics(admin.tenantId);
    return Response.json(data);
  } catch (error) {
    return errorResponse(error);
  }
}
