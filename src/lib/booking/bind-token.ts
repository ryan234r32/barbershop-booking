/**
 * 一次性 token 把 walk-in 客人 (manual user) 跟一筆預約「綁定」到真實 LINE 帳號。
 *
 * 流程：
 *   1. admin 結帳時偵測 user.lineUserId.startsWith("manual-")，按「邀請加 LINE」
 *   2. 後端產 token 「BIND-<32 hex>」存 Redis (TTL 10 分鐘)，回傳給前端產 QR
 *   3. 客人掃 QR → LINE 開啟對話框、預填 BIND-xxx → 客人按傳送
 *   4. webhook 收到 BIND-xxx 訊息 → 查 Redis 找出 bookingId → 把該 booking 的
 *      user.lineUserId 從 manual-* 改成真實 lineUserId，並 push 銀行 Flex
 *
 * 安全考量：
 *   - 128 bit randomBytes，不可猜
 *   - 10 分鐘 expire（短得讓掉走的 token 不易被重用）
 *   - 一次性使用（webhook 認 token 後會 delete，避免被重複用）
 */
import { randomBytes } from "node:crypto";
import { getRedis } from "@/lib/redis";

const NAMESPACE = "bind-line-token";
const TOKEN_TTL_SECONDS = 600; // 10 分鐘
const TOKEN_PREFIX = "BIND-";

interface BindTokenPayload {
  /** 要被升級的 booking id (其 user.lineUserId 仍是 manual-*) */
  bookingId: string;
  /** Tenant 隔離 — webhook 認 token 時要 cross-check */
  tenantId: string;
  /** 產 token 的時間 ISO，方便後續查 audit log */
  createdAt: string;
}

function tokenKey(token: string): string {
  return `${NAMESPACE}:${token}`;
}

/**
 * 產一個新 token，存進 Redis，回傳 token 字串（含 BIND- prefix）。
 */
export async function createBindToken(payload: Omit<BindTokenPayload, "createdAt">): Promise<string> {
  const token = `${TOKEN_PREFIX}${randomBytes(16).toString("hex")}`;
  const value: BindTokenPayload = {
    ...payload,
    createdAt: new Date().toISOString(),
  };
  await getRedis().set(tokenKey(token), JSON.stringify(value), { ex: TOKEN_TTL_SECONDS });
  return token;
}

/**
 * 查 token 對應的 payload（不刪）。回 null 表示 token 不存在 / 已過期。
 */
export async function getBindToken(token: string): Promise<BindTokenPayload | null> {
  if (!token.startsWith(TOKEN_PREFIX)) return null;
  try {
    const raw = await getRedis().get<string>(tokenKey(token));
    if (!raw) return null;
    return JSON.parse(raw) as BindTokenPayload;
  } catch {
    return null;
  }
}

/**
 * 一次性消費 token：找到後立刻刪除，避免被同一 token 綁兩次。
 * 回 null 表示 token 不存在 / 已過期 / 已被其他人消費。
 */
export async function consumeBindToken(token: string): Promise<BindTokenPayload | null> {
  if (!token.startsWith(TOKEN_PREFIX)) return null;
  try {
    const r = getRedis();
    const raw = await r.get<string>(tokenKey(token));
    if (!raw) return null;
    // 用 del 而不是事務 — Upstash REST API 沒有 transaction，但 token 本身已
    // 是 single-use，就算極小機率被兩個 webhook 同時看到，第二個的 update
    // 會發現 user.lineUserId 已被改過（不再是 manual-*），可以另外攔截。
    await r.del(tokenKey(token));
    return JSON.parse(raw) as BindTokenPayload;
  } catch {
    return null;
  }
}

/** 給 webhook intent 判斷用 — 訊息文字是不是 BIND token 格式。 */
export function isBindTokenMessage(text: string): boolean {
  return /^BIND-[0-9a-f]{32}$/.test(text.trim());
}
