// V3.8 incident monitoring: Next.js instrumentation hook for Sentry init.
// Loaded once per runtime (server cold start / edge boot).
// Replaces the legacy sentry.server.config.ts auto-load (Next 15+ pattern).

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

// Sentry's @sentry/nextjs auto-attaches an unhandled error capture in v10+
// when withSentryConfig wraps next.config — no manual onRequestError export
// needed (was a v9 API).
