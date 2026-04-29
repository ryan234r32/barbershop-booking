/**
 * V3.6 Phase H — 服務分群自動推播系統 (§14)
 *
 * 三段式留客推播：軟提醒 → 優惠券 → 召回券。基於 4/27 使用者統計分析的
 * 核心客中位週期（剪 35 / 染 31 / 燙 90 天）。
 *
 * 死忠客排除（最後 3 次間隔中位 < 全店 q25 → 跳過軟提醒/優惠券，但召回券仍發）
 * 防騷擾：客戶 7 天 cooldown / 全店每日 50 則上限 / 09-21 時間窗 / opt-out 可關閉
 */

import { prisma } from "@/lib/prisma";
import { getLineClient } from "@/lib/line/client";
import { logger } from "@/lib/utils/logger";
import { todayInTaipei } from "@/lib/utils/time";

export type ServiceCategory = "剪髮" | "染髮" | "燙髮";

export type Stage = "softReminder" | "discount10" | "winback";

export interface ServiceRule {
  softReminder: number;      // days since last service → 軟提醒
  discount10: number;        // days → 9 折券
  winback: number;           // days → 召回券
  expireAfterDays: number;   // 券有效期
}

/**
 * V3.6 §14.2 — RETENTION_RULES。寫死於程式，老闆 demo 確認後可擴成 DB-backed。
 */
export const RETENTION_RULES: Record<ServiceCategory, ServiceRule> = {
  剪髮: { softReminder: 35, discount10: 49, winback: 70, expireAfterDays: 14 },
  染髮: { softReminder: 31, discount10: 56, winback: 90, expireAfterDays: 14 },
  燙髮: { softReminder: 90, discount10: 120, winback: 150, expireAfterDays: 21 },
  // 護髮先暫不啟用（V3.6 §14.1：產品問題、應做問卷不發券）
};

/** V3.6 §14.3 — 全店服務 Q25 中位（為死忠客判定門檻） */
export const STORE_Q25_DAYS: Record<ServiceCategory, number> = {
  剪髮: 29,
  染髮: 30,
  燙髮: 97,
};

export const DAILY_PUSH_LIMIT = 50;
export const COOLDOWN_DAYS = 7;
export const SEND_HOUR_START = 9;
export const SEND_HOUR_END = 21;

const CATEGORY_RULES: { test: (n: string) => boolean; cat: ServiceCategory }[] = [
  { test: (n) => n.includes("剪") || n.includes("瀏海"), cat: "剪髮" },
  { test: (n) => n.includes("染") || n.includes("補染") || n.includes("漂"), cat: "染髮" },
  { test: (n) => n.includes("燙") || n.includes("矯正"), cat: "燙髮" },
];

export function classifyService(name: string): ServiceCategory | null {
  for (const { test, cat } of CATEGORY_RULES) if (test(name)) return cat;
  return null;
}

/**
 * V3.6 §14.3 — 死忠客判定：最後 3 次同類服務間隔的中位 < 全店該服務 q25
 */
export async function isLoyalCustomer(
  tenantId: string,
  userId: string,
  serviceCategory: ServiceCategory,
): Promise<boolean> {
  const bookings = await prisma.booking.findMany({
    where: {
      tenantId,
      userId,
      status: { in: ["CONFIRMED", "COMPLETED"] },
    },
    select: { date: true, service: { select: { name: true } } },
    orderBy: { date: "desc" },
    take: 10,
  });

  const sameCat = bookings.filter((b) => classifyService(b.service.name) === serviceCategory);
  if (sameCat.length < 4) return false;

  // 取最近 4 次（從新到舊），算間隔
  const recent4 = sameCat.slice(0, 4).sort((a, b) => a.date.getTime() - b.date.getTime());
  const intervals: number[] = [];
  for (let i = 1; i < recent4.length; i++) {
    const days = Math.round(
      (recent4[i].date.getTime() - recent4[i - 1].date.getTime()) / (24 * 3600 * 1000),
    );
    intervals.push(days);
  }
  if (intervals.length === 0) return false;

  const sorted = [...intervals].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  return median < STORE_Q25_DAYS[serviceCategory];
}

/**
 * Cooldown check: 該客戶過去 7 天內有沒有發過任何 retention push
 */
export async function hasCooldown(
  tenantId: string,
  userId: string,
): Promise<boolean> {
  const since = new Date(Date.now() - COOLDOWN_DAYS * 24 * 3600 * 1000);
  const recent = await prisma.pushSchedule.findFirst({
    where: {
      tenantId,
      userId,
      status: "SENT",
      sentAt: { gte: since },
    },
    select: { id: true },
  });
  return recent != null;
}

/**
 * 全店每日上限 — 防止 LINE rate-limit + 客戶整批被打擾
 */
export async function todayPushCount(tenantId: string): Promise<number> {
  const todayIso = todayInTaipei();
  const [yStr, mStr, dStr] = todayIso.split("-").map(Number);
  const start = new Date(Date.UTC(yStr, mStr - 1, dStr, -8, 0, 0));
  const end = new Date(Date.UTC(yStr, mStr - 1, dStr, 15, 59, 59, 999));
  return prisma.pushSchedule.count({
    where: {
      tenantId,
      status: "SENT",
      sentAt: { gte: start, lte: end },
    },
  });
}

/**
 * 候選客戶：最後一次該服務的日期 = today - rule.days
 *
 * 容差：今天往回算的「目標日」前後 1 天視為命中（cron 跑時間 ± slip）。
 */
export async function findCandidates(
  tenantId: string,
  service: ServiceCategory,
  daysBack: number,
): Promise<Array<{ userId: string; lastVisit: Date; lineUserId: string }>> {
  const target = new Date();
  target.setDate(target.getDate() - daysBack);
  const targetIso = target.toLocaleDateString("en-CA", { timeZone: "Asia/Taipei" });
  const [y, m, d] = targetIso.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, d - 1, -8, 0, 0));
  const end = new Date(Date.UTC(y, m - 1, d + 1, 15, 59, 59, 999));

  const bookings = await prisma.booking.findMany({
    where: {
      tenantId,
      status: { in: ["CONFIRMED", "COMPLETED"] },
      date: { gte: start, lte: end },
    },
    select: {
      userId: true,
      date: true,
      service: { select: { name: true } },
      user: { select: { lineUserId: true, marketingOptOut: true } },
    },
  });

  const seen = new Set<string>();
  const out: Array<{ userId: string; lastVisit: Date; lineUserId: string }> = [];
  for (const b of bookings) {
    if (classifyService(b.service.name) !== service) continue;
    if (seen.has(b.userId)) continue;
    if (!b.user) continue;
    if (b.user.marketingOptOut) continue;
    if (
      !b.user.lineUserId ||
      b.user.lineUserId.startsWith("manual-") ||
      b.user.lineUserId.startsWith("legacy-")
    ) {
      continue;
    }
    seen.add(b.userId);
    out.push({ userId: b.userId, lastVisit: b.date, lineUserId: b.user.lineUserId });
  }
  return out;
}

interface PushOptions {
  tenantId: string;
  userId: string;
  lineUserId: string;
  service: ServiceCategory;
  stage: Stage;
}

/**
 * 發出推播（含 LINE message build）+ 寫 PushSchedule 紀錄
 */
export async function sendRetentionPush({
  tenantId,
  userId,
  lineUserId,
  service,
  stage,
}: PushOptions): Promise<{ ok: boolean; reason?: string; couponId?: string }> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { businessName: true, liffId: true },
  });
  const businessName = tenant?.businessName ?? "我們";
  const liffUrl = tenant?.liffId ? `https://liff.line.me/${tenant.liffId}` : undefined;

  let couponId: string | undefined;
  let message: string;
  const rule = RETENTION_RULES[service];

  if (stage === "softReminder") {
    message =
      `${stageHeader(service)} ${rule.softReminder} 天囉～\n` +
      `想再剪/染/燙的話，直接回我這個訊息就行了 ✂️\n\n` +
      (liffUrl ? `預約：${liffUrl}` : "歡迎隨時聯絡 🙌");
  } else if (stage === "discount10") {
    couponId = await issueRetentionCoupon(tenantId, userId, "RETENTION_DISCOUNT", rule.expireAfterDays);
    message =
      `🎟️ ${businessName}送您 9 折券\n\n` +
      `${stageHeader(service)} 約 ${rule.discount10} 天，再試試看吧～\n` +
      `優惠碼：${couponId.slice(0, 8).toUpperCase()}\n` +
      `${rule.expireAfterDays} 天內預約有效\n\n` +
      (liffUrl ? `立即預約：${liffUrl}` : "預約時跟我們說優惠碼即可折抵");
  } else {
    couponId = await issueRetentionCoupon(tenantId, userId, "RETENTION_WINBACK", rule.expireAfterDays);
    message =
      `💝 ${businessName}很想念您\n\n` +
      `好久不見了～送您 8 折召回券，希望您再來坐坐\n` +
      `優惠碼：${couponId.slice(0, 8).toUpperCase()}\n` +
      `${rule.expireAfterDays} 天內預約有效\n\n` +
      (liffUrl ? `預約：${liffUrl}` : "回覆此訊息即可預約");
  }

  try {
    const client = getLineClient();
    await client.pushMessage(lineUserId, { type: "text", text: message });

    await prisma.pushSchedule.create({
      data: {
        tenantId,
        userId,
        serviceCategory: service,
        stage: stageEnum(stage),
        scheduledFor: new Date(),
        status: "SENT",
        sentAt: new Date(),
        couponId,
      },
    });
    return { ok: true, couponId };
  } catch (err) {
    logger.error("retention push failed", err, "cron", { userId, service, stage });
    await prisma.pushSchedule.create({
      data: {
        tenantId,
        userId,
        serviceCategory: service,
        stage: stageEnum(stage),
        scheduledFor: new Date(),
        status: "FAILED",
        errorMessage: String(err),
      },
    });
    return { ok: false, reason: String(err) };
  }
}

async function issueRetentionCoupon(
  tenantId: string,
  userId: string,
  reason: "RETENTION_DISCOUNT" | "RETENTION_WINBACK",
  expireAfterDays: number,
): Promise<string> {
  const code = `R${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  const discountPct = reason === "RETENTION_WINBACK" ? 20 : 10;
  const c = await prisma.coupon.create({
    data: {
      tenantId,
      userId,
      code,
      type: "MANUAL",
      discountPct,
      issuedAt: new Date(),
      expiresAt: new Date(Date.now() + expireAfterDays * 24 * 3600 * 1000),
      issuedReason: reason,
    },
    select: { id: true },
  });
  return c.id;
}

function stageHeader(service: ServiceCategory): string {
  if (service === "剪髮") return "上次剪髮";
  if (service === "染髮") return "上次染髮";
  return "上次燙髮";
}

function stageEnum(stage: Stage): "SOFT_REMINDER" | "DISCOUNT_10" | "WINBACK" {
  if (stage === "softReminder") return "SOFT_REMINDER";
  if (stage === "discount10") return "DISCOUNT_10";
  return "WINBACK";
}
