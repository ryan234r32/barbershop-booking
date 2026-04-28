/**
 * V3.6 §7.3 — 年度目標設定 endpoint.
 *
 * POST /api/admin/year-target
 *   { year: 2026, scenario: "aggressive", targetAnnualRevenue: 1593000,
 *     monthlyTargets: { "2026-01": 138000, ... } }
 *   → writes Tenant.yearTargets + Tenant.monthlyTargets (merge by month key)
 *
 * GET /api/admin/year-target → reads current Tenant.yearTargets + monthlyTargets
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAdminFromCookie } from "@/lib/auth/jwt";
import { errorResponse, UnauthorizedError } from "@/lib/utils/errors";

const bodySchema = z.object({
  year: z.number().int().min(2024).max(2100),
  scenario: z.enum(["conservative", "flat", "aggressive", "custom"]),
  targetAnnualRevenue: z.number().int().nonnegative(),
  monthlyTargets: z.record(z.string(), z.number().int().nonnegative()),
});

export async function GET(request: NextRequest) {
  try {
    const admin = await getAdminFromCookie(request);
    if (!admin) throw new UnauthorizedError();
    const tenant = await prisma.tenant.findUnique({
      where: { id: admin.tenantId },
      select: { yearTargets: true, monthlyTargets: true },
    });
    return Response.json({
      yearTargets: tenant?.yearTargets ?? null,
      monthlyTargets: tenant?.monthlyTargets ?? {},
    });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await getAdminFromCookie(request);
    if (!admin) throw new UnauthorizedError();

    const body = await request.json();
    const parsed = bodySchema.parse(body);

    const tenant = await prisma.tenant.findUnique({
      where: { id: admin.tenantId },
      select: { monthlyTargets: true },
    });
    const merged: Record<string, number> = {
      ...((tenant?.monthlyTargets as Record<string, number> | null) ?? {}),
      ...parsed.monthlyTargets,
    };

    await prisma.tenant.update({
      where: { id: admin.tenantId },
      data: {
        yearTargets: {
          year: parsed.year,
          scenario: parsed.scenario,
          targetAnnualRevenue: parsed.targetAnnualRevenue,
          monthlyTargets: parsed.monthlyTargets,
          savedAt: new Date().toISOString(),
        },
        monthlyTargets: merged,
      },
    });

    return Response.json({ ok: true, year: parsed.year, scenario: parsed.scenario });
  } catch (err) {
    return errorResponse(err);
  }
}
