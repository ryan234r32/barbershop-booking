import { NextRequest } from "next/server";

/**
 * GET /api/consultations  — list consultation requests (admin)
 * POST /api/consultations — create new consultation request (LIFF / webhook)
 *
 * Stub for Wave 4a — schema in place (PR #8), routes / UI not yet built.
 * Returns 501 with PRD breadcrumb so frontend devs see the contract surface
 * but no caller mistakes this for production-ready.
 */
export async function GET(_request: NextRequest) {
  return Response.json(
    {
      error: "Not Implemented",
      message: "Wave 4a not yet built — see docs/PRD-v3.md §3",
      schema: "ConsultationRequest model exists (PR #8 wave-2b/consultation-request-schema)",
    },
    { status: 501 },
  );
}

export async function POST(_request: NextRequest) {
  return Response.json(
    {
      error: "Not Implemented",
      message: "Wave 4a not yet built — see docs/PRD-v3.md §3",
      schema: "ConsultationRequest model exists (PR #8 wave-2b/consultation-request-schema)",
    },
    { status: 501 },
  );
}
