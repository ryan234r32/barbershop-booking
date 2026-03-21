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

    const service = await prisma.service.update({
      where: { id },
      data: { isActive: false },
    });

    return Response.json({ service });
  } catch (error) {
    return errorResponse(error);
  }
}
