/**
 * V3.6 §5.2 + V3.7 §3 — 結班 endpoint.
 *
 * POST /api/admin/day-close
 *   { date: "YYYY-MM-DD",
 *     actualCash?: number,        // V3.7 — rich reconciliation; if omitted, equals expectedCash
 *     bankConfirmed?: boolean,    // V3.7 — owner ticked "銀行 App 已確認"
 *     notes?: string }
 *
 *   Writes:
 *     1. Tenant.dayClosedAt[date] (legacy V3.6 flag — daily view uses this for read-only mode)
 *     2. DailyCloseSnapshot row (V3.7 — frozen reconciliation record + diff + notes)
 *
 *   Idempotent: if a DailyCloseSnapshot already exists for this date, the call updates it.
 *
 * DELETE /api/admin/day-close { date: "YYYY-MM-DD" }
 *   → un-locks (clears the date key); for "補登" path. Also deletes DailyCloseSnapshot.
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAdminFromCookie } from "@/lib/auth/jwt";
import { errorResponse, UnauthorizedError } from "@/lib/utils/errors";

const postSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD"),
  actualCash: z.number().int().nonnegative().optional(),
  bankConfirmed: z.boolean().optional(),
  notes: z.string().max(500).optional(),
});

const deleteSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD"),
});

export async function POST(request: NextRequest) {
  try {
    const admin = await getAdminFromCookie(request);
    if (!admin) throw new UnauthorizedError();

    const body = postSchema.parse(await request.json());
    const { date, actualCash, bankConfirmed, notes } = body;
    const dateObj = new Date(`${date}T00:00:00.000Z`);

    // Compute expected cash/bank from bookings + expenses for the day.
    const [bookings, expenses] = await Promise.all([
      prisma.booking.findMany({
        where: {
          tenantId: admin.tenantId,
          date: dateObj,
          status: { in: ["CONFIRMED", "COMPLETED"] },
        },
        include: { payment: { select: { method: true, amount: true } }, service: { select: { price: true } } },
      }),
      prisma.expense.findMany({
        where: { tenantId: admin.tenantId, date: dateObj },
      }),
    ]);

    const cashRevenue = bookings
      .filter((b) => b.payment?.method === "CASH")
      .reduce((s, b) => s + (b.payment?.amount ?? b.service.price), 0);
    const bankRevenue = bookings
      .filter((b) => b.payment?.method === "BANK_TRANSFER")
      .reduce((s, b) => s + (b.payment?.amount ?? b.service.price), 0);
    const cashExpense = expenses
      .filter((e) => e.paidMethod === "CASH")
      .reduce((s, e) => s + e.amount, 0);
    const bankExpense = expenses
      .filter((e) => e.paidMethod === "BANK_TRANSFER")
      .reduce((s, e) => s + e.amount, 0);

    const expectedCash = cashRevenue - cashExpense;
    const expectedBank = bankRevenue - bankExpense;
    const finalCash = actualCash ?? expectedCash;
    const cashDiff = finalCash - expectedCash;
    const totalRevenue = cashRevenue + bankRevenue;
    const totalExpense = cashExpense + bankExpense;
    const netProfit = totalRevenue - totalExpense;

    // 1. Legacy Tenant.dayClosedAt flag
    const tenant = await prisma.tenant.findUnique({
      where: { id: admin.tenantId },
      select: { dayClosedAt: true },
    });
    const map = ((tenant?.dayClosedAt as Record<string, string> | null) ?? {});
    const closedAtIso = new Date().toISOString();
    map[date] = closedAtIso;

    // 2. DailyCloseSnapshot upsert (V3.7)
    const [, snapshot] = await prisma.$transaction([
      prisma.tenant.update({
        where: { id: admin.tenantId },
        data: { dayClosedAt: map },
      }),
      prisma.dailyCloseSnapshot.upsert({
        where: {
          tenantId_date: {
            tenantId: admin.tenantId,
            date: dateObj,
          },
        },
        update: {
          expectedCash,
          expectedBank,
          actualCash: finalCash,
          cashDiff,
          bankConfirmed: bankConfirmed ?? false,
          bookingCount: bookings.length,
          expenseCount: expenses.length,
          totalRevenue,
          totalExpense,
          netProfit,
          notes: notes ?? null,
          closedAt: new Date(closedAtIso),
          closedBy: admin.adminId,
        },
        create: {
          tenantId: admin.tenantId,
          date: dateObj,
          expectedCash,
          expectedBank,
          actualCash: finalCash,
          cashDiff,
          bankConfirmed: bankConfirmed ?? false,
          bookingCount: bookings.length,
          expenseCount: expenses.length,
          totalRevenue,
          totalExpense,
          netProfit,
          notes: notes ?? null,
          closedAt: new Date(closedAtIso),
          closedBy: admin.adminId,
        },
      }),
    ]);

    return Response.json({
      ok: true,
      date,
      closedAt: map[date],
      snapshot: {
        expectedCash: snapshot.expectedCash,
        expectedBank: snapshot.expectedBank,
        actualCash: snapshot.actualCash,
        cashDiff: snapshot.cashDiff,
        bankConfirmed: snapshot.bankConfirmed,
        totalRevenue: snapshot.totalRevenue,
        totalExpense: snapshot.totalExpense,
        netProfit: snapshot.netProfit,
        notes: snapshot.notes,
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const admin = await getAdminFromCookie(request);
    if (!admin) throw new UnauthorizedError();

    const body = await request.json();
    const { date } = deleteSchema.parse(body);
    const dateObj = new Date(`${date}T00:00:00.000Z`);

    const tenant = await prisma.tenant.findUnique({
      where: { id: admin.tenantId },
      select: { dayClosedAt: true },
    });
    const map = ((tenant?.dayClosedAt as Record<string, string> | null) ?? {});
    const wasClosed = date in map;
    if (wasClosed) delete map[date];

    await prisma.$transaction([
      prisma.tenant.update({
        where: { id: admin.tenantId },
        data: { dayClosedAt: map },
      }),
      prisma.dailyCloseSnapshot.deleteMany({
        where: { tenantId: admin.tenantId, date: dateObj },
      }),
    ]);

    return Response.json({ ok: true, alreadyOpen: !wasClosed });
  } catch (err) {
    return errorResponse(err);
  }
}

/** GET /api/admin/day-close
 *   ?date=YYYY-MM-DD                 → single snapshot (legacy)
 *   ?from=YYYY-MM-DD&to=YYYY-MM-DD   → range list (V3.7 monthly grid)
 */
export async function GET(request: NextRequest) {
  try {
    const admin = await getAdminFromCookie(request);
    if (!admin) throw new UnauthorizedError();

    const sp = request.nextUrl.searchParams;
    const date = sp.get("date");
    const from = sp.get("from");
    const to = sp.get("to");

    if (from && to) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
        return Response.json(
          { error: "from/to must be YYYY-MM-DD" },
          { status: 400 },
        );
      }
      const snaps = await prisma.dailyCloseSnapshot.findMany({
        where: {
          tenantId: admin.tenantId,
          date: {
            gte: new Date(`${from}T00:00:00.000Z`),
            lte: new Date(`${to}T00:00:00.000Z`),
          },
        },
        orderBy: { date: "asc" },
      });
      return Response.json({
        from,
        to,
        snapshots: snaps.map((s) => ({
          date: s.date.toISOString().slice(0, 10),
          closedAt: s.closedAt.toISOString(),
          totalRevenue: s.totalRevenue,
          totalExpense: s.totalExpense,
          netProfit: s.netProfit,
          cashDiff: s.cashDiff,
          bankConfirmed: s.bankConfirmed,
        })),
      });
    }

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return Response.json(
        { error: "either ?date or ?from + ?to required (YYYY-MM-DD)" },
        { status: 400 },
      );
    }

    const snap = await prisma.dailyCloseSnapshot.findUnique({
      where: {
        tenantId_date: {
          tenantId: admin.tenantId,
          date: new Date(`${date}T00:00:00.000Z`),
        },
      },
    });

    if (!snap) return Response.json({ snapshot: null });
    return Response.json({
      snapshot: {
        date,
        closedAt: snap.closedAt.toISOString(),
        expectedCash: snap.expectedCash,
        expectedBank: snap.expectedBank,
        actualCash: snap.actualCash,
        cashDiff: snap.cashDiff,
        bankConfirmed: snap.bankConfirmed,
        bookingCount: snap.bookingCount,
        expenseCount: snap.expenseCount,
        totalRevenue: snap.totalRevenue,
        totalExpense: snap.totalExpense,
        netProfit: snap.netProfit,
        notes: snap.notes,
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
