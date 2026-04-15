import { describe, it, expect } from "vitest";
import {
  TW_BANK_NAMES,
  lookupBankName,
  formatBankLabel,
  formatAccountNumber,
} from "../bank-codes";

describe("bank-codes", () => {
  describe("lookupBankName", () => {
    it("returns the Chinese name for known codes", () => {
      expect(lookupBankName("008")).toBe("玉山銀行");
      expect(lookupBankName("822")).toBe("中國信託");
      expect(lookupBankName("700")).toBe("中華郵政");
    });

    it("returns null for unknown codes", () => {
      expect(lookupBankName("999")).toBeNull();
      expect(lookupBankName("")).toBeNull();
      expect(lookupBankName(null)).toBeNull();
      expect(lookupBankName(undefined)).toBeNull();
    });
  });

  describe("formatBankLabel", () => {
    it("renders name + code for known bank", () => {
      expect(formatBankLabel("008")).toBe("玉山銀行 (008)");
    });
    it("renders bare code for unknown bank", () => {
      expect(formatBankLabel("999")).toBe("999");
    });
    it("renders empty string for missing input", () => {
      expect(formatBankLabel(null)).toBe("");
      expect(formatBankLabel("")).toBe("");
    });
  });

  describe("formatAccountNumber", () => {
    it("groups digits into blocks of 4", () => {
      expect(formatAccountNumber("1234567890123456")).toBe("1234 5678 9012 3456");
      expect(formatAccountNumber("12345")).toBe("1234 5");
    });
    it("passes through non-numeric input unchanged", () => {
      expect(formatAccountNumber("12-34-5678")).toBe("12-34-5678");
    });
    it("handles empty/nullish", () => {
      expect(formatAccountNumber("")).toBe("");
      expect(formatAccountNumber(null)).toBe("");
      expect(formatAccountNumber(undefined)).toBe("");
    });
  });

  describe("TW_BANK_NAMES constant", () => {
    it("covers the banks listed in the spec", () => {
      const expected = [
        "008", "822", "700", "806", "012", "005", "013",
        "004", "011", "017", "809", "807", "803", "108", "812", "827",
      ];
      for (const code of expected) {
        expect(TW_BANK_NAMES[code]).toBeDefined();
      }
    });
  });
});
