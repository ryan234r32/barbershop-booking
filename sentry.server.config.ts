// V3.8 incident monitoring: Sentry Node.js (Vercel server functions) errors.

import * as Sentry from "@sentry/nextjs";
import { triggerEmergencyAlert } from "@/lib/notifications/emergency-alert";

const dsn = process.env.SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: Boolean(dsn),

  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  ignoreErrors: [
    // Vercel function timeout (already alarming via UptimeRobot)
    "FUNCTION_INVOCATION_TIMEOUT",
  ],

  beforeSend(event) {
    // V3.8: Sentry beforeSend 是 LINE 緊急推播的 hook 點。
    // 條件：5xx error 才推（4xx 是用戶輸入錯誤不是系統壞掉）
    // Rate-limit + cooldown 在 emergency-alert lib 裡處理
    const isServerError =
      event.level === "error" || event.level === "fatal";
    if (isServerError && process.env.ADMIN_LINE_USER_ID) {
      const errorMessage =
        event.exception?.values?.[0]?.value ?? event.message ?? "unknown error";
      // Fire-and-forget，不 block Sentry pipeline
      void triggerEmergencyAlert({
        kind: "server_error",
        summary: errorMessage.slice(0, 200),
        url: event.request?.url,
      });
    }
    return event;
  },
});
