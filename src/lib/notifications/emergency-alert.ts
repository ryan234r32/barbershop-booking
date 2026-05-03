/**
 * V3.8 incident monitoring — LINE 老闆緊急推播。
 *
 * Triggers (called from各種 hook 點):
 *   - Sentry beforeSend on server 5xx errors
 *   - /api/cron/health-check 偵測 DB / Redis / LINE 失敗時
 *   - /api/webhook 連續 signature failure 5 次
 *
 * 設計原則：
 *   - 只在 ADMIN_LINE_USER_ID 設定時 push
 *   - Cooldown：同一 kind 5 分鐘內只推 1 次（避免風暴）
 *   - Rate limit：全 kind 1 小時內最多 6 次推播
 *   - 推播失敗永遠 console.warn，不 throw（不能讓 alert 自己破壞 business logic）
 */

import { getLineClient } from "@/lib/line/client";
import { logger } from "@/lib/utils/logger";

type AlertKind =
  | "server_error" // Sentry 5xx
  | "db_unreachable" // health check DB fail
  | "redis_unreachable" // health check Redis fail
  | "line_webhook_attack" // 5 連續 signature fail
  | "line_api_quota" // LINE OA 配額用完
  | "manual"; // 手動測試

interface AlertParams {
  kind: AlertKind;
  /** Short summary (≤200 chars) */
  summary: string;
  /** Optional context URL (Vercel logs / Sentry issue / etc) */
  url?: string;
}

/** In-process cooldown map: kind → last-sent timestamp (ms). */
const lastSent: Record<string, number> = {};
const COOLDOWN_MS_PER_KIND = 5 * 60 * 1000; // 5 分鐘
let hourlyCount = 0;
let hourlyWindowStart = Date.now();
const HOURLY_LIMIT = 6;
const HOURLY_WINDOW_MS = 60 * 60 * 1000;

function withinCooldown(kind: AlertKind): boolean {
  const now = Date.now();
  const last = lastSent[kind] ?? 0;
  return now - last < COOLDOWN_MS_PER_KIND;
}

function withinRateLimit(): boolean {
  const now = Date.now();
  if (now - hourlyWindowStart >= HOURLY_WINDOW_MS) {
    hourlyCount = 0;
    hourlyWindowStart = now;
  }
  return hourlyCount < HOURLY_LIMIT;
}

const KIND_LABEL: Record<AlertKind, string> = {
  server_error: "🔥 系統錯誤（5xx）",
  db_unreachable: "🚨 資料庫連線失敗",
  redis_unreachable: "⚠️ Redis 連線失敗（預約 lock 受影響）",
  line_webhook_attack: "🛡️ LINE webhook 異常（疑似攻擊）",
  line_api_quota: "📵 LINE 推播配額用完",
  manual: "ℹ️ 手動測試 alert",
};

/**
 * Send emergency LINE message to owner. Best-effort — never throws.
 */
export async function triggerEmergencyAlert(params: AlertParams): Promise<void> {
  const { kind, summary, url } = params;
  const adminLineUserId = process.env.ADMIN_LINE_USER_ID;
  if (!adminLineUserId) {
    logger.warn(
      `emergency alert skipped (no ADMIN_LINE_USER_ID): ${kind} — ${summary}`,
      "emergency-alert",
    );
    return;
  }

  if (withinCooldown(kind)) {
    logger.info(
      `emergency alert suppressed by cooldown: ${kind}`,
      "emergency-alert",
    );
    return;
  }

  if (!withinRateLimit()) {
    logger.warn(
      `emergency alert suppressed by hourly rate limit: ${kind}`,
      "emergency-alert",
    );
    return;
  }

  const label = KIND_LABEL[kind];
  const text = [
    label,
    "",
    summary.slice(0, 400),
    url ? `\n→ ${url}` : "",
    "",
    "⏰ " + new Date().toLocaleString("zh-TW", { timeZone: "Asia/Taipei" }),
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const client = getLineClient();
    await client.pushMessage(adminLineUserId, { type: "text", text });
    lastSent[kind] = Date.now();
    hourlyCount++;
    logger.info(`emergency alert sent: ${kind}`, "emergency-alert");
  } catch (err) {
    // Never throw — alert failure shouldn't break business logic
    logger.error(
      `emergency alert send failed: ${kind}`,
      err instanceof Error ? err : new Error(String(err)),
      "emergency-alert",
    );
  }
}
