/**
 * V3.7 §1 — Expense ledger API.
 *
 * GET  /api/expenses?from=YYYY-MM-DD&to=YYYY-MM-DD
 *   → list expenses in inclusive date range; defaults to last 30 days
 *
 * POST /api/expenses
 *   { date, amount, category, type, paidMethod, notes?, receiptUrl? }
 *   → create one-off expense
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAdminFromCookie } from "@/lib/auth/jwt";
import { errorResponse, UnauthorizedError } from "@/lib/utils/errors";

const EXPENSE_CATEGORIES = [
  "consumables",
  "utilities",
  "rent",
  "equipment",
  "cleaning",
  "marketing",
  "tax",
  "other",
] as const;

const createSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD"),
  amount: z.number().int().positive().max(10_000_000),
  category: z.enum(EXPENSE_CATEGORIES),
  type: z.enum(["FIXED", "VARIABLE"]),
  paidMethod: z.enum(["CASH", "BANK_TRANSFER"]).default("CASH"),
  notes: z.string().max(500).optional(),
  receiptUrl: z.string().url().max(500).optional(),
});

const querySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const admin = await getAdminFromCookie(request);
    if (!admin) throw new UnauthorizedError();

    const sp = request.nextUrl.searchParams;
    const parsed = querySchema.parse({
      from: sp.get("from") ?? undefined,
      to: sp.get("to") ?? undefined,
    });

    const today = new Date();
    const defaultFrom = new Date(today);
    defaultFrom.setUTCDate(defaultFrom.getUTCDate() - 30);
    const fromIso = parsed.from ?? defaultFrom.toISOString().slice(0, 10);
    const toIso = parsed.to ?? today.toISOString().slice(0, 10);

    const expenses = await prisma.expense.findMany({
      where: {
        tenantId: admin.tenantId,
        date: {
          gte: new Date(`${fromIso}T00:00:00.000Z`),
          lte: new Date(`${toIso}T00:00:00.000Z`),
        },
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      include: {
        recurringRule: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({
      from: fromIso,
      to: toIso,
      count: expenses.length,
      totalAmount: expenses.reduce((s, e) => s + e.amount, 0),
      expenses: expenses.map((e) => ({
        id: e.id,
        date: e.date.toISOString().slice(0, 10),
        amount: e.amount,
        category: e.category,
        type: e.type,
        paidMethod: e.paidMethod,
        notes: e.notes,
        receiptUrl: e.receiptUrl,
        recurringRule: e.recurringRule,
        createdAt: e.createdAt.toISOString(),
      })),
    });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await getAdminFromCookie(request);
    if (!admin) throw new UnauthorizedError();

    const body = createSchema.parse(await request.json());

    const expense = await prisma.expense.create({
      data: {
        tenantId: admin.tenantId,
        date: new Date(`${body.date}T00:00:00.000Z`),
        amount: body.amount,
        category: body.category,
        type: body.type,
        paidMethod: body.paidMethod,
        notes: body.notes,
        receiptUrl: body.receiptUrl,
      },
    });

    return NextResponse.json(
      {
        id: expense.id,
        date: expense.date.toISOString().slice(0, 10),
        amount: expense.amount,
        category: expense.category,
        type: expense.type,
        paidMethod: expense.paidMethod,
        notes: expense.notes,
        receiptUrl: expense.receiptUrl,
        createdAt: expense.createdAt.toISOString(),
      },
      { status: 201 },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
