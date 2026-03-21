/**
 * Environment variable validation.
 * Call this at app startup to fail fast if required vars are missing.
 */

const REQUIRED_ENV = [
  "DATABASE_URL",
  "JWT_SECRET",
  "DEFAULT_TENANT_ID",
] as const;

const REQUIRED_FOR_LINE = [
  "LINE_CHANNEL_ID",
  "LINE_CHANNEL_SECRET",
  "LINE_CHANNEL_ACCESS_TOKEN",
  "NEXT_PUBLIC_LIFF_ID",
] as const;

const REQUIRED_FOR_REDIS = [
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
] as const;

export function validateEnv() {
  const missing: string[] = [];

  for (const key of REQUIRED_ENV) {
    if (!process.env[key]) missing.push(key);
  }

  if (missing.length > 0) {
    console.warn(
      `[env] Missing required environment variables: ${missing.join(", ")}\n` +
      `  See .env.example for details.`
    );
  }

  // Warn (not crash) for optional integrations
  const missingLine = REQUIRED_FOR_LINE.filter((k) => !process.env[k]);
  if (missingLine.length > 0) {
    console.warn(`[env] LINE integration disabled — missing: ${missingLine.join(", ")}`);
  }

  const missingRedis = REQUIRED_FOR_REDIS.filter((k) => !process.env[k]);
  if (missingRedis.length > 0) {
    console.warn(`[env] Redis lock disabled — missing: ${missingRedis.join(", ")}`);
  }

  return { missing, missingLine, missingRedis };
}
