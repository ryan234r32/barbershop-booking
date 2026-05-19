import { NextRequest } from "next/server";
import { z } from "zod";
import { getAvailableSlots } from "@/lib/booking/availability";
import { errorResponse } from "@/lib/utils/errors";

const querySchema = z.object({
  tenantId: z.string().uuid().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD"),
  // V3.7 P3 (5/19) — accept either explicit slotsNeeded (preferred when client
  // has variant resolved already, e.g. LIFF already loaded /api/services with
  // variants) or fall back to looking up serviceId(s).
  slotsNeeded: z.coerce.number().int().min(1).max(12).optional(),
  serviceId: z.string().uuid("serviceId must be a valid UUID").optional(),
  serviceIds: z
    .string()
    .regex(/^[0-9a-fA-F-]{36}(,[0-9a-fA-F-]{36})*$/, "serviceIds must be a comma-separated list of UUIDs")
    .optional(),
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const params = querySchema.parse({
      tenantId: searchParams.get("tenantId") || undefined,
      date: searchParams.get("date"),
      slotsNeeded: searchParams.get("slotsNeeded") || undefined,
      serviceId: searchParams.get("serviceId") || undefined,
      serviceIds: searchParams.get("serviceIds") || undefined,
    });
    if (!params.slotsNeeded && !params.serviceId && !params.serviceIds) {
      return Response.json(
        { error: "slotsNeeded, serviceId, or serviceIds is required" },
        { status: 400 },
      );
    }
    const tenantId = params.tenantId || process.env.DEFAULT_TENANT_ID!;

    const slots = await getAvailableSlots({
      tenantId,
      date: params.date,
      slotsNeeded: params.slotsNeeded,
      serviceId: params.serviceId,
      serviceIds: params.serviceIds ? params.serviceIds.split(",") : undefined,
    });
    return Response.json({ slots });
  } catch (error) {
    return errorResponse(error);
  }
}
