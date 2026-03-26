import { NextRequest } from "next/server";

/**
 * Verify the CRON_SECRET from a Vercel Cron Job request.
 * Returns true if the authorization header matches `Bearer <CRON_SECRET>`.
 */
export function verifyCronSecret(request: NextRequest): boolean {
  const authHeader = request.headers.get("authorization");
  return authHeader === `Bearer ${process.env.CRON_SECRET}`;
}
