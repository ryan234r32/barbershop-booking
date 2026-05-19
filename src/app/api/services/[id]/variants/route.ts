import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createVariantSchema } from "@/lib/utils/validation";
import { errorResponse } from "@/lib/utils/errors";
import { getAdminFromCookie } from "@/lib/auth/jwt";

type RouteParams = { params: Promise<{ id: string }> };

/** POST /api/services/[id]/variants — create a ServiceVariant.
 *  V3.7 P3 (5/19) — auto-flips parent `hasVariants=true` on first variant.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const admin = await getAdminFromCookie(request);
    if (!admin) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const input = createVariantSchema.parse(body);

    // Tenant isolation
    const service = await prisma.service.findUnique({ where: { id } });
    if (!service || service.tenantId !== admin.tenantId) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    const slotsNeeded = Math.ceil(input.durationMin / 60);

    const [variant] = await prisma.$transaction([
      prisma.serviceVariant.create({
        data: {
          serviceId: id,
          name: input.name,
          price: input.price,
          durationMin: input.durationMin,
          slotsNeeded,
          sortOrder: input.sortOrder ?? 0,
        },
      }),
      // Auto-flip parent hasVariants=true if it was false
      ...(service.hasVariants
        ? []
        : [
            prisma.service.update({
              where: { id },
              data: { hasVariants: true },
            }),
          ]),
    ]);

    return Response.json({ variant }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
