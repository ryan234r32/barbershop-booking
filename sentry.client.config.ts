// V3.8 incident monitoring: Sentry browser-side error tracking.
//
// Graceful: SENTRY_DSN 未設則 init({ dsn: undefined })，SDK 變 no-op，
// 不會影響 production 行為。需要的時候到 Vercel env 加 NEXT_PUBLIC_SENTRY_DSN。

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn,
  // 沒 DSN 時 SDK 自動 no-op；不需要額外 if-guard
  enabled: Boolean(dsn),

  // Production 1% session replay; dev 100% 方便重現
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
  replaysSessionSampleRate: 0.0, // 預設關 — 老闆隱私 + bandwidth
  replaysOnErrorSampleRate: 1.0, // 但 error 發生時抓那段 replay

  // 過濾常見噪音
  ignoreErrors: [
    // LIFF SDK 在 LINE WebView 之外跑會 throw 這些
    "ReferenceError: liff is not defined",
    // Browser extension noise
    "Non-Error promise rejection captured",
    // Network blip
    "Failed to fetch",
    "Load failed",
  ],

  beforeSend(event) {
    // 不送任何包含 admin_token cookie 的 event 到 Sentry
    // (再保險，Sentry 預設有 PII filter 但雙重保險)
    if (event.request?.cookies) {
      delete event.request.cookies;
    }
    return event;
  },
});
