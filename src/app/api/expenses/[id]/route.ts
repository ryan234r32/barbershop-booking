/**
 * V3.7 §1 — Single expense PATCH / DELETE.
 *
 * PATCH /api/expenses/:id
 *   { amount?, category?, type?, paidMethod?, notes?, receiptUrl? }
 *
 * DELETE /api/expenses/:id
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAdminFromCookie } from "@/lib/auth/jwt";
import { errorResponse, UnauthorizedError, AppError } from "@/lib/utils/errors";

import { ALL_CATEGORIES } from "@/lib/expenses/categories";

const patchSchema = z.object({
  amount: z.number().int().positive().max(10_000_000).optional(),
  category: z.enum(ALL_CATEGORIES).optional(),
  type: z.enum(["FIXED", "VARIABLE"]).optional(),
  paidMethod: z.enum(["CASH", "BANK_TRANSFER"]).optional(),
  notes: z.string().max(500).nullable().optional(),
  receiptUrl: z.string().url().max(500).nullable().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await getAdminFromCookie(request);
    if (!admin) throw new UnauthorizedError();

    const { id } = await params;
    const body = patchSchema.parse(await request.json());

    const existing = await prisma.expense.findUnique({
      where: { id },
      select: { tenantId: true },
    });
    if (!existing || existing.tenantId !== admin.tenantId) {
      throw new AppError("Expense not found", 404);
    }

    const updated = await prisma.expense.update({
      where: { id },
      data: body,
    });

    return NextResponse.json({
      id: updated.id,
      date: updated.date.toISOString().slice(0, 10),
      amount: updated.amount,
      category: updated.category,
      type: updated.type,
      paidMethod: updated.paidMethod,
      notes: updated.notes,
      receiptUrl: updated.receiptUrl,
    });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await getAdminFromCookie(request);
    if (!admin) throw new UnauthorizedError();

    const { id } = await params;
    const existing = await prisma.expense.findUnique({
      where: { id },
      select: { tenantId: true },
    });
    if (!existing || existing.tenantId !== admin.tenantId) {
      throw new AppError("Expense not found", 404);
    }

    await prisma.expense.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    return errorResponse(e);
  }
}
