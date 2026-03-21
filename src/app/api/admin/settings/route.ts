import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { updateSettingsSchema } from "@/lib/utils/validation";
import { errorResponse } from "@/lib/utils/errors";
import { getAdminFromCookie } from "@/lib/auth/jwt";

/** GET /api/admin/settings — get tenant settings */
export async function GET(request: NextRequest) {
  try {
    const admin = await getAdminFromCookie(request);
    if (!admin) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: admin.tenantId },
      select: {
        id: true,
        businessName: true,
        phone: true,
        address: true,
        bankInfo: true,
        bankAccountName: true,
        bankAccountNumber: true,
      },
    });

    const businessHours = await prisma.businessHours.findMany({
      where: { tenantId: admin.tenantId },
      orderBy: { dayOfWeek: "asc" },
    });

    return Response.json({ tenant, businessHours });
  } catch (error) {
    return errorResponse(error);
  }
}

/** PATCH /api/admin/settings — update tenant settings */
export async function PATCH(request: NextRequest) {
  try {
    const admin = await getAdminFromCookie(request);
    if (!admin) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    // Update tenant info
    if (body.tenant) {
      const tenantData = updateSettingsSchema.parse(body.tenant);
      await prisma.tenant.update({
        where: { id: admin.tenantId },
        data: tenantData,
      });
    }

    // Update business hours
    if (body.businessHours && Array.isArray(body.businessHours)) {
      for (const bh of body.businessHours) {
        await prisma.businessHours.upsert({
          where: {
            tenantId_dayOfWeek: {
              tenantId: admin.tenantId,
              dayOfWeek: bh.dayOfWeek,
            },
          },
          update: {
            startTime: bh.startTime,
            endTime: bh.endTime,
            isOpen: bh.isOpen,
          },
          create: {
            tenantId: admin.tenantId,
            dayOfWeek: bh.dayOfWeek,
            startTime: bh.startTime,
            endTime: bh.endTime,
            isOpen: bh.isOpen,
          },
        });
      }
    }

    return Response.json({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}
