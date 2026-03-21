import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { isSlotAvailable } from "@/lib/booking/availability";
import { acquireBookingLock, releaseBookingLock } from "@/lib/booking/lock";
import { scheduleReminders } from "@/lib/notifications/scheduler";
import { getLineClient } from "@/lib/line/client";
import { bookingConfirmationMessage } from "@/lib/line/messages";
import { createBookingSchema } from "@/lib/utils/validation";
import { errorResponse, SlotUnavailableError, BookingRestrictedError } from "@/lib/utils/errors";
import { addHours } from "@/lib/utils/time";
import { getAdminFromCookie } from "@/lib/auth/jwt";

/** GET /api/bookings — list bookings */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const tenantId = searchParams.get("tenantId") || process.env.DEFAULT_TENANT_ID!;
    const date = searchParams.get("date");
    const userId = searchParams.get("userId");
    const lineUserId = searchParams.get("lineUserId");
    const status = searchParams.get("status");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");

    const where: Record<string, unknown> = { tenantId };
    if (date) where.date = new Date(date + "T00:00:00+08:00");
    if (userId) where.userId = userId;
    if (status) where.status = status;

    // If lineUserId provided, find user first
    if (lineUserId) {
      const user = await prisma.user.findUnique({
        where: { tenantId_lineUserId: { tenantId, lineUserId } },
        select: { id: true },
      });
      if (user) where.userId = user.id;
      else return Response.json({ bookings: [], total: 0 });
    }

    const [bookings, total] = await Promise.all([
      prisma.booking.findMany({
        where,
        include: {
          service: { select: { name: true, duration: true, price: true } },
          user: { select: { displayName: true, lineUserId: true, phone: true } },
          payment: { select: { status: true, method: true } },
        },
        orderBy: [{ date: "asc" }, { startTime: "asc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.booking.count({ where }),
    ]);

    return Response.json({ bookings, total, page, limit });
  } catch (error) {
    return errorResponse(error);
  }
}

/** POST /api/bookings — create a new booking */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const input = createBookingSchema.parse(body);

    // 1. Get service details
    const service = await prisma.service.findUnique({
      where: { id: input.serviceId },
    });
    if (!service) {
      return Response.json({ error: "Service not found" }, { status: 404 });
    }

    // 2. Get or create user
    let user = await prisma.user.findUnique({
      where: {
        tenantId_lineUserId: {
          tenantId: input.tenantId,
          lineUserId: input.lineUserId,
        },
      },
    });
    if (!user) {
      user = await prisma.user.create({
        data: {
          tenantId: input.tenantId,
          lineUserId: input.lineUserId,
        },
      });
    }

    // 3. Check if user is restricted
    if (user.bookingRestricted) {
      throw new BookingRestrictedError();
    }

    // 4. Acquire distributed lock
    const lock = await acquireBookingLock({
      tenantId: input.tenantId,
      date: input.date,
      startTime: input.startTime,
    });
    if (!lock) {
      throw new SlotUnavailableError();
    }

    try {
      // 5. Double-check availability inside the lock
      const dateObj = new Date(input.date + "T00:00:00+08:00");
      const available = await isSlotAvailable({
        tenantId: input.tenantId,
        date: dateObj,
        startTime: input.startTime,
        slotsNeeded: service.slotsNeeded,
      });

      if (!available) {
        throw new SlotUnavailableError();
      }

      // 6. Calculate end time
      const endTime = addHours(input.startTime, service.slotsNeeded);

      // 7. Create booking
      const booking = await prisma.booking.create({
        data: {
          tenantId: input.tenantId,
          userId: user.id,
          serviceId: input.serviceId,
          date: dateObj,
          startTime: input.startTime,
          endTime,
          slotsOccupied: service.slotsNeeded,
          source: "LIFF",
          notes: input.notes,
        },
        include: {
          service: true,
          tenant: true,
        },
      });

      // 8. Schedule reminders (async, don't block response)
      scheduleReminders({
        tenantId: input.tenantId,
        bookingId: booking.id,
        lineUserId: input.lineUserId,
        bookingDate: dateObj,
        startTime: input.startTime,
      }).catch(console.error);

      // 9. Send LINE confirmation (async)
      try {
        const lineClient = getLineClient();
        const message = bookingConfirmationMessage({
          serviceName: service.name,
          date: input.date,
          startTime: input.startTime,
          endTime,
          shopName: booking.tenant.businessName,
          shopAddress: booking.tenant.address || undefined,
        });
        await lineClient.pushMessage(input.lineUserId, message);
      } catch (lineError) {
        console.error("Failed to send LINE confirmation:", lineError);
      }

      return Response.json({ booking }, { status: 201 });
    } finally {
      await releaseBookingLock(lock);
    }
  } catch (error) {
    return errorResponse(error);
  }
}
