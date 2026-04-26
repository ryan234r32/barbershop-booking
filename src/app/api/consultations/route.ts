import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireBookingAuth, requireAdmin } from "@/lib/auth/booking-auth";
import { errorResponse, AppError } from "@/lib/utils/errors";
import { notifyAdminNewConsultation } from "@/lib/notifications/admin-notify";
import { logger } from "@/lib/utils/logger";
import type { ConsultationStatus } from "@prisma/client";

/**
 * GET /api/consultations
 *   Admin: list consultation requests for tenant.
 *     ?status=PENDING|REPLIED|CONVERTED|ARCHIVED|all (default PENDING)
 *     ?limit=50 (default 50, max 200)
 *   LIFF: returns the caller's own consultation requests.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireBookingAuth(request);
    const { searchParams } = request.nextUrl;
    const limit = Math.min(parseInt(searchParams.get("limit") || "50") || 50, 200);

    if (auth.type === "liff") {
      const items = await prisma.consultationRequest.findMany({
        where: { tenantId: auth.tenantId, lineUserId: auth.lineUserId },
        include: {
          service: { select: { id: true, name: true } },
          convertedBooking: { select: { id: true, date: true, startTime: true } },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
      });
      return Response.json({ items });
    }

    requireAdmin(auth);
    const statusParam = searchParams.get("status") || "PENDING";
    const where: { tenantId: string; status?: ConsultationStatus } = { tenantId: auth.tenantId };
    if (statusParam !== "all") where.status = statusParam as ConsultationStatus;

    const [items, pendingCount] = await Promise.all([
      prisma.consultationRequest.findMany({
        where,
        include: {
          service: { select: { id: true, name: true } },
          user: { select: { id: true, displayName: true, phone: true, lineUserId: true, segment: true } },
          convertedBooking: { select: { id: true, date: true, startTime: true, status: true } },
        },
        orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
        take: limit,
      }),
      prisma.consultationRequest.count({
        where: { tenantId: auth.tenantId, status: "PENDING" },
      }),
    ]);

    return Response.json({ items, pendingCount });
  } catch (err) {
    return errorResponse(err);
  }
}

const createConsultationSchema = z.object({
  serviceId: z.string().uuid().optional(),
  currentPhotoUrls: z.array(z.string().url()).max(5).default([]),
  targetPhotoUrls: z.array(z.string().url()).max(5).default([]),
  lastServiceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  notes: z.string().max(2000).optional(),
  priority: z.number().int().min(0).max(10).optional(),
});

/**
 * POST /api/consultations — LIFF customer submits consultation request.
 * Caller identity always from auth, never body.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireBookingAuth(request);
    const json = await request.json();
    const data = createConsultationSchema.parse(json);

    if (auth.type === "admin") {
      throw new AppError(
        "Admin 端不直接建立諮詢，請從 LINE webhook 或 LIFF 表單觸發",
        400,
        "ADMIN_CONSULTATION_NOT_SUPPORTED",
      );
    }

    const lineUserId = auth.lineUserId;
    const user = await prisma.user.upsert({
      where: { tenantId_lineUserId: { tenantId: auth.tenantId, lineUserId } },
      update: { displayName: auth.displayName },
      create: { tenantId: auth.tenantId, lineUserId, displayName: auth.displayName },
      select: { id: true, displayName: true },
    });

    const created = await prisma.consultationRequest.create({
      data: {
        tenantId: auth.tenantId,
        userId: user.id,
        lineUserId,
        serviceId: data.serviceId,
        currentPhotoUrls: data.currentPhotoUrls,
        targetPhotoUrls: data.targetPhotoUrls,
        lastServiceDate: data.lastServiceDate
          ? new Date(data.lastServiceDate + "T00:00:00.000Z")
          : undefined,
        notes: data.notes,
        priority: data.priority ?? 0,
      },
      include: {
        service: { select: { id: true, name: true } },
      },
    });

    notifyAdminNewConsultation({
      tenantId: auth.tenantId,
      consultationId: created.id,
      displayName: user.displayName ?? auth.displayName ?? "客戶",
      serviceName: created.service?.name ?? "諮詢請求",
      hasPhoto: data.currentPhotoUrls.length > 0 || data.targetPhotoUrls.length > 0,
    }).catch((err) => logger.error("notifyAdminNewConsultation failed", err, "consultation"));

    return Response.json({ id: created.id, status: created.status }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
