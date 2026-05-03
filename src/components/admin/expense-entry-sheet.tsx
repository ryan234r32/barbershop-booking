"use client";

/**
 * V3.7 §1 — Quick-entry sheet for one-off expenses.
 *
 * UX:
 *   1. Drawer.Content with `h-[92dvh]` (mirrors BookingDetailFullPage so iOS
 *      keyboard doesn't push the form above the visible viewport).
 *   2. Big NT$ amount input front-and-center; numeric keyboard auto.
 *   3. Category chip grid (3×3) — tapping a chip auto-flips FIXED/VARIABLE
 *      via CATEGORY_DEFAULT_TYPE; the user can still override.
 *   4. Submit hits POST /api/expenses; on success calls `onCreated()` so the
 *      parent (reports/daily.tsx) can SWR-mutate.
 *
 * Receipt photo / recurring-rule toggles are intentionally NOT in this sheet —
 * recurring lives in a separate `/admin/finance/recurring` page (Phase 2),
 * receipts get a Vercel Blob upload after the entry-sheet ships.
 */

import { useState, useEffect } from "react";
import { Drawer } from "vaul";
import { useToast } from "@/components/ui/toast";
import { adminHeaders } from "@/lib/auth/admin-fetch";
import {
  EXPENSE_CATEGORIES,
  CATEGORY_LABELS,
  CATEGORY_DEFAULT_TYPE,
  type ExpenseCategory,
} from "@/lib/expenses/categories";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Defaults to today (Taipei). Pre-fills the date — user usually doesn't change it. */
  defaultDate: string;
  onCreated?: () => void;
}

export function ExpenseEntrySheet({
  open,
  onOpenChange,
  defaultDate,
  onCreated,
}: Props) {
  const { toast } = useToast();
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<ExpenseCategory>("consumables");
  const [type, setType] = useState<"FIXED" | "VARIABLE">("VARIABLE");
  const [paidMethod, setPaidMethod] = useState<"CASH" | "BANK_TRANSFER">("CASH");
  const [notes, setNotes] = useState("");
  const [date, setDate] = useState(defaultDate);
  const [submitting, setSubmitting] = useState(false);

  // Reset state when the sheet closes so the next open is clean.
  useEffect(() => {
    if (!open) {
      setAmount("");
      setCategory("consumables");
      setType("VARIABLE");
      setPaidMethod("CASH");
      setNotes("");
      setDate(defaultDate);
    }
  }, [open, defaultDate]);

  const handleCategoryTap = (c: ExpenseCategory) => {
    setCategory(c);
    setType(CATEGORY_DEFAULT_TYPE[c]);
  };

  const handleSubmit = async () => {
    const amt = parseInt(amount.replace(/,/g, ""), 10);
    if (!Number.isFinite(amt) || amt <= 0) {
      toast({ type: "error", message: "請輸入有效金額" });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { ...adminHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          amount: amt,
          category,
          type,
          paidMethod,
          notes: notes.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }
      toast({ type: "success", message: `已新增 NT$${amt.toLocaleString()}` });
      onCreated?.();
      onOpenChange(false);
    } catch (e) {
      toast({
        type: "error",
        message:
          "新增失敗：" + (e instanceof Error ? e.message : String(e)),
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 bg-[var(--color-text-body)]/50 z-50 backdrop-blur-sm" />
        <Drawer.Content className="fixed bottom-0 left-0 right-0 z-50 bg-[var(--color-bg)] rounded-t-2xl h-[92dvh] outline-none flex flex-col">
          <div className="mx-auto w-10 h-1 rounded-full bg-[var(--color-surface)] mt-3 mb-2 flex-shrink-0" />

          <div className="flex items-center justify-between px-5 pb-2 flex-shrink-0">
            <button
              onClick={() => onOpenChange(false)}
              aria-label="關閉"
              className="w-9 h-9 -ml-2 rounded-full flex items-center justify-center text-[var(--color-text-body)] hover:bg-[var(--color-surface)] transition-colors"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <path d="M6 6l12 12M6 18L18 6" />
              </svg>
            </button>
            <Drawer.Title className="text-sm font-semibold text-[var(--color-text-primary)]">
              新增支出
            </Drawer.Title>
            <div className="w-9" />
          </div>

          <div className="flex-1 overflow-y-auto px-5 pb-8">
            {/* Amount */}
            <div className="mt-4 mb-6">
              <div className="text-xs text-[var(--color-text-muted)] mb-1.5">金額</div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl text-[var(--color-text-muted)]">NT$</span>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={amount}
                  onChange={(e) => {
                    const cleaned = e.target.value.replace(/[^\d]/g, "");
                    setAmount(cleaned);
                  }}
                  placeholder="0"
                  className="flex-1 text-4xl font-semibold tracking-tight bg-transparent border-b border-[var(--color-surface)] focus:border-[var(--color-brand)] focus:outline-none py-2 text-[var(--color-text-primary)]"
                  autoFocus
                />
              </div>
            </div>

            {/* Date */}
            <div className="mb-5">
              <div className="text-xs text-[var(--color-text-muted)] mb-1.5">日期</div>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg bg-[var(--color-surface)] text-[var(--color-text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]/30"
              />
            </div>

            {/* Type radio */}
            <div className="mb-5">
              <div className="text-xs text-[var(--color-text-muted)] mb-1.5">類別</div>
              <div className="flex gap-2">
                {(["VARIABLE", "FIXED"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setType(t)}
                    className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      type === t
                        ? "bg-[var(--color-brand)] text-[var(--color-bg)]"
                        : "bg-[var(--color-surface)] text-[var(--color-text-body)]"
                    }`}
                  >
                    {t === "VARIABLE" ? "變動" : "固定"}
                  </button>
                ))}
              </div>
            </div>

            {/* Category chips */}
            <div className="mb-5">
              <div className="text-xs text-[var(--color-text-muted)] mb-1.5">分類</div>
              <div className="grid grid-cols-4 gap-2">
                {EXPENSE_CATEGORIES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => handleCategoryTap(c)}
                    className={`py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      category === c
                        ? "bg-[var(--color-brand)] text-[var(--color-bg)]"
                        : "bg-[var(--color-surface)] text-[var(--color-text-body)]"
                    }`}
                  >
                    {CATEGORY_LABELS[c]}
                  </button>
                ))}
              </div>
            </div>

            {/* Paid method */}
            <div className="mb-5">
              <div className="text-xs text-[var(--color-text-muted)] mb-1.5">付款方式</div>
              <div className="flex gap-2">
                {(["CASH", "BANK_TRANSFER"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setPaidMethod(m)}
                    className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      paidMethod === m
                        ? "bg-[var(--color-brand)] text-[var(--color-bg)]"
                        : "bg-[var(--color-surface)] text-[var(--color-text-body)]"
                    }`}
                  >
                    {m === "CASH" ? "💵 現金" : "🏦 轉帳"}
                  </button>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div className="mb-6">
              <div className="text-xs text-[var(--color-text-muted)] mb-1.5">備註（選填）</div>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="例：髮蠟補貨 3 罐"
                rows={2}
                className="w-full px-3 py-2 rounded-lg bg-[var(--color-surface)] text-[var(--color-text-primary)] text-sm placeholder:text-[var(--color-text-disabled)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]/30 resize-none"
              />
            </div>

            {/* Submit */}
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || !amount}
              className="w-full py-3.5 rounded-lg bg-[var(--color-brand)] text-[var(--color-bg)] font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
            >
              {submitting ? "儲存中…" : "儲 存"}
            </button>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
