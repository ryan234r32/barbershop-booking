import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminFromCookie } from "@/lib/auth/jwt";
import { errorResponse } from "@/lib/utils/errors";

/** GET /api/auth/me — get current admin info */
export async function GET(request: NextRequest) {
  try {
    const payload = await getAdminFromCookie(request);
    if (!payload) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = await prisma.adminUser.findUnique({
      where: { id: payload.adminId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        tenantId: true,
        tenant: { select: { businessName: true, phone: true } },
      },
    });

    if (!admin || !admin.tenant) {
      return Response.json({ error: "Admin not found" }, { status: 404 });
    }

    return Response.json({ admin });
  } catch (error) {
    return errorResponse(error);
  }
}

/** POST /api/auth/logout */
export async function POST() {
  const response = Response.json({ success: true });
  response.headers.set(
    "Set-Cookie",
    "admin_token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0"
  );
  return response;
}
