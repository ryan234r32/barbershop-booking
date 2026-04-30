import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
});

// Baseline hardening. CSP is deliberately NOT here — LINE LIFF injects inline
// scripts from liff.line.me and this app loads the LIFF SDK + profile images
// from line-scdn.net, so a strict CSP needs per-route tuning. HSTS is already
// applied by Vercel at the edge.
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "geolocation=(), camera=(), microphone=(), payment=(), usb=()",
  },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // ecpay_aio_nodejs reads ECpayPayment.xml via __dirname at runtime — webpack/turbopack
  // can't trace that. Keep it external so file resolution works from node_modules.
  serverExternalPackages: ["ecpay_aio_nodejs"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "profile.line-scdn.net" },
      { protocol: "https", hostname: "*.supabase.co" },
    ],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  async redirects() {
    return [
      // V3.8 consolidation: /analytics 已被 /reports?view=monthly 取代
      { source: "/analytics", destination: "/reports?view=monthly", permanent: false },
      // V3.8 consolidation: /consultations admin UI 砍掉，回日曆
      { source: "/consultations", destination: "/calendar", permanent: false },
      // V3.8 consolidation: /dashboard 由 V3.6 daily view 取代
      { source: "/dashboard", destination: "/reports?view=daily", permanent: false },
    ];
  },
};

export default withSerwist(nextConfig);
