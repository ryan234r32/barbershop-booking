/**
 * V3.8 incident monitoring — external uptime monitor webhook receiver.
 *
 * 為什麼存在：
 *   Vercel Hobby plan 的 cron 一天最多 1 次，所以 internal `/api/cron/health-check`
 *   偵測 outage 最壞要 24 小時。讓外部服務（Better Stack / UptimeRobot 等）以
 *   3 分鐘間隔打 /api/health，掛掉就 webhook 進來，立刻推 LINE 給老闆。
 *
 * Auth：
 *   無 cookie / JWT — 用 shared secret（body.secret）防 abuse。
 *   uptime monitor 提供商通常允許在 outgoing webhook body 自填 JSON 模板。
 *
 * 不會 throw：
 *   - secret 不對 → 401（不要洩漏太多資訊給亂打的人）
 *   - body 格式爛 → 400（透過 errorResponse 把 ZodError 轉成 field-level 錯誤）
 *   - emergency alert push 失敗 → 200（webhook caller 不該 retry，alert 失敗只 log）
 *
 * 詳細設定步驟見 docs/uptime-monitoring-setup.md
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse } from "@/lib/utils/errors";
import { triggerEmergencyAlert } from "@/lib/notifications/emergency-alert";
import { logger } from "@/lib/utils/logger";

const uptimeAlertSchema = z.object({
  /** Shared secret，必須等於 env UPTIME_WEBHOOK_SECRET */
  secret: z.string().min(1),
  /** Monitor 名稱或 URL，e.g. "https://barbershop-booking.vercel.app/api/health" */
  monitor: z.string().min(1),
  /** 狀態 — 服務商通常 normalise 成 up/down */
  status: z.enum(["up", "down"]),
  /** 可選的人類可讀訊息（incident summary / response time / status code 等） */
  detail: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as unknown;
    const parsed = uptimeAlertSchema.parse(body);

    const expected = process.env.UPTIME_WEBHOOK_SECRET;
    if (!expected) {
      // Mis-configured deploy — fail closed so a leaked monitor URL can't spam.
      logger.error(
        "uptime-alert webhook hit but UPTIME_WEBHOOK_SECRET is not set",
        undefined,
        "webhook/uptime-alert",
      );
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (parsed.secret !== expected) {
      logger.warn(
        "uptime-alert webhook rejected: bad secret",
        "webhook/uptime-alert",
        { monitor: parsed.monitor },
      );
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isDown = parsed.status === "down";
    const headline = isDown
      ? `🔴 外部監控偵測到 DOWN：${parsed.monitor}`
      : `🟢 外部監控偵測到 RECOVERY：${parsed.monitor}`;
    const summary = parsed.detail
      ? `${headline}\n${parsed.detail}`
      : headline;

    logger.info(
      `uptime-alert received: ${parsed.status} ${parsed.monitor}`,
      "webhook/uptime-alert",
      { monitor: parsed.monitor, status: parsed.status },
    );

    // Fire-and-forget: never let alert push failure turn the webhook 5xx
    // (otherwise 監控商會 retry → cooldown 會吃掉 retry 但仍浪費 quota）
    void triggerEmergencyAlert({
      kind: "external_monitor",
      summary,
      url: parsed.monitor,
    });

    return Response.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
