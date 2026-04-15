/**
 * Taiwan bank code → 中文銀行名稱 lookup for the customer-facing virtual
 * account card. Only codes the ECPay ATM gateway actually returns are worth
 * listing here — if the code is unknown we fall back to displaying the raw
 * code, which is still actionable (banks accept numeric codes at the ATM).
 *
 * Keep this file small and pure (no deps) so the LIFF bundle stays lean.
 */

export const TW_BANK_NAMES: Readonly<Record<string, string>> = Object.freeze({
  "004": "台灣銀行",
  "005": "土地銀行",
  "008": "玉山銀行",
  "011": "上海商銀",
  "012": "富邦銀行",
  "013": "國泰世華",
  "017": "兆豐銀行",
  "108": "陽信銀行",
  "700": "中華郵政",
  "803": "聯邦銀行",
  "806": "元大銀行",
  "807": "永豐銀行",
  "809": "凱基銀行",
  "812": "台新銀行",
  "822": "中國信託",
  "827": "有限責任新北市樹林信用合作社",
});

/**
 * Look up a Chinese bank name by its 3-digit code. Returns null for unknown
 * codes so the caller can decide how to render (e.g. show only the code).
 */
export function lookupBankName(code: string | null | undefined): string | null {
  if (!code) return null;
  return TW_BANK_NAMES[code] ?? null;
}

/**
 * Format the bank name + code for display, e.g. "玉山銀行 (008)" or just "008".
 */
export function formatBankLabel(code: string | null | undefined): string {
  if (!code) return "";
  const name = lookupBankName(code);
  return name ? `${name} (${code})` : code;
}

/**
 * Split an account number into 4-digit groups for readability:
 *   "1234567890123456" → "1234 5678 9012 3456"
 * Preserves original if it contains non-digits.
 */
export function formatAccountNumber(account: string | null | undefined): string {
  if (!account) return "";
  if (!/^\d+$/.test(account)) return account;
  return account.replace(/(\d{4})(?=\d)/g, "$1 ");
}
