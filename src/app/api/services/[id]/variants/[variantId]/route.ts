import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { updateVariantSchema } from "@/lib/utils/validation";
import { errorResponse } from "@/lib/utils/errors";
import { getAdminFromCookie } from "@/lib/auth/jwt";

type RouteParams = { params: Promise<{ id: string; variantId: string }> };

/** PATCH /api/services/[id]/variants/[variantId] — update a variant */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const admin = await getAdminFromCookie(request);
    if (!admin) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, variantId } = await params;
    const body = await request.json();
    const input = updateVariantSchema.parse(body);

    // Tenant + parent isolation
    const variant = await prisma.serviceVariant.findUnique({
      where: { id: variantId },
      include: { service: { select: { id: true, tenantId: true } } },
    });
    if (
      !variant ||
      variant.serviceId !== id ||
      variant.service.tenantId !== admin.tenantId
    ) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    const data: {
      name?: string;
      price?: number;
      durationMin?: number;
      slotsNeeded?: number;
      sortOrder?: number;
    } = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.price !== undefined) data.price = input.price;
    if (input.durationMin !== undefined) {
      data.durationMin = input.durationMin;
      data.slotsNeeded = Math.ceil(input.durationMin / 60);
    }
    if (input.sortOrder !== undefined) data.sortOrder = input.sortOrder;

    const updated = await prisma.serviceVariant.update({
      where: { id: variantId },
      data,
    });

    return Response.json({ variant: updated });
  } catch (error) {
    return errorResponse(error);
  }
}

/** DELETE /api/services/[id]/variants/[variantId] — hard delete if 0
 *  bookings reference, else soft delete (isActive=false).
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const admin = await getAdminFromCookie(request);
    if (!admin) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, variantId } = await params;

    const variant = await prisma.serviceVariant.findUnique({
      where: { id: variantId },
      include: { service: { select: { id: true, tenantId: true } } },
    });
    if (
      !variant ||
      variant.serviceId !== id ||
      variant.service.tenantId !== admin.tenantId
    ) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    const referencedCount = await prisma.bookingService.count({
      where: { variantId },
    });

    if (referencedCount > 0) {
      const updated = await prisma.serviceVariant.update({
        where: { id: variantId },
        data: { isActive: false },
      });
      return Response.json({ variant: updated, deleted: "soft" });
    }

    await prisma.serviceVariant.delete({ where: { id: variantId } });
    return Response.json({ deleted: "hard" });
  } catch (error) {
    return errorResponse(error);
  }
}
