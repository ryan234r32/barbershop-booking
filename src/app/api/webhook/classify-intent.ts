/**
 * LINE webhook keyword → intent classification.
 *
 * Pure function, no DB / no side effects. Kept separate from route.ts so it
 * can be imported by tests and by the admin keyword-preview dev tool —
 * Next.js forbids re-exporting non-handler symbols from `route.ts`.
 */

export type KeywordIntent =
  | "my-bookings"
  | "cancel-reschedule"
  | "service-inquiry-perm"
  | "service-inquiry-color"
  | "service-inquiry-bleach"
  | "booking"
  | "pricing"
  | "payment"
  | "business-info"
  | "phone"
  | "thanks"
  | "greeting"
  | "none";

function matchKeywords(text: string, keywords: string[]): boolean {
  return keywords.some((kw) => text.includes(kw));
}

/**
 * Negative-match guard: returns true when text contains any non-service usage
 * of 燙 / 染 to avoid false positives like 「燙手」「燙傷」「染色筆」.
 */
function isNonServiceUsage(text: string): boolean {
  const exclusions = [
    "燙手", "燙傷", "燙到", "燙嘴", "燙口", "好燙", "很燙", "太燙",
    "染色筆", "染料", "傳染", "汙染", "感染",
    "漂白水", "漂白劑",
  ];
  return exclusions.some((kw) => text.includes(kw));
}

export function classifyIntent(text: string): KeywordIntent {
  const t = text.toLowerCase();
  if (matchKeywords(t, ["我的預約", "我預約", "我約了", "預約了什麼", "查詢", "紀錄", "記錄"])) return "my-bookings";
  if (matchKeywords(t, ["取消", "不約了", "不來了", "改時間", "更改", "改期", "換時間", "改一下", "cancel"])) return "cancel-reschedule";

  // Service inquiry — 燙 / 染 / 漂. 漂髮 routes to consultation flow (Wave 4a)
  // because it requires owner judgement on hair condition.
  // Negative-match guard to avoid 「燙手」「燙傷」「漂白水」 false positives.
  if (!isNonServiceUsage(t)) {
    if (matchKeywords(t, ["漂髮", "想漂", "要漂", "漂頭髮", "bleach"])) return "service-inquiry-bleach";
    if (matchKeywords(t, ["燙髮", "想燙", "要燙", "燙頭髮", "perm"])) return "service-inquiry-perm";
    if (matchKeywords(t, ["染髮", "想染", "要染", "染頭髮", "color"])) return "service-inquiry-color";
    // Standalone single-char must be exact match (avoid 「燙手」「染色」 false positives).
    if (t.trim() === "漂") return "service-inquiry-bleach";
    if (t.trim() === "燙") return "service-inquiry-perm";
    if (t.trim() === "染") return "service-inquiry-color";
  }

  if (matchKeywords(t, ["預約", "訂位", "約時間", "book"])) return "booking";
  if (matchKeywords(t, ["服務", "價格", "價目", "多少錢", "幾錢", "收費", "費用", "price"])) return "pricing";
  if (matchKeywords(t, ["付款", "轉帳", "匯款", "帳號"])) return "payment";
  if (matchKeywords(t, ["時間", "營業", "幾點", "週幾", "地址", "地點", "位置", "在哪", "怎麼去", "怎麼走"])) return "business-info";
  if (matchKeywords(t, ["電話", "聯絡", "打電話", "手機"])) return "phone";
  if (matchKeywords(t, ["謝謝", "感謝", "thanks", "thank you"])) return "thanks";
  if (matchKeywords(t, ["你好", "哈囉", "hi", "hello", "嗨"])) return "greeting";
  return "none";
}
