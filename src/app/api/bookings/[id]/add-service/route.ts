/**
 * V3.7 Tier 0.2 — Admin manually adds an extra service to an existing booking.
 *
 * Records the addition in BookingService[] only. Does NOT auto-extend
 * `slotsOccupied` / `endTime`: that would race with neighbouring bookings, and
 * the owner already knows whether they have time. Checkout amounts stay manual
 * (CheckoutFullPage has its own input). The added row shows up in admin views
 * as a chip + future reporting feeds.
 *
 * Admin-only. Cross-tenant safe via adminUser.tenantId. OCC: bumps
 * `Booking.updatedAt` in the same transaction (BookingService is a child →
 * Prisma doesn't propagate the parent updatedAt automatically — §0a E-B).
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminFromCookie } from "@/lib/auth/jwt";
import { errorResponse, UnauthorizedError, AppError, StaleWriteError } from "@/lib/utils/errors";
import { addBookingServiceSchema } from "@/lib/utils/validation";
import { invalidateReportsCache } from "@/lib/cache/invalidate";

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const admin = await getAdminFromCookie(request);
    if (!admin) throw new UnauthorizedError();

    const { id } = await params;
    const body = await request.json();
    const input = addBookingServiceSchema.parse(body);

    const booking = await prisma.booking.findFirst({
      where: { id, tenantId: admin.tenantId },
      select: {
        id: true,
        status: true,
        serviceId: true,
        updatedAt: true,
        services: { select: { order: true, serviceId: true } },
      },
    });
    if (!booking) {
      return Response.json({ error: "Booking not found" }, { status: 404 });
    }
    if (booking.status === "CANCELLED" || booking.status === "CANCELLED_BY_ADMIN" || booking.status === "NO_SHOW") {
      throw new AppError("已取消或爽約的預約不能加服務", 400, "invalid_state");
    }

    /* Codex review fix: reject duplicates server-side so a buggy/old client
       can't poison BookingService[] with the same service twice (would skew
       reporting + create confusing chip duplicates in admin UI). Includes the
       legacy primary `serviceId` so pre-backfill bookings stay clean. */
    const alreadyHaveSet = new Set<string>([
      booking.serviceId,
      ...booking.services.map((s) => s.serviceId),
    ]);
    if (alreadyHaveSet.has(input.serviceId)) {
      throw new AppError("此服務已在此預約中，請改加其他服務", 400, "duplicate_service");
    }

    const service = await prisma.service.findFirst({
      where: { id: input.serviceId, tenantId: admin.tenantId },
      select: { id: true, name: true, price: true, duration: true, hasVariants: true },
    });
    if (!service) {
      return Response.json({ error: "Service not found" }, { status: 404 });
    }

    // V3.7 P3 — if service has variants, variantId is required + must belong to this service.
    let variant: { id: string; price: number; durationMin: number } | null = null;
    if (input.variantId) {
      const v = await prisma.serviceVariant.findFirst({
        where: { id: input.variantId, serviceId: service.id },
        select: { id: true, price: true, durationMin: true },
      });
      if (!v) {
        return Response.json({ error: "Variant not found or does not belong to this service" }, { status: 400 });
      }
      variant = v;
    } else if (service.hasVariants) {
      return Response.json({ error: "Service has variants; variantId is required" }, { status: 400 });
    }

    const nextOrder = (booking.services.reduce((max, s) => Math.max(max, s.order), -1) + 1) || 1;

    const created = await prisma.$transaction(async (tx) => {
      const row = await tx.bookingService.create({
        data: {
          bookingId: id,
          serviceId: service.id,
          variantId: variant?.id ?? null,
          order: nextOrder,
          price: variant?.price ?? service.price,
          durationMin: variant?.durationMin ?? service.duration,
        },
      });
      // V3.7 audit (5/19): OCC fence on parent updatedAt bump.
      // BookingService is a child → Prisma doesn't propagate parent updatedAt
      // automatically (§0a E-B). updateMany with the prior updatedAt as guard
      // rejects writes that lost a race against reschedule / cancel / settle.
      const updateResult = await tx.booking.updateMany({
        where: {
          id,
          tenantId: admin.tenantId,
          ...(input.expectedUpdatedAt
            ? { updatedAt: new Date(input.expectedUpdatedAt) }
            : { updatedAt: booking.updatedAt }),
        },
        data: { updatedAt: new Date() },
      });
      if (updateResult.count === 0) {
        const fresh = await tx.booking.findFirst({
          where: { id, tenantId: admin.tenantId },
          select: { status: true, updatedAt: true },
        });
        throw new StaleWriteError(fresh);
      }
      return row;
    });

    invalidateReportsCache();

    return Response.json({
      ok: true,
      bookingService: {
        id: created.id,
        serviceId: service.id,
        name: service.name,
        price: service.price,
        durationMin: service.duration,
        order: created.order,
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const admin = await getAdminFromCookie(request);
    if (!admin) throw new UnauthorizedError();

    const { id } = await params;
    const { searchParams } = request.nextUrl;
    const bookingServiceId = searchParams.get("bookingServiceId");
    if (!bookingServiceId) {
      return Response.json({ error: "bookingServiceId is required" }, { status: 400 });
    }

    // Only allow deleting non-primary (order > 0) rows — primary mirrors
    // legacy `Booking.serviceId` which the rest of the codebase still reads.
    const row = await prisma.bookingService.findFirst({
      where: {
        id: bookingServiceId,
        bookingId: id,
        booking: { tenantId: admin.tenantId },
      },
      select: { id: true, order: true },
    });
    if (!row) {
      return Response.json({ error: "BookingService not found" }, { status: 404 });
    }
    if (row.order === 0) {
      throw new AppError("不能刪除主服務（請改用改期/取消預約）", 400, "primary_service");
    }

    // Snapshot the parent updatedAt before deletion so the OCC fence below
    // catches a concurrent reschedule / cancel.
    const parentBefore = await prisma.booking.findFirst({
      where: { id, tenantId: admin.tenantId },
      select: { updatedAt: true },
    });
    if (!parentBefore) {
      return Response.json({ error: "Booking not found" }, { status: 404 });
    }
    await prisma.$transaction(async (tx) => {
      await tx.bookingService.delete({ where: { id: bookingServiceId } });
      const updateResult = await tx.booking.updateMany({
        where: {
          id,
          tenantId: admin.tenantId,
          updatedAt: parentBefore.updatedAt,
        },
        data: { updatedAt: new Date() },
      });
      if (updateResult.count === 0) {
        throw new StaleWriteError();
      }
    });

    invalidateReportsCache();
    return Response.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
