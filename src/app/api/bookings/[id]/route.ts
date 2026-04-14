import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCancellationPolicy } from "@/lib/booking/cancellation";
import { cancelBookingNotifications, scheduleThankYou, scheduleFollowUp } from "@/lib/notifications/scheduler";
import { getLineClient } from "@/lib/line/client";
import { cancellationMessage } from "@/lib/line/messages";
import { notifyAdminCancellation } from "@/lib/notifications/admin-notify";
import { cancelBookingSchema } from "@/lib/utils/validation";
import { errorResponse, CancellationNotAllowedError } from "@/lib/utils/errors";
import { MAX_VIOLATIONS } from "@/lib/utils/constants";
import { requireBookingAuth, requireBookingOwnership, requireAdmin } from "@/lib/auth/booking-auth";

type RouteParams = { params: Promise<{ id: string }> };

/** GET /api/bookings/[id] — get single booking */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: {
        service: true,
        user: { select: { displayName: true, lineUserId: true, phone: true, realName: true } },
        payment: true,
        cancellation: true,
        tenant: { select: { businessName: true, phone: true } },
      },
    });

    if (!booking) {
      return Response.json({ error: "Booking not found" }, { status: 404 });
    }

    return Response.json({ booking });
  } catch (error) {
    return errorResponse(error);
  }
}

/** PATCH /api/bookings/[id] — cancel or update status */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    // Auth first — anyone making changes must prove identity (LIFF or admin)
    const auth = await requireBookingAuth(request);

    const { id } = await params;
    const body = await request.json();
    const action = body.action as string;

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: {
        user: true,
        service: true,
        tenant: { select: { phone: true, businessName: true } },
      },
    });

    if (!booking) {
      return Response.json({ error: "Booking not found" }, { status: 404 });
    }

    // Cancel is customer-or-admin; all other actions are admin-only.
    if (action === "cancel") {
      requireBookingOwnership(auth, booking);
    } else {
      requireAdmin(auth);
    }

    // --- Cancel ---
    if (action === "cancel") {
      if (booking.status !== "CONFIRMED") {
        return Response.json({ error: "只能取消已確認的預約" }, { status: 400 });
      }

      const input = cancelBookingSchema.parse(body);

      const policy = getCancellationPolicy({
        bookingDate: booking.date,
        bookingTime: booking.startTime,
        shopPhone: booking.tenant.phone || undefined,
      });

      if (!policy.canCancelOnline) {
        throw new CancellationNotAllowedError(policy.reason, policy.phoneNumber);
      }

      // Perform cancellation in a transaction
      const result = await prisma.$transaction(async (tx) => {
        // Update booking status
        const updated = await tx.booking.update({
          where: { id },
          data: { status: "CANCELLED" },
        });

        // Create cancellation record
        await tx.cancellationRecord.create({
          data: {
            bookingId: id,
            userId: booking.userId,
            isViolation: policy.isViolation,
            reason: input.reason,
            bookingDate: booking.date,
            bookingTime: booking.startTime,
          },
        });

        // If violation, increment violation count and possibly restrict
        if (policy.isViolation) {
          const newCount = booking.user.violationCount + 1;
          const shouldRestrict = newCount >= MAX_VIOLATIONS;

          const restrictedUntil = shouldRestrict
            ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 1 month from now
            : undefined;

          await tx.user.update({
            where: { id: booking.userId },
            data: {
              violationCount: newCount,
              bookingRestricted: shouldRestrict,
              restrictedUntil,
            },
          });
        }

        return updated;
      });

      // Cancel pending notifications
      cancelBookingNotifications(id).catch(console.error);

      // Send LINE cancellation message
      try {
        const lineClient = getLineClient();
        const cancelLiffUrl = booking.tenant.businessName
          ? `https://liff.line.me/${process.env.NEXT_PUBLIC_LIFF_ID}`
          : undefined;
        const msg = cancellationMessage({
          serviceName: booking.service.name,
          date: booking.date.toISOString().split("T")[0],
          startTime: booking.startTime,
          isViolation: policy.isViolation,
          violationCount: booking.user.violationCount + (policy.isViolation ? 1 : 0),
          liffBaseUrl: cancelLiffUrl,
        });
        await lineClient.pushMessage(booking.user.lineUserId, msg);
      } catch (lineError) {
        console.error("Failed to send cancellation LINE message:", lineError);
      }

      // Notify admin of cancellation (fire-and-forget)
      notifyAdminCancellation({
        tenantId: booking.tenantId,
        displayName: booking.user.displayName || "未知顧客",
        serviceName: booking.service.name,
        date: booking.date.toISOString().split("T")[0],
        startTime: booking.startTime,
        isViolation: policy.isViolation,
        cancelledBy: "customer",
      }).catch((err) => console.error("Failed to notify admin (cancellation):", err));

      return Response.json({
        booking: result,
        cancellation: {
          isViolation: policy.isViolation,
          reason: policy.reason,
        },
      });
    }

    // --- Mark as completed ---
    if (action === "complete") {
      // Optional paymentMethod from admin's "完成(現金)" / "完成(轉帳)" quick actions
      const rawMethod = body.paymentMethod as string | undefined;
      const paymentMethod: "CASH" | "BANK_TRANSFER" | null =
        rawMethod === "CASH" || rawMethod === "BANK_TRANSFER" ? rawMethod : null;

      const updated = await prisma.$transaction(async (tx) => {
        const b = await tx.booking.update({
          where: { id },
          data: { status: "COMPLETED" },
        });

        // Update user visit stats
        await tx.user.update({
          where: { id: booking.userId },
          data: {
            totalVisits: { increment: 1 },
            lastVisitAt: new Date(),
            firstVisitAt: booking.user.firstVisitAt || new Date(),
          },
        });

        // If admin specified payment method, upsert payment record as RECEIVED
        if (paymentMethod) {
          await tx.payment.upsert({
            where: { bookingId: id },
            create: {
              bookingId: id,
              amount: booking.service.price,
              method: paymentMethod,
              status: "RECEIVED",
              receivedAt: new Date(),
            },
            update: {
              method: paymentMethod,
              status: "RECEIVED",
              receivedAt: new Date(),
            },
          });
        }

        return b;
      });

      // Schedule thank-you notification (30 min after completion)
      try {
        await scheduleThankYou({
          tenantId: booking.tenantId,
          bookingId: id,
          lineUserId: booking.user.lineUserId,
        });
      } catch (err) {
        console.error("Failed to schedule thank-you:", err);
      }

      // Schedule 7-day follow-up for perm/color services
      try {
        await scheduleFollowUp({
          tenantId: booking.tenantId,
          bookingId: id,
          lineUserId: booking.user.lineUserId,
          serviceName: booking.service.name,
        });
      } catch (err) {
        console.error("Failed to schedule follow-up:", err);
      }

      return Response.json({ booking: updated });
    }

    // --- Mark as no-show ---
    if (action === "no_show") {
      const updated = await prisma.$transaction(async (tx) => {
        const b = await tx.booking.update({
          where: { id },
          data: { status: "NO_SHOW" },
        });

        // No-show counts as a violation
        const newCount = booking.user.violationCount + 1;
        const shouldRestrict = newCount >= MAX_VIOLATIONS;
        const restrictedUntil = shouldRestrict
          ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
          : undefined;

        await tx.user.update({
          where: { id: booking.userId },
          data: {
            violationCount: newCount,
            bookingRestricted: shouldRestrict,
            restrictedUntil,
          },
        });

        // Create cancellation record for no-show
        await tx.cancellationRecord.create({
          data: {
            bookingId: id,
            userId: booking.userId,
            isViolation: true,
            reason: "未到店 (No-show)",
            bookingDate: booking.date,
            bookingTime: booking.startTime,
          },
        });

        return b;
      });

      return Response.json({ booking: updated });
    }

    // --- Admin cancel ---
    if (action === "admin_cancel") {
      const updated = await prisma.booking.update({
        where: { id },
        data: { status: "CANCELLED_BY_ADMIN" },
      });

      cancelBookingNotifications(id).catch(console.error);

      // Notify admin of admin-initiated cancellation (fire-and-forget)
      notifyAdminCancellation({
        tenantId: booking.tenantId,
        displayName: booking.user.displayName || "未知顧客",
        serviceName: booking.service.name,
        date: booking.date.toISOString().split("T")[0],
        startTime: booking.startTime,
        isViolation: false,
        cancelledBy: "admin",
      }).catch((err) => console.error("Failed to notify admin (admin cancel):", err));

      return Response.json({ booking: updated });
    }

    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    return errorResponse(error);
  }
}
