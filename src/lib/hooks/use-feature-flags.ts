"use client";

/**
 * Lightweight client-side feature-flag hooks.
 *
 * V3.5 plan §10 risk mitigation: BookingDetailFullPage replaces the legacy
 * BookingDetailSheet, which is the busiest admin surface. We keep both paths
 * mounted so a single env-var flip rolls back without a code deploy.
 *
 * Defaults to true on this branch — the redesign IS the v3.5 default. To
 * temporarily fall back to the legacy bottom-sheet (incident, A/B test):
 *   1. Set `NEXT_PUBLIC_FULL_PAGE_BOOKING_DETAIL=false` in Vercel env, OR
 *   2. Append `?legacyBookingDetail=1` to the calendar URL (per-session).
 *
 * Hook is a no-op on the server (returns the env-driven default) — the
 * URL-param override only kicks in after hydration.
 */

import { useState } from "react";

const ENV_DEFAULT =
  process.env.NEXT_PUBLIC_FULL_PAGE_BOOKING_DETAIL === "false" ? false : true;

function resolveFromQuery(): boolean {
  if (typeof window === "undefined") return ENV_DEFAULT;
  const sp = new URLSearchParams(window.location.search);
  if (sp.get("legacyBookingDetail") === "1") return false;
  if (sp.get("v35BookingDetail") === "1") return true;
  return ENV_DEFAULT;
}

export function useFullPageBookingDetailFlag(): boolean {
  // Lazy init reads URL once at mount — flag is non-reactive (admin won't
  // toggle it mid-session). Avoids the cascading-renders lint warning that
  // useEffect-based init would trigger.
  const [flag] = useState(resolveFromQuery);
  return flag;
}
