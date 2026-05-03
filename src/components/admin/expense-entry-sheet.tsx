"use client";

/**
 * V3.7 §1 — Progressive expense entry sheet (full-page modal, iOS-native feel).
 *
 * Design (iter 2, 2026-05-03):
 *   1. **Progressive disclosure** — fields appear top-to-bottom as the user
 *      commits earlier choices, mimicking the way owner physically sorts a
 *      receipt: date → type (變動/固定) → category → amount → optional
 *      payment + note. Inspired by Apple Wallet's add-card flow + GlossGenius
 *      add-expense (single column, sectioned).
 *   2. **Amount is NOT first** — owners pick up a receipt and decide what kind
 *      of expense it is before reading the number. Putting amount last keeps
 *      keyboard + numeric pad off-screen until needed (no autoFocus until
 *      amount section is reached).
 *   3. **「其他」 inline expansion** — tapping the 其他 chip reveals a custom-
 *      label input below the chip grid, autoFocuses it. Saved into Expense.notes
 *      as the de-facto label when category=other.
 *   4. **Bottom safe-area + always-visible submit** — submit button sits at
 *      the end of the scroll content with safe-area-inset-bottom padding so
 *      iOS keyboard accessory bar / home indicator never covers it.
 *   5. **No horizontal swipe** — touch-action: pan-y on Drawer.Content kills
 *      vaul's accidental drag pickup on iOS PWA.
 *   6. **Dismissible=false** — close only via the X button (avoids accidental
 *      swipe-down close when user is mid-form).
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Drawer } from "vaul";
import { Banknote, Landmark } from "lucide-react";
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
  const [type, setType] = useState<"VARIABLE" | "FIXED" | null>(null);
  const [category, setCategory] = useState<ExpenseCategory | null>(null);
  const [customItem, setCustomItem] = useState("");
  const [amount, setAmount] = useState("");
  const [paidMethod, setPaidMethod] = useState<"CASH" | "BANK_TRANSFER">("CASH");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Refs for auto-scroll-into-view when later sections appear.
  const amountRef = useRef<HTMLInputElement | null>(null);
  const customItemRef = useRef<HTMLInputElement | null>(null);
  const submitRef = useRef<HTMLButtonElement | null>(null);

  // Reset state on close so the next open is clean.
  useEffect(() => {
    if (!open) {
      setDate(defaultDate);
      setType(null);
      setCategory(null);
      setCustomItem("");
      setAmount("");
      setPaidMethod("CASH");
      setNotes("");
    }
  }, [open, defaultDate]);

  // When type toggles, drop a category that doesn't belong to the new type.
  useEffect(() => {
    if (!category || !type) return;
    const owns = CATEGORY_TYPE[category];
    if (owns !== "EITHER" && owns !== type) setCategory(null);
  }, [type, category]);

  const chips = useMemo(
    () => (type ? categoriesForType(type) : []),
    [type],
  );

  // Progressive disclosure: visibility flags
  const showCategoryRow = type !== null;
  const showAmountRow = category !== null && (category !== "other" || customItem.trim().length > 0);
  const showOtherInput = category === "other";
  // Submit availability
  const amtNum = parseInt(amount.replace(/,/g, ""), 10);
  const canSubmit =
    type !== null &&
    category !== null &&
    (category !== "other" || customItem.trim().length > 0) &&
    Number.isFinite(amtNum) &&
    amtNum > 0;

  // When amount section becomes visible, scroll to it (delay to let layout settle).
  useEffect(() => {
    if (showAmountRow && amountRef.current) {
      const el = amountRef.current;
      const t = setTimeout(() => {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 120);
      return () => clearTimeout(t);
    }
  }, [showAmountRow]);

  // When 「其他」 input appears, focus it.
  useEffect(() => {
    if (showOtherInput && customItemRef.current) {
      const t = setTimeout(() => customItemRef.current?.focus(), 120);
      return () => clearTimeout(t);
    }
  }, [showOtherInput]);

  const handleSubmit = async () => {
    if (!canSubmit || !type || !category) return;

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
          amount: amtNum,
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
      toast({ type: "success", message: `已新增 NT$${amtNum.toLocaleString()}` });
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
          // V3.8 fix (5/3 user report)：vaul Drawer.Content 對 fullscreen 用
          // inset-0 在 iOS PWA 跑版（content 整體往左偏 ~30px）。
          // 改用 explicit top/left/right/bottom + width: 100vw + transform: none
          // 強制覆蓋 vaul 預設的 inline style 避免 horizontal offset。
          className="fixed top-0 left-0 right-0 bottom-0 z-50 bg-[var(--color-bg)] outline-none flex flex-col h-[100dvh] focus:outline-none"
          style={{
            touchAction: "pan-y",
            overscrollBehavior: "none",
            width: "100vw",
            maxWidth: "100vw",
            transform: "none",
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
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
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
            {/* (a) 日期 — always visible */}
            <Section label="日期" complete={true}>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg bg-[var(--color-surface)] text-[var(--color-text-primary)] text-base focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]/30"
              />
            </Section>

            {/* (b) 類別 — type toggle (always visible) */}
            <Section label="類別" complete={type !== null}>
              <div className="flex gap-2">
                {(["VARIABLE", "FIXED"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setType(t)}
                    className={`flex-1 py-3 rounded-lg text-sm font-semibold transition-colors ${
                      type === t
                        ? "bg-[var(--color-brand)] text-[var(--color-bg)]"
                        : "bg-[var(--color-surface)] text-[var(--color-text-body)]"
                    }`}
                  >
                    {t === "VARIABLE" ? "變動" : "固定"}
                  </button>
                ))}
              </div>
            </Section>

            {/* (c) 分類 — appears once type chosen */}
            {showCategoryRow && (
              <Section label="分類" complete={category !== null && (category !== "other" || customItem.trim().length > 0)}>
                <div className="grid grid-cols-3 gap-2">
                  {chips.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => {
                        setCategory(c);
                        if (c !== "other") setCustomItem("");
                      }}
                      className={`py-3 rounded-lg text-sm font-medium transition-colors ${
                        category === c
                          ? "bg-[var(--color-brand)] text-[var(--color-bg)]"
                          : "bg-[var(--color-surface)] text-[var(--color-text-body)]"
                      }`}
                    >
                      {CATEGORY_LABELS[c]}
                    </button>
                  ))}
                </div>

                {showOtherInput && (
                  <div className="mt-3 animate-in fade-in slide-in-from-top-1 duration-200">
                    <input
                      ref={customItemRef}
                      type="text"
                      value={customItem}
                      onChange={(e) => setCustomItem(e.target.value.slice(0, 30))}
                      placeholder="輸入支出品項，例：員工尾牙"
                      className="w-full px-3 py-2.5 rounded-lg bg-[var(--color-bg)] border border-[var(--color-brand)]/40 text-[var(--color-text-primary)] text-base placeholder:text-[var(--color-text-disabled)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]/30"
                    />
                    <p className="text-[10px] text-[var(--color-text-muted)] mt-1">
                      這個品項會直接顯示在支出列表上
                    </p>
                  </div>
                )}
              </Section>
            )}

            {/* (d) 金額 — appears after category (or after customItem typed) */}
            {showAmountRow && (
              <Section label="金額" complete={Number.isFinite(amtNum) && amtNum > 0}>
                <div className="flex items-baseline gap-2 animate-in fade-in slide-in-from-top-1 duration-200">
                  <span className="text-2xl text-[var(--color-text-muted)]">NT$</span>
                  <input
                    ref={amountRef}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    enterKeyHint="done"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ""))}
                    onBlur={(e) => {
                      // iOS numeric keyboard "Done" → blur. Format display.
                      const v = e.target.value.replace(/[^\d]/g, "");
                      setAmount(v);
                    }}
                    placeholder="0"
                    className="flex-1 text-4xl font-semibold tracking-tight bg-transparent border-b border-[var(--color-surface)] focus:border-[var(--color-brand)] focus:outline-none py-2 text-[var(--color-text-primary)]"
                  />
                </div>
              </Section>
            )}

            {/* 付款方式 — always visible (default to 現金, low-friction default) */}
            {showAmountRow && (
              <Section label="付款方式" complete={true}>
                <div className="flex gap-2">
                  {(["CASH", "BANK_TRANSFER"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setPaidMethod(m)}
                      className={`flex-1 py-3 rounded-lg text-sm font-medium transition-colors inline-flex items-center justify-center gap-1.5 ${
                        paidMethod === m
                          ? "bg-[var(--color-brand)] text-[var(--color-bg)]"
                          : "bg-[var(--color-surface)] text-[var(--color-text-body)]"
                      }`}
                    >
                      {m === "CASH" ? (
                        <>
                          <Banknote size={16} aria-hidden /> 現金
                        </>
                      ) : (
                        <>
                          <Landmark size={16} aria-hidden /> 轉帳
                        </>
                      )}
                    </button>
                  ))}
                </div>
              </Section>
            )}

            {/* 備註 — always visible (optional) */}
            {showAmountRow && (
              <Section label="備註（選填）" complete={true}>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="例：髮蠟補貨 3 罐 / 9 月電費"
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--color-surface)] text-[var(--color-text-primary)] text-sm placeholder:text-[var(--color-text-disabled)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]/30 resize-none"
                />
              </Section>
            )}

            {/* Submit — at end of scroll content, always available */}
            <button
              ref={submitRef}
              type="button"
              onClick={handleSubmit}
              disabled={submitting || !canSubmit}
              className="w-full py-3.5 rounded-lg bg-[var(--color-brand)] text-[var(--color-bg)] font-semibold text-base disabled:opacity-40 disabled:cursor-not-allowed transition-opacity mt-2"
            >
              {submitting ? "儲存中…" : "儲 存"}
            </button>

            {/* Hint when not yet submittable */}
            {!canSubmit && !submitting && (
              <p className="text-center text-[11px] text-[var(--color-text-muted)] mt-3">
                {!type
                  ? "請先選擇變動或固定"
                  : !category
                    ? "請選擇分類"
                    : category === "other" && customItem.trim().length === 0
                      ? "請輸入「其他」的支出品項"
                      : !Number.isFinite(amtNum) || amtNum <= 0
                        ? "請輸入金額"
                        : ""}
              </p>
            )}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

/**
 * Section header + content. Subtle "complete" tick when filled — gives the
 * progressive form a sense of momentum. Inspired by Stripe's checkout flow.
 */
function Section({
  label,
  complete,
  children,
}: {
  label: string;
  complete: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-5">
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className="text-xs text-[var(--color-text-muted)]">{label}</span>
        {complete && (
          <span className="text-[10px] text-[var(--color-brand)] flex items-center">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M5 13l4 4L19 7" />
            </svg>
          </span>
        )}
      </div>
      {children}
    </div>
  );
}
