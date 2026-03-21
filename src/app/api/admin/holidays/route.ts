import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { errorResponse } from "@/lib/utils/errors";
import { getAdminFromCookie } from "@/lib/auth/jwt";

/** GET /api/admin/holidays — list holidays */
export async function GET(request: NextRequest) {
  try {
    const admin = await getAdminFromCookie(request);
    if (!admin) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const holidays = await prisma.holiday.findMany({
      where: { tenantId: admin.tenantId },
      orderBy: { date: "asc" },
    });

    return Response.json({ holidays });
  } catch (error) {
    return errorResponse(error);
  }
}

/** POST /api/admin/holidays — create a holiday */
export async function POST(request: NextRequest) {
  try {
    const admin = await getAdminFromCookie(request);
    if (!admin) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const dateObj = new Date(body.date + "T00:00:00+08:00");

    const holiday = await prisma.holiday.create({
      data: {
        tenantId: admin.tenantId,
        date: dateObj,
        reason: body.reason || null,
      },
    });

    return Response.json({ holiday }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

/** DELETE /api/admin/holidays — delete a holiday */
export async function DELETE(request: NextRequest) {
  try {
    const admin = await getAdminFromCookie(request);
    if (!admin) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const id = searchParams.get("id");
    if (!id) {
      return Response.json({ error: "Missing holiday id" }, { status: 400 });
    }

    await prisma.holiday.delete({ where: { id } });

    return Response.json({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}
