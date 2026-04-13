import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminFromCookie } from "@/lib/auth/jwt";
import { errorResponse } from "@/lib/utils/errors";

/** POST /api/push/subscribe — register a Web Push subscription */
export async function POST(request: NextRequest) {
  try {
    const admin = await getAdminFromCookie(request);
    if (!admin) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { endpoint, keys } = body.subscription as {
      endpoint: string;
      keys: { p256dh: string; auth: string };
    };

    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return Response.json({ error: "Invalid subscription" }, { status: 400 });
    }

    // Upsert — same endpoint means same device/browser
    await prisma.pushSubscription.upsert({
      where: { endpoint },
      create: {
        tenantId: admin.tenantId,
        adminUserId: admin.adminId,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
        userAgent: request.headers.get("user-agent") || undefined,
      },
      update: {
        p256dh: keys.p256dh,
        auth: keys.auth,
        adminUserId: admin.adminId,
        userAgent: request.headers.get("user-agent") || undefined,
      },
    });

    return Response.json({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}

/** DELETE /api/push/subscribe — unregister a subscription */
export async function DELETE(request: NextRequest) {
  try {
    const admin = await getAdminFromCookie(request);
    if (!admin) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { endpoint } = body as { endpoint: string };

    if (!endpoint) {
      return Response.json({ error: "Missing endpoint" }, { status: 400 });
    }

    await prisma.pushSubscription.deleteMany({
      where: { endpoint, tenantId: admin.tenantId },
    });

    return Response.json({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}
