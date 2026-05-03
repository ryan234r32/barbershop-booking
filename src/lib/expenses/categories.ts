/**
 * V3.7 §1 — expense category constants shared between API + UI.
 * Adding a new category: extend EXPENSE_CATEGORIES, then update the
 * Zod enum in `/api/expenses/route.ts` + `[id]/route.ts`.
 */

export const EXPENSE_CATEGORIES = [
  "consumables",
  "utilities",
  "rent",
  "equipment",
  "cleaning",
  "marketing",
  "tax",
  "other",
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  consumables: "耗材",
  utilities: "水電",
  rent: "房租",
  equipment: "設備",
  cleaning: "清潔",
  marketing: "行銷",
  tax: "稅務",
  other: "其他",
};

/**
 * Default `type` (FIXED/VARIABLE) per category. Used to pre-select the right
 * radio when the user taps a category chip — they can still flip it.
 */
export const CATEGORY_DEFAULT_TYPE: Record<ExpenseCategory, "FIXED" | "VARIABLE"> = {
  consumables: "VARIABLE",
  utilities: "FIXED",
  rent: "FIXED",
  equipment: "VARIABLE",
  cleaning: "VARIABLE",
  marketing: "VARIABLE",
  tax: "FIXED",
  other: "VARIABLE",
};
