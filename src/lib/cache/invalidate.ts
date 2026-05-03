/**
 * V3.7 §Y — server-side cache invalidation helper.
 *
 * Background:
 *   /api/reports/v3.6 wraps each view in `unstable_cache` with a 60-second TTL
 *   and tag "reports" (PR #71 silky-pass-2). Without explicit invalidation,
 *   admin actions like settle / checkout / new expense don't show up until the
 *   60-second TTL elapses or the user navigates away and back — which is
 *   exactly the "按已對帳後今日應收沒立刻更新" bug JJ reported on 2026-05-03.
 *
 * Usage:
 *   import { invalidateReportsCache } from "@/lib/cache/invalidate";
 *
 *   // In any mutating route handler, AFTER successful DB write:
 *   invalidateReportsCache();
 *
 * Safe to call multiple times in one request (idempotent). Fire-and-forget;
 * errors are swallowed so the user-facing response never blocks on it.
 */

import { revalidateTag } from "next/cache";
import { logger } from "@/lib/utils/logger";

/**
 * Invalidate all server-side caches tagged "reports".
 * Affects /api/reports/v3.6 daily/monthly/annual responses.
 */
export function invalidateReportsCache(): void {
  try {
    // Next 16 changed `revalidateTag` signature to (tag, profile).
    // "default" profile = standard expiry behavior matching the unstable_cache TTL.
    revalidateTag("reports", "default");
  } catch (err) {
    // Don't let cache invalidation failure break the API response.
    logger.warn("invalidateReportsCache failed", {
      err: err instanceof Error ? err.message : String(err),
    });
  }
}
