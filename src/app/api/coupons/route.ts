import { NextRequest } from "next/server";

/**
 * GET /api/coupons  — list coupons for current user / admin
 * POST /api/coupons — manually issue coupon (admin)
 *
 * Stub for Wave 4c — schema in place (PR #9), routes / UI / cron not yet built.
 */
export async function GET(_request: NextRequest) {
  return Response.json(
    {
      error: "Not Implemented",
      message: "Wave 4c not yet built — see docs/PRD-v3.md §8",
      schema: "Coupon model + Tenant.featureFlags exist (PR #9 wave-2c/coupon-schema)",
    },
    { status: 501 },
  );
}

export async function POST(_request: NextRequest) {
  return Response.json(
    {
      error: "Not Implemented",
      message: "Wave 4c not yet built — see docs/PRD-v3.md §8",
      schema: "Coupon model + Tenant.featureFlags exist (PR #9 wave-2c/coupon-schema)",
    },
    { status: 501 },
  );
}
