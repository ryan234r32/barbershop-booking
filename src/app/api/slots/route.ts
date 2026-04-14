import { NextRequest } from "next/server";
import { z } from "zod";
import { getAvailableSlots } from "@/lib/booking/availability";
import { errorResponse } from "@/lib/utils/errors";

const querySchema = z.object({
  tenantId: z.string().uuid().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD"),
  serviceId: z.string().uuid("serviceId must be a valid UUID"),
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    // Zod throws on invalid input — errorResponse turns that into 400 with field-level issues.
    const params = querySchema.parse({
      tenantId: searchParams.get("tenantId") || undefined,
      date: searchParams.get("date"),
      serviceId: searchParams.get("serviceId"),
    });
    const tenantId = params.tenantId || process.env.DEFAULT_TENANT_ID!;

    const slots = await getAvailableSlots({
      tenantId,
      date: params.date,
      serviceId: params.serviceId,
    });
    return Response.json({ slots });
  } catch (error) {
    return errorResponse(error);
  }
}
