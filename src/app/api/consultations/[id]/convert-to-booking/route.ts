import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireBookingAuth, requireAdmin } from "@/lib/auth/booking-auth";
import { errorResponse, AppError, SlotUnavailableError } from "@/lib/utils/errors";
import { isSlotAvailable } from "@/lib/booking/availability";
import { acquireBookingLock, releaseBookingLock } from "@/lib/booking/lock";
import { addHours, parseTimeToHour, todayInTaipei } from "@/lib/utils/time";
import { DEFAULT_BUSINESS_HOURS } from "@/lib/utils/constants";
import { getLineClient } from "@/lib/line/client";
import { bookingConfirmationMessage } from "@/lib/line/messages";
import { logger } from "@/lib/utils/logger";

const convertSchema = z.object({
  serviceId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:00$/),
  notes: z.string().optional(),
});

/**
 * POST /api/consultations/[id]/convert-to-booking
 *
 * Admin-only. Atomically:
 *   1. Validate slot + business-hours + lock (same guards as POST /api/bookings)
 *   2. Create Booking
 *   3. Mark ConsultationRequest CONVERTED + link convertedBookingId
 *   4. Push LINE confirmation to customer (best-effort)
 *
 * If lock or availability fails, no Booking + Consultation stays PENDING.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  let lock: Awaited<ReturnType<typeof acquireBookingLock>> | null = null;
  try {
    const auth = await requireBookingAuth(request);
    requireAdmin(auth);
    const { id } = await params;
    const data = convertSchema.parse(await request.json());

    const consultation = await prisma.consultationRequest.findFirst({
      where: { id, tenantId: auth.tenantId },
      include: { user: true },
    });
    if (!consultation) throw new AppError("找不到諮詢請求", 404, "CONSULTATION_NOT_FOUND");
    if (consultation.status === "CONVERTED") {
      throw new AppError("此諮詢已轉為預約", 400, "ALREADY_CONVERTED");
    }
    if (!consultation.userId || !consultation.user) {
      throw new AppError("諮詢無關聯客戶，請手動建立預約", 400, "NO_USER");
    }

    const service = await prisma.service.findFirst({
      where: { id: data.serviceId, tenantId: auth.tenantId },
    });
    if (!service) throw new AppError("找不到服務", 404, "SERVICE_NOT_FOUND");

    // todayInTaipei() avoids the nowTaipei() UTC-server day-shift bug.
    const today = todayInTaipei();
    if (data.date < today) throw new AppError("預約日期不可為過去", 400, "PAST_DATE");

    const startHour = parseTimeToHour(data.startTime);
    const openHour = parseTimeToHour(DEFAULT_BUSINESS_HOURS.startTime);
    const closeHour = parseTimeToHour(DEFAULT_BUSINESS_HOURS.endTime);
    if (startHour < openHour || startHour + service.slotsNeeded > closeHour) {
      throw new AppError(
        `預約時段須在營業時間內（${DEFAULT_BUSINESS_HOURS.startTime}–${DEFAULT_BUSINESS_HOURS.endTime}）`,
        400,
        "OUTSIDE_BUSINESS_HOURS",
      );
    }

    if (consultation.user.bookingRestricted) {
      throw new AppError("此客戶目前限電話預約", 403, "BOOKING_RESTRICTED");
    }

    lock = await acquireBookingLock({
      tenantId: auth.tenantId,
      date: data.date,
      startTime: data.startTime,
    });
    if (!lock) throw new SlotUnavailableError();

    const dateObj = new Date(data.date + "T00:00:00.000Z");
    const available = await isSlotAvailable({
      tenantId: auth.tenantId,
      date: dateObj,
      startTime: data.startTime,
      slotsNeeded: service.slotsNeeded,
    });
    if (!available) throw new SlotUnavailableError();

    const endTime = addHours(data.startTime, service.slotsNeeded);

    // Atomic: create booking + flip consultation in one transaction.
    const result = await prisma.$transaction(async (tx) => {
      const booking = await tx.booking.create({
        data: {
          tenantId: auth.tenantId,
          userId: consultation.userId!,
          serviceId: service.id,
          date: dateObj,
          startTime: data.startTime,
          endTime,
          slotsOccupied: service.slotsNeeded,
          source: "ADMIN",
          notes: data.notes ?? `從諮詢請求轉換 (consultation:${id})`,
          adminAcknowledgedAt: new Date(),
        },
        include: {
          tenant: {
            select: {
              id: true,
              businessName: true,
              address: true,
              phone: true,
              liffId: true,
            },
          },
        },
      });

      await tx.consultationRequest.update({
        where: { id },
        data: {
          status: "CONVERTED",
          convertedBookingId: booking.id,
          respondedAt: consultation.respondedAt ?? new Date(),
        },
      });

      return booking;
    });

    // Push LINE confirmation to the customer (best-effort).
    if (consultation.lineUserId && !consultation.lineUserId.startsWith("manual-")) {
      try {
        const lineClient = getLineClient();
        const liffBaseUrl = result.tenant.liffId
          ? `https://liff.line.me/${result.tenant.liffId}`
          : undefined;
        await lineClient.pushMessage(
          consultation.lineUserId,
          bookingConfirmationMessage({
            serviceName: service.name,
            date: data.date,
            startTime: data.startTime,
            endTime,
            shopName: result.tenant.businessName,
            shopAddress: result.tenant.address || undefined,
            price: service.price,
            bookingId: result.id,
            liffBaseUrl,
          }),
        );
      } catch (err) {
        logger.error("convert-to-booking LINE push failed", err, "consultation");
      }
    }

    return Response.json(
      { bookingId: result.id, consultationId: id },
      { status: 201 },
    );
  } catch (err) {
    return errorResponse(err);
  } finally {
    if (lock) await releaseBookingLock(lock);
  }
}
