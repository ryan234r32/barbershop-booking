/**
 * V3.8 incident monitoring — healthchecks.io heartbeat ping.
 *
 * 為什麼要 healthchecks.io 而不是只靠 internal cron？
 *   - Vercel cron 自己掛掉 / 被 disable / quota 用完 → internal alert 也跟著沒了
 *   - healthchecks.io 是 dead-man's switch：「如果 25 小時沒收到 ping，就主動 alert 老闆」
 *   - 跟 /api/webhook/uptime-alert + Better Stack 互相補位（兩家不會同時掛）
 *
 * 設計：
 *   - HEALTHCHECKS_PING_URL 沒設 → silent skip（dev 環境不要叫）
 *   - 失敗也只 logger.warn，絕不 throw（不能讓 ping 自己破壞 cron）
 *   - 失敗用 GET <url>/fail 通知 healthchecks.io 我有跑但任務失敗
 */

import { logger } from "@/lib/utils/logger";

const PING_TIMEOUT_MS = 5_000;

/**
 * Send heartbeat ping to healthchecks.io.
 *
 * @param success — true → ping 主 URL（任務 ok），false → ping <url>/fail
 *                  讓 healthchecks.io 知道「cron 有跑但內部偵測到問題」。
 */
export async function pingHealthcheck(success: boolean): Promise<void> {
  const baseUrl = process.env.HEALTHCHECKS_PING_URL;
  if (!baseUrl) {
    // Silent skip — dev / 還沒設 env 的 deploy 環境
    return;
  }

  const url = success ? baseUrl : `${baseUrl.replace(/\/$/, "")}/fail`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PING_TIMEOUT_MS);

  try {
    const res = await fetch(url, { method: "GET", signal: controller.signal });
    if (!res.ok) {
      logger.warn(
        `healthcheck ping non-2xx: ${res.status}`,
        "healthcheck-ping",
        { url, success },
      );
      return;
    }
    logger.info(
      `healthcheck ping ok (success=${success})`,
      "healthcheck-ping",
    );
  } catch (err) {
    // Network error / abort — never throw, never break the caller
    logger.warn(
      `healthcheck ping failed: ${err instanceof Error ? err.message : String(err)}`,
      "healthcheck-ping",
      { url, success },
    );
  } finally {
    clearTimeout(timer);
  }
}
