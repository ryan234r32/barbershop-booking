import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireBookingAuth, requireAdmin } from "@/lib/auth/booking-auth";
import { errorResponse, AppError } from "@/lib/utils/errors";
import type { ConsultationStatus } from "@prisma/client";

/**
 * GET /api/consultations/[id] — admin / owner LIFF customer reads a single request.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireBookingAuth(request);
    const { id } = await params;

    const item = await prisma.consultationRequest.findFirst({
      where: { id, tenantId: auth.tenantId },
      include: {
        service: { select: { id: true, name: true } },
        user: { select: { id: true, displayName: true, phone: true, lineUserId: true, segment: true, totalVisits: true, lastVisitAt: true } },
        convertedBooking: { select: { id: true, date: true, startTime: true, status: true } },
      },
    });
    if (!item) throw new AppError("找不到諮詢請求", 404, "CONSULTATION_NOT_FOUND");

    if (auth.type === "liff" && item.lineUserId !== auth.lineUserId) {
      throw new AppError("無權存取此諮詢", 403, "FORBIDDEN");
    }

    return Response.json(item);
  } catch (err) {
    return errorResponse(err);
  }
}

const patchSchema = z.object({
  status: z.enum(["PENDING", "REPLIED", "ARCHIVED"]).optional(),
  priority: z.number().int().min(0).max(10).optional(),
  notes: z.string().max(2000).optional(),
});

/**
 * PATCH /api/consultations/[id] — admin updates status / priority / notes.
 * Use POST .../convert-to-booking for the conversion flow (atomic).
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireBookingAuth(request);
    requireAdmin(auth);
    const { id } = await params;
    const body = await request.json();
    const data = patchSchema.parse(body);

    const existing = await prisma.consultationRequest.findFirst({
      where: { id, tenantId: auth.tenantId },
      select: { status: true },
    });
    if (!existing) throw new AppError("找不到諮詢請求", 404, "CONSULTATION_NOT_FOUND");
    if (existing.status === "CONVERTED") {
      throw new AppError("已轉預約的諮詢無法再修改狀態", 400, "ALREADY_CONVERTED");
    }

    const updated = await prisma.consultationRequest.update({
      where: { id },
      data: {
        status: data.status as ConsultationStatus | undefined,
        priority: data.priority,
        notes: data.notes,
        respondedAt: data.status === "REPLIED" ? new Date() : undefined,
      },
      select: { id: true, status: true, priority: true },
    });

    return Response.json(updated);
  } catch (err) {
    return errorResponse(err);
  }
}
