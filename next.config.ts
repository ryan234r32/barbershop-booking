import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";
import { withSentryConfig } from "@sentry/nextjs";

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
