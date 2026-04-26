import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { isSlotAvailable } from "@/lib/booking/availability";
import { acquireBookingLock, releaseBookingLock } from "@/lib/booking/lock";
import { scheduleReminders } from "@/lib/notifications/scheduler";
import { getLineClient } from "@/lib/line/client";
import { bookingConfirmationMessage } from "@/lib/line/messages";
import { notifyAdminNewBooking } from "@/lib/notifications/admin-notify";
import { createBookingSchema } from "@/lib/utils/validation";
import { errorResponse, AppError, SlotUnavailableError, BookingRestrictedError } from "@/lib/utils/errors";
import { requireBookingAuth } from "@/lib/auth/booking-auth";
import { randomUUID } from "node:crypto";
import { addHours, parseTimeToHour, nowTaipei } from "@/lib/utils/time";
import { DEFAULT_BUSINESS_HOURS } from "@/lib/utils/constants";
import { logger } from "@/lib/utils/logger";

/** GET /api/bookings — list bookings */
export async function GET(request: NextRequest) {
  try {
    // Auth required — previously open, leaked entire customer DB (names, LINE IDs,
    // phones, payments). Admin → full tenant visibility. LIFF → own bookings only.
    const auth = await requireBookingAuth(request);

    const { searchParams } = request.nextUrl;
    const tenantId = auth.tenantId;
    const date = searchParams.get("date");
    const status = searchParams.get("status");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");

    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const where: Record<string, unknown> = { tenantId };
    if (from && to) {
      where.date = {
        gte: new Date(from + "T00:00:00+08:00"),
        lte: new Date(to + "T23:59:59+08:00"),
      };
    } else if (date) {
      where.date = new Date(date + "T00:00:00+08:00");
    }
    if (status) where.status = status;

    if (auth.type === "liff") {
      // LIFF callers can ONLY see their own bookings. Query params userId /
      // lineUserId are ignored — caller identity always comes from the verified
      // ID token, never from URL params.
      // Use nested where to JOIN in single round trip instead of pre-fetching user.id.
      where.user = { lineUserId: auth.lineUserId };
    } else {
      // Admin can optionally filter by userId or lineUserId.
      const userId = searchParams.get("userId");
      const lineUserId = searchParams.get("lineUserId");
      if (userId) where.userId = userId;
      if (lineUserId) {
        const user = await prisma.user.findUnique({
          where: { tenantId_lineUserId: { tenantId, lineUserId } },
          select: { id: true },
        });
        if (user) where.userId = user.id;
        else return Response.json({ bookings: [], total: 0, page, limit });
      }
    }

    const [bookings, total] = await Promise.all([
      prisma.booking.findMany({
        where,
        include: {
          service: { select: { name: true, duration: true, price: true, slotsNeeded: true } },
          user: { select: { id: true, displayName: true, lineUserId: true, phone: true, segment: true, totalVisits: true, notes: true, lastVisitAt: true } },
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
    // 0. Verify caller identity BEFORE anything else.
    //    Admin path → cookie/Bearer JWT. LIFF path → X-LIFF-ID-Token header verified by LINE.
    //    No auth → 401. lineUserId in body is IGNORED (previously allowed impersonation).
    const auth = await requireBookingAuth(request);

    const body = await request.json();
    const input = createBookingSchema.parse(body);

    // Derive identity from auth, NOT from body.
    // Admin-created bookings synthesize a per-booking lineUserId since walk-in/phone
    // customers may have no LINE account. LIFF path uses the verified token subject.
    const authedLineUserId =
      auth.type === "admin"
        ? `manual-${auth.adminId}-${randomUUID()}`
        : auth.lineUserId;
    const tenantId = auth.tenantId;

    // 1. Get service details
    const service = await prisma.service.findUnique({
      where: { id: input.serviceId },
    });
    if (!service) {
      return Response.json({ error: "Service not found" }, { status: 404 });
    }

    // 1b. Validate date is not in the past (Taipei timezone)
    const today = nowTaipei().toLocaleDateString("en-CA", { timeZone: "Asia/Taipei" });
    if (input.date < today) {
      throw new AppError("預約日期不可為過去", 400, "PAST_DATE");
    }

    // 1c. Validate startTime + slotsNeeded fits within business hours
    const startHour = parseTimeToHour(input.startTime);
    const openHour = parseTimeToHour(DEFAULT_BUSINESS_HOURS.startTime);
    const closeHour = parseTimeToHour(DEFAULT_BUSINESS_HOURS.endTime);
    if (startHour < openHour || startHour + service.slotsNeeded > closeHour) {
      throw new AppError(
        `預約時段須在營業時間內（${DEFAULT_BUSINESS_HOURS.startTime}–${DEFAULT_BUSINESS_HOURS.endTime}）`,
        400,
        "OUTSIDE_BUSINESS_HOURS"
      );
    }

    // 2. Get or create user
    let user = await prisma.user.findUnique({
      where: {
        tenantId_lineUserId: {
          tenantId,
          lineUserId: authedLineUserId,
        },
      },
    });
    if (!user) {
      user = await prisma.user.create({
        data: {
          tenantId,
          lineUserId: authedLineUserId,
        },
      });
    }

    // 2b. Update user profile if provided
    if (input.realName || input.displayName || input.phone || input.birthday) {
      const profileUpdate: Record<string, unknown> = {};
      if (input.realName) profileUpdate.realName = input.realName;
      if (input.displayName) profileUpdate.displayName = input.displayName;
      if (input.phone) profileUpdate.phone = input.phone;
      if (input.birthday) {
        // birthday comes as "YYYY-MM-DD" from frontend (western year)
        const [year, month, day] = input.birthday.split("-").map(Number);
        if (year && month && day) {
          profileUpdate.birthday = new Date(year, month - 1, day);
          profileUpdate.birthdayMonth = month;
          profileUpdate.birthdayDay = day;
        }
      }
      user = await prisma.user.update({
        where: { id: user.id },
        data: profileUpdate,
      });
    }

    // 3. Check if user is restricted
    if (user.bookingRestricted) {
      throw new BookingRestrictedError();
    }

    // 4. Acquire distributed lock
    const lock = await acquireBookingLock({
      tenantId,
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
        tenantId,
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
          tenantId,
          userId: user.id,
          serviceId: input.serviceId,
          date: dateObj,
          startTime: input.startTime,
          endTime,
          slotsOccupied: service.slotsNeeded,
          // LIFF calls are always "LIFF" regardless of what client sends; admin may
          // choose PHONE or WALK_IN (default WALK_IN if omitted).
          source: auth.type === "liff" ? "LIFF" : (input.source || "WALK_IN"),
          notes: input.notes,
          // Admin-created bookings are pre-acknowledged — admin obviously knows,
          // they just typed it in. Customer LIFF bookings start unacked → queue.
          adminAcknowledgedAt: auth.type === "admin" ? new Date() : null,
        },
        include: {
          service: true,
          // Only safe, client-visible tenant fields — never include lineAccessToken,
          // lineChannelSecret, or bankAccountNumber in API responses.
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

      // Only real LIFF users get LINE pushes & reminders. Admin-created bookings
      // (auth.type === "admin") may have no LINE account — skip those entirely.
      const isRealLineUser = auth.type === "liff";

      // 8. Schedule reminders (async, don't block response)
      if (isRealLineUser) {
        scheduleReminders({
          tenantId,
          bookingId: booking.id,
          lineUserId: authedLineUserId,
          bookingDate: dateObj,
          startTime: input.startTime,
        }).catch((err) => logger.error("Failed to schedule reminders", err, "bookings", { bookingId: booking.id }));
      }

      // 9. Send LINE confirmation (async)
      if (isRealLineUser) {
        try {
          const lineClient = getLineClient();
          const liffBaseUrl = booking.tenant.liffId
            ? `https://liff.line.me/${booking.tenant.liffId}`
            : undefined;
          const message = bookingConfirmationMessage({
            serviceName: service.name,
            date: input.date,
            startTime: input.startTime,
            endTime,
            shopName: booking.tenant.businessName,
            shopAddress: booking.tenant.address || undefined,
            price: service.price,
            bookingId: booking.id,
            liffBaseUrl,
          });
          await lineClient.pushMessage(authedLineUserId, message);
        } catch (lineError) {
          logger.error("Failed to send LINE confirmation", lineError, "bookings", { lineUserId: authedLineUserId });
        }
      }

      // 10. Notify admin (fire-and-forget)
      // Must await on Vercel — fire-and-forget promises get killed when the
      // response is sent, so the push never fires. Booking already takes several
      // 100ms of DB/LINE work; one more ~200ms await is imperceptible.
      try {
        await notifyAdminNewBooking({
          tenantId,
          bookingId: booking.id,
          displayName: user.displayName || input.displayName || "未知顧客",
          serviceName: service.name,
          date: input.date,
          startTime: input.startTime,
          endTime,
          price: service.price,
        });
      } catch (err) {
        logger.error("Failed to notify admin (new booking)", err, "bookings");
      }

      return Response.json({ booking }, { status: 201 });
    } finally {
      await releaseBookingLock(lock);
    }
  } catch (error) {
    return errorResponse(error);
  }
}
