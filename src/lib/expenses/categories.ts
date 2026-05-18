/**
 * V3.7 §1 — expense category constants shared between API + UI.
 *
 * Categories are grouped by FIXED / VARIABLE so the UI can show two scoped
 * chip sets (the user picks 變動/固定 first, then a sub-category). When the
 * user picks "其他", the UI prompts for a custom item label which we save
 * into `Expense.notes` (no schema migration needed).
 *
 * Category list informed by 2024-2026 Excel scan (scripts/audit-expense-items.ts):
 *   水費 / 電費 / 網路費 / 中華電 / 國泰中信永豐卡費 (→ utilities, internet, insurance)
 *   髮油 / 髮油髮乳 / 熱燙藥水 / 可萊茵優油 (→ supplies)
 *   日進傢俱 / 星展電推剪 (→ equipment)
 *   保時捷 (→ maintenance — owner's car servicing slot)
 *   廠商 (→ supplies / equipment depending on context)
 */

export const FIXED_CATEGORIES = [
  "rent",
  "utilities",
  "internet",
  "software",
  "insurance",
] as const;

export const VARIABLE_CATEGORIES = [
  "supplies",
  "equipment",
  "maintenance",
  "cleaning",
  "marketing",
] as const;

export const ALL_CATEGORIES = [
  ...FIXED_CATEGORIES,
  ...VARIABLE_CATEGORIES,
  "other",
] as const;

export type ExpenseCategory = (typeof ALL_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  // FIXED
  rent: "房租",
  utilities: "水電瓦斯",
  internet: "網路電話",
  software: "軟體月費",
  insurance: "保險稅務",
  // VARIABLE
  supplies: "髮品耗材",
  equipment: "設備傢俱",
  maintenance: "維修保養",
  cleaning: "清潔用品",
  marketing: "行銷推廣",
  // common
  other: "其他",
};

/**
 * Which type-bucket a category belongs to. `other` is special — it
 * inherits whatever the user toggled (FIXED or VARIABLE) so it can appear
 * in either chip set.
 */
export const CATEGORY_TYPE: Record<
  ExpenseCategory,
  "FIXED" | "VARIABLE" | "EITHER"
> = {
  rent: "FIXED",
  utilities: "FIXED",
  internet: "FIXED",
  software: "FIXED",
  insurance: "FIXED",
  supplies: "VARIABLE",
  equipment: "VARIABLE",
  maintenance: "VARIABLE",
  cleaning: "VARIABLE",
  marketing: "VARIABLE",
  other: "EITHER",
};

/** Helpers for the UI's chip filter. */
export function categoriesForType(type: "FIXED" | "VARIABLE"): ExpenseCategory[] {
  return [...ALL_CATEGORIES].filter(
    (c) => CATEGORY_TYPE[c] === type || CATEGORY_TYPE[c] === "EITHER",
  );
}

/**
 * V3.7 P1-4 — hybrid free-text categories. Old enum categories still get
 * Chinese labels; new custom categories (typed by the owner) just display as-is.
 */
export function isPredefinedCategory(category: string): category is ExpenseCategory {
  return (ALL_CATEGORIES as readonly string[]).includes(category);
}

export function getCategoryLabel(category: string): string {
  if (isPredefinedCategory(category)) return CATEGORY_LABELS[category];
  return category; // 自訂 → 原樣顯示
}
