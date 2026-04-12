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

  // LINE WebView landing on root → redirect through LIFF URL to properly
  // initialize the native bridge. Without this, navigating from "/" to
  // "/booking" via a regular <a> link causes "Unable to load client features."
  // because the LIFF bridge was never established for this WebView session.
  if (pathname === "/") {
    const ua = request.headers.get("user-agent") || "";
    const isLine = /Line\//i.test(ua);
    const alreadyRedirected = request.cookies.has("liff_root_redirect");

    if (isLine && !alreadyRedirected) {
      const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
      if (liffId) {
        const res = NextResponse.redirect(
          `https://liff.line.me/${liffId}/booking`
        );
        // Prevent infinite redirect loop (cookie expires in 60s)
        res.cookies.set("liff_root_redirect", "1", { maxAge: 60 });
        return res;
      }
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
  const adminPaths = ["/dashboard", "/calendar", "/bookings", "/customers", "/services", "/analytics", "/campaigns", "/settings"];
  if (adminPaths.some((p) => pathname.startsWith(p))) {
    const token = request.cookies.get("admin_token");
    if (!token) {
      return NextResponse.redirect(new URL("/login", request.url));
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
    "/analytics/:path*",
    "/campaigns/:path*",
    "/settings/:path*",
  ],
};
