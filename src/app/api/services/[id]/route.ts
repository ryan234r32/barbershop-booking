import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createServiceSchema } from "@/lib/utils/validation";
import { errorResponse } from "@/lib/utils/errors";
import { getAdminFromCookie } from "@/lib/auth/jwt";

type RouteParams = { params: Promise<{ id: string }> };

/** PATCH /api/services/[id] — update a service */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const admin = await getAdminFromCookie(request);
    if (!admin) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const input = createServiceSchema.partial().parse(body);

    // Tenant isolation
    const existing = await prisma.service.findUnique({
      where: { id },
      include: { variants: { where: { isActive: true } } },
    });
    if (!existing || existing.tenantId !== admin.tenantId) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    // V3.7 P3 guards on hasVariants toggle
    const nextHasVariants =
      input.hasVariants !== undefined ? input.hasVariants : existing.hasVariants;
    const activeVariantCount = existing.variants.length;

    if (nextHasVariants === true && activeVariantCount === 0) {
      return Response.json(
        { error: "啟用變異前請先新增至少一個變異" },
        { status: 400 },
      );
    }
    if (
      input.hasVariants === false &&
      existing.hasVariants === true &&
      activeVariantCount > 0
    ) {
      return Response.json(
        { error: "請先刪除所有變異後再關閉「有變異」" },
        { status: 400 },
      );
    }

    const service = await prisma.service.update({
      where: { id },
      data: input,
    });

    return Response.json({ service });
  } catch (error) {
    return errorResponse(error);
  }
}

/** DELETE /api/services/[id] — soft-delete a service */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const admin = await getAdminFromCookie(request);
    if (!admin) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Tenant isolation
    const existing = await prisma.service.findUnique({ where: { id } });
    if (!existing || existing.tenantId !== admin.tenantId) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    const service = await prisma.service.update({
      where: { id },
      data: { isActive: false },
    });

    return Response.json({ service });
  } catch (error) {
    return errorResponse(error);
  }
}
