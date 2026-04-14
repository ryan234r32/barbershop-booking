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

export function classifyIntent(text: string): KeywordIntent {
  const t = text.toLowerCase();
  if (matchKeywords(t, ["我的預約", "我預約", "我約了", "預約了什麼", "查詢", "紀錄", "記錄"])) return "my-bookings";
  if (matchKeywords(t, ["取消", "改時間", "更改", "改期", "cancel"])) return "cancel-reschedule";
  if (matchKeywords(t, ["預約", "訂位", "約時間", "book"])) return "booking";
  if (matchKeywords(t, ["服務", "價格", "價目", "多少錢", "幾錢", "收費", "費用", "price"])) return "pricing";
  if (matchKeywords(t, ["付款", "轉帳", "匯款", "帳號"])) return "payment";
  if (matchKeywords(t, ["時間", "營業", "幾點", "週幾", "地址", "地點", "位置", "在哪", "怎麼去", "怎麼走"])) return "business-info";
  if (matchKeywords(t, ["電話", "聯絡", "打電話", "手機"])) return "phone";
  if (matchKeywords(t, ["謝謝", "感謝", "thanks", "thank you"])) return "thanks";
  if (matchKeywords(t, ["你好", "哈囉", "hi", "hello", "嗨"])) return "greeting";
  return "none";
}
