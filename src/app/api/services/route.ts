import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createServiceSchema } from "@/lib/utils/validation";
import { errorResponse } from "@/lib/utils/errors";
import { getAdminFromCookie } from "@/lib/auth/jwt";

/** GET /api/services — list services for a tenant */
export async function GET(request: NextRequest) {
  try {
    const tenantId = request.nextUrl.searchParams.get("tenantId") || process.env.DEFAULT_TENANT_ID!;

    const services = await prisma.service.findMany({
      where: { tenantId, isActive: true },
      orderBy: { sortOrder: "asc" },
    });

    return Response.json({ services });
  } catch (error) {
    return errorResponse(error);
  }
}

/** POST /api/services — create a service (admin only) */
export async function POST(request: NextRequest) {
  try {
    const admin = await getAdminFromCookie(request);
    if (!admin) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const input = createServiceSchema.parse(body);

    const service = await prisma.service.create({
      data: {
        tenantId: admin.tenantId,
        ...input,
      },
    });

    return Response.json({ service }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
