import { NextResponse, type NextRequest } from "next/server";

// Simple in-memory rate limiter (per-IP, resets on cold start)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX = 60; // 60 requests per minute

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }

  entry.count++;
  return entry.count > RATE_LIMIT_MAX;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ─── LIFF Path Routing ───
  // When LINE opens https://liff.line.me/{ID}/my-bookings, LIFF SDK
  // redirects to the Endpoint URL with ?liff.state=%2Fmy-bookings
  // We need to extract that path and redirect accordingly.
  if (pathname === "/") {
    const liffState = request.nextUrl.searchParams.get("liff.state");
    if (liffState) {
      const targetPath = decodeURIComponent(liffState).split("?")[0];
      if (targetPath && targetPath !== "/") {
        const redirectUrl = new URL(targetPath, request.url);
        // Preserve other query params (excluding liff.state)
        request.nextUrl.searchParams.forEach((value, key) => {
          if (key !== "liff.state") {
            redirectUrl.searchParams.set(key, value);
          }
        });
        return NextResponse.redirect(redirectUrl);
      }
    }

    // LINE WebView landing on root without liff.state → default to /booking
    const ua = request.headers.get("user-agent") || "";
    const isLine = /Line\//i.test(ua);
    if (isLine) {
      return NextResponse.redirect(new URL("/booking", request.url));
    }
  }

  // Rate limiting for API routes
  if (pathname.startsWith("/api/")) {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0] || "unknown";
    if (isRateLimited(ip)) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429 }
      );
    }
  }

  // Admin routes protection (redirect to login if no token)
  // Cookie-only check — iOS Safari ITP can purge HttpOnly cookies after ~7 days
  // even though Max-Age is 30d. The login page auto-restores the session from
  // localStorage if a `from` query param is present.
  const adminPaths = ["/dashboard", "/calendar", "/bookings", "/customers", "/services", "/consultations", "/coupons", "/reports", "/analytics", "/campaigns", "/payments", "/settings", "/dev"];
  if (adminPaths.some((p) => pathname.startsWith(p))) {
    const token = request.cookies.get("admin_token");
    if (!token) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("from", pathname + request.nextUrl.search);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/api/:path*",
    "/dashboard/:path*",
    "/calendar/:path*",
    "/bookings/:path*",
    "/customers/:path*",
    "/services/:path*",
    "/consultations/:path*",
    "/coupons/:path*",
    "/reports/:path*",
    "/analytics/:path*",
    "/campaigns/:path*",
    "/payments/:path*",
    "/settings/:path*",
    "/dev/:path*",
  ],
};
