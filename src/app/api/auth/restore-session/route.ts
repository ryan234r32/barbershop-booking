import { NextRequest } from "next/server";
import { z } from "zod";
import { verifyAdminToken, setAdminCookie } from "@/lib/auth/jwt";
import { errorResponse, UnauthorizedError } from "@/lib/utils/errors";

const schema = z.object({ token: z.string().min(1) });

/**
 * POST /api/auth/restore-session
 *
 * Recovers an admin session when the HttpOnly cookie has been purged (iOS Safari
 * ITP after ~7 days) but the JWT in localStorage is still valid. Verifies the
 * token and re-issues the cookie with full 30d Max-Age.
 */
export async function POST(request: NextRequest) {
  try {
    const { token } = schema.parse(await request.json());
    const payload = verifyAdminToken(token);
    if (!payload) {
      throw new UnauthorizedError("token 無效或已過期");
    }
    return setAdminCookie(Response.json({ ok: true }), token);
  } catch (error) {
    return errorResponse(error);
  }
}
