import { NextRequest } from "next/server";
import { getAvailableSlots } from "@/lib/booking/availability";
import { errorResponse } from "@/lib/utils/errors";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const tenantId = searchParams.get("tenantId") || process.env.DEFAULT_TENANT_ID!;
    const date = searchParams.get("date");
    const serviceId = searchParams.get("serviceId");

    if (!date || !serviceId) {
      return Response.json(
        { error: "date and serviceId are required" },
        { status: 400 }
      );
    }

    const slots = await getAvailableSlots({ tenantId, date, serviceId });
    return Response.json({ slots });
  } catch (error) {
    return errorResponse(error);
  }
}
