/**
 * Client-side helper to build auth headers for admin API calls.
 *
 * Uses localStorage Bearer token as a fallback when the admin_token cookie
 * is stripped (iOS PWA / ITP). The server accepts both cookie and Bearer —
 * see src/lib/auth/jwt.ts getAdminFromCookie().
 *
 * Usage:
 *   fetch(url, { method: "PATCH", headers: adminHeaders(), body: ... })
 */
export function adminHeaders(extra?: Record<string, string>): HeadersInit {
  const bearer =
    typeof window !== "undefined" ? localStorage.getItem("admin_token") : null;
  return {
    "Content-Type": "application/json",
    ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
    ...(extra || {}),
  };
}
