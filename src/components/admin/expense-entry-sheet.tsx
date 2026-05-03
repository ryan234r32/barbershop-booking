"use client";

/**
 * V3.7 §1 — Quick-entry sheet for one-off expenses (full-page modal).
 *
 * UX:
 *   1. Drawer.Content with `inset-0 h-[100dvh]` — true full-screen modal so
 *      iOS keyboard never crowds out content.
 *   2. Field order (per user spec 2026-05-03): 日期 → 類別 → 金額 → 付款 → 備註.
 *   3. 類別 is a two-step pick: 變動/固定 toggle, then a chip filtered to that
 *      type. Tapping「其他」expands an inline text input for custom item label.
 *   4. Submit hits POST /api/expenses; on success calls `onCreated()`.
 *
 * Touch-action `pan-y` + overscroll `none` to disable horizontal swipe inside
 * the sheet (iOS PWA was eating left-right swipes as gestures).
 */

import { useState, useEffect, useMemo } from "react";
import { Drawer } from "vaul";
import { useToast } from "@/components/ui/toast";
import { adminHeaders } from "@/lib/auth/admin-fetch";
import {
  CATEGORY_LABELS,
  CATEGORY_TYPE,
  categoriesForType,
  type ExpenseCategory,
} from "@/lib/expenses/categories";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Defaults to today (Taipei). Pre-fills the date input. */
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
  const [date, setDate] = useState(defaultDate);
  const [type, setType] = useState<"VARIABLE" | "FIXED">("VARIABLE");
  const [category, setCategory] = useState<ExpenseCategory | null>(null);
  const [customItem, setCustomItem] = useState("");
  const [amount, setAmount] = useState("");
  const [paidMethod, setPaidMethod] = useState<"CASH" | "BANK_TRANSFER">("CASH");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Reset state on close so the next open is clean.
  useEffect(() => {
    if (!open) {
      setDate(defaultDate);
      setType("VARIABLE");
      setCategory(null);
      setCustomItem("");
      setAmount("");
      setPaidMethod("CASH");
      setNotes("");
    }
  }, [open, defaultDate]);

  // When type toggles, drop a category that doesn't belong to the new type.
  useEffect(() => {
    if (!category) return;
    const owns = CATEGORY_TYPE[category];
    if (owns !== "EITHER" && owns !== type) setCategory(null);
  }, [type, category]);

  const chips = useMemo(() => categoriesForType(type), [type]);

  const handleSubmit = async () => {
    const amt = parseInt(amount.replace(/,/g, ""), 10);
    if (!Number.isFinite(amt) || amt <= 0) {
      toast({ type: "error", message: "請輸入有效金額" });
      return;
    }
    if (!category) {
      toast({ type: "error", message: "請選擇分類" });
      return;
    }
    if (category === "other" && customItem.trim().length === 0) {
      toast({ type: "error", message: "請輸入「其他」的支出品項" });
      return;
    }

    // For 其他: prepend customItem to notes so the list view can show it as
    // the de-facto label. Format: "customItem · userNotes".
    let mergedNotes: string | undefined = notes.trim() || undefined;
    if (category === "other") {
      const ci = customItem.trim();
      mergedNotes = mergedNotes ? `${ci} · ${mergedNotes}` : ci;
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
          notes: mergedNotes,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }
      toast({
        type: "success",
        message: `已新增 NT$${amt.toLocaleString()}`,
      });
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
    <Drawer.Root open={open} onOpenChange={onOpenChange} dismissible={false}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 bg-[var(--color-text-body)]/50 z-50 backdrop-blur-sm" />
        <Drawer.Content
          className="fixed inset-0 z-50 bg-[var(--color-bg)] outline-none flex flex-col h-[100dvh] focus:outline-none"
          style={{
            // Lock to vertical-only touch handling — kills horizontal swipe
            // hijacks (vaul drag confusion + iOS edge-swipe-back).
            touchAction: "pan-y",
            overscrollBehavior: "none",
          }}
        >
          {/* Sticky header */}
          <div
            className="flex items-center justify-between px-4 flex-shrink-0 border-b border-[var(--color-surface)]"
            style={{
              paddingTop: "max(env(safe-area-inset-top), 16px)",
              paddingBottom: 12,
            }}
          >
            <button
              onClick={() => onOpenChange(false)}
              aria-label="關閉"
              className="w-10 h-10 -ml-2 rounded-full flex items-center justify-center text-[var(--color-text-body)] hover:bg-[var(--color-surface)] transition-colors"
            >
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
              >
                <path d="M6 6l12 12M6 18L18 6" />
              </svg>
            </button>
            <Drawer.Title className="text-base font-semibold text-[var(--color-text-primary)]">
              新增支出
            </Drawer.Title>
            <div className="w-10" />
          </div>

          {/* Scrollable body */}
          <div
            className="flex-1 overflow-y-auto px-5 pt-5"
            style={{
              paddingBottom: "max(env(safe-area-inset-bottom), 32px)",
              touchAction: "pan-y",
              overscrollBehaviorX: "none",
            }}
          >
            {/* (a) 日期 */}
            <Field label="日期">
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg bg-[var(--color-surface)] text-[var(--color-text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]/30"
              />
            </Field>

            {/* (b) 類別 — type toggle + chips */}
            <Field label="類別">
              <div className="flex gap-2 mb-3">
                {(["VARIABLE", "FIXED"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setType(t)}
                    className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                      type === t
                        ? "bg-[var(--color-brand)] text-[var(--color-bg)]"
                        : "bg-[var(--color-surface)] text-[var(--color-text-body)]"
                    }`}
                  >
                    {t === "VARIABLE" ? "變動" : "固定"}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-3 gap-2">
                {chips.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => {
                      setCategory(c);
                      if (c !== "other") setCustomItem("");
                    }}
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

              {category === "other" && (
                <div className="mt-3">
                  <input
                    type="text"
                    value={customItem}
                    onChange={(e) => setCustomItem(e.target.value.slice(0, 30))}
                    placeholder="輸入支出品項，例：員工尾牙"
                    autoFocus
                    className="w-full px-3 py-2.5 rounded-lg bg-[var(--color-bg)] border border-[var(--color-brand)]/40 text-[var(--color-text-primary)] text-sm placeholder:text-[var(--color-text-disabled)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]/30"
                  />
                  <p className="text-[10px] text-[var(--color-text-muted)] mt-1">
                    這個品項會直接顯示在支出列表上
                  </p>
                </div>
              )}
            </Field>

            {/* (c) 金額 */}
            <Field label="金額">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl text-[var(--color-text-muted)]">
                  NT$
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={amount}
                  onChange={(e) =>
                    setAmount(e.target.value.replace(/[^\d]/g, ""))
                  }
                  placeholder="0"
                  className="flex-1 text-4xl font-semibold tracking-tight bg-transparent border-b border-[var(--color-surface)] focus:border-[var(--color-brand)] focus:outline-none py-2 text-[var(--color-text-primary)]"
                />
              </div>
            </Field>

            {/* 付款方式 */}
            <Field label="付款方式">
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
            </Field>

            {/* (d) 備註 */}
            <Field label="備註（選填）">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="例：髮蠟補貨 3 罐 / 9 月電費"
                rows={2}
                className="w-full px-3 py-2 rounded-lg bg-[var(--color-surface)] text-[var(--color-text-primary)] text-sm placeholder:text-[var(--color-text-disabled)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]/30 resize-none"
              />
            </Field>

            {/* Submit */}
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || !amount || !category}
              className="w-full py-3.5 rounded-lg bg-[var(--color-brand)] text-[var(--color-bg)] font-semibold text-base disabled:opacity-50 disabled:cursor-not-allowed transition-opacity mt-2"
            >
              {submitting ? "儲存中…" : "儲 存"}
            </button>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-5">
      <div className="text-xs text-[var(--color-text-muted)] mb-1.5">
        {label}
      </div>
      {children}
    </div>
  );
}
