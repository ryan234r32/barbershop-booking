import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";
import { withSentryConfig } from "@sentry/nextjs";

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
});

// Baseline hardening. HSTS is applied by Vercel at the edge.
//
// CSP — single permissive policy ship-able today. Keep `unsafe-inline` for
// styles (Tailwind injects inline) and `unsafe-eval` for Next.js dev runtime
// + Sentry dynamic instrumentation. Frame-ancestors 'none' duplicates
// X-Frame-Options DENY for browsers that prefer one over the other.
//
// Allowlist breakdown (verified against actual app loads — see /qa run 2026-05-05):
//   script-src   liff.line.me + static.line-scdn.net   → LIFF SDK
//                vercel.live                            → Vercel preview toolbar
//   style-src    fonts.googleapis.com                   → Manrope + Noto Sans TC stylesheet
//   font-src     fonts.gstatic.com                      → Google Fonts file payloads
//   img-src      *.line-scdn.net + *.supabase.co        → LINE profile + storage uploads
//                data: blob: https:                     → uploaded screenshots, QR codes
//   connect-src  api.line.me + *.supabase.co            → LIFF verify, DB direct (RLS)
//                *.sentry.io                            → Sentry error reporting (covers all ingest subdomains)
//                *.upstash.io                           → Redis REST (server-side; client doesn't hit)
//   worker-src   self blob:                             → Serwist PWA service worker
const cspParts = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://static.line-scdn.net https://liff.line.me https://vercel.live",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: blob: https:",
  "connect-src 'self' https://api.line.me https://liff.line.me https://*.line-scdn.net https://*.supabase.co https://*.sentry.io https://*.upstash.io",
  "font-src 'self' data: https://fonts.gstatic.com",
  "frame-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
];

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "geolocation=(), camera=(), microphone=(), payment=(), usb=()",
  },
  { key: "Content-Security-Policy", value: cspParts.join("; ") },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // ecpay_aio_nodejs reads ECpayPayment.xml via __dirname at runtime — webpack/turbopack
  // can't trace that. Keep it external so file resolution works from node_modules.
  serverExternalPackages: ["ecpay_aio_nodejs"],
  // V3.8 perf (Wave 2): tree-shake icon barrel imports. lucide-react ships ~1500
  // icons; admin uses ~30. Without this, every dev rebuild re-evaluates the entire
  // barrel and prod bundle drags in unused icons. date-fns has the same problem.
  experimental: {
    optimizePackageImports: ["lucide-react", "date-fns"],
  },
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
      // V3.8 consolidation: /payments + /cash-flow 砍掉 (老闆說末5碼搜尋不要)
      { source: "/payments", destination: "/reports?view=daily", permanent: false },
      { source: "/payments/:path*", destination: "/reports?view=daily", permanent: false },
      { source: "/cash-flow", destination: "/reports?view=daily", permanent: false },
    ];
  },
};

// V3.8 incident monitoring: 包 withSentryConfig — sourcemap upload + 自動
// instrumentation。SENTRY_DSN 沒設時 SDK no-op，build 不會失敗。
const sentryWebpackPluginOptions = {
  silent: true, // build log 不要被 Sentry CLI 噪音淹沒
  // SENTRY_AUTH_TOKEN 沒設時跳過 sourcemap upload（dev 友善 + 不洩漏給 OSS）
  disableSourceMapUpload: !process.env.SENTRY_AUTH_TOKEN,
};

export default withSentryConfig(withSerwist(nextConfig), sentryWebpackPluginOptions);
