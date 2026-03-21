import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { errorResponse } from "@/lib/utils/errors";

/** POST /api/liff/init — initialize LIFF session, return user + tenant data */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { lineUserId, displayName, pictureUrl } = body;
    const tenantId = body.tenantId || process.env.DEFAULT_TENANT_ID!;

    if (!lineUserId) {
      return Response.json({ error: "Missing lineUserId" }, { status: 400 });
    }

    // Get or create user
    const user = await prisma.user.upsert({
      where: {
        tenantId_lineUserId: { tenantId, lineUserId },
      },
      update: {
        displayName: displayName || undefined,
        pictureUrl: pictureUrl || undefined,
      },
      create: {
        tenantId,
        lineUserId,
        displayName,
        pictureUrl,
      },
    });

    // Get tenant info for display
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
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

    return Response.json({ user, tenant });
  } catch (error) {
    return errorResponse(error);
  }
}
