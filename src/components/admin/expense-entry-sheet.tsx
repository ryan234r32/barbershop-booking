"use client";

/**
 * V3.7 §1 — Progressive expense entry sheet (full-page modal, iOS-native feel).
 *
 * Design (iter 4, 2026-05-05):
 *   1. **No vaul** — full-page modal uses our own FullscreenModal.
 *   2. **Progressive disclosure** — fields appear top-to-bottom: date → type
 *      (變動/固定) → category → amount → optional payment + note.
 *   3. **「其他」 inline expansion** — tapping the 其他 chip reveals a
 *      custom-label input below the chip grid, autoFocuses it.
 *   4. **No scrollIntoView** — iOS PWA was triggering window-level horizontal
 *      jump when scrollIntoView fired (老闆 5/5 報告：點 chip 後整頁向左偏).
 *      Replaced with manual container.scrollTo() that stays vertical-only.
 *   5. **No close-on-backdrop** — preventDismiss=true.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Banknote, Landmark } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { adminHeaders } from "@/lib/auth/admin-fetch";
import { FullscreenModal } from "@/components/admin/fullscreen-modal";
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

  const amountRef = useRef<HTMLInputElement | null>(null);
  const customItemRef = useRef<HTMLInputElement | null>(null);
  const scrollBodyRef = useRef<HTMLDivElement | null>(null);

  // Reset state on close.
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

  const showCategoryRow = type !== null;
  const showAmountRow =
    category !== null && (category !== "other" || customItem.trim().length > 0);
  const showOtherInput = category === "other";
  const amtNum = parseInt(amount.replace(/,/g, ""), 10);
  const canSubmit =
    type !== null &&
    category !== null &&
    (category !== "other" || customItem.trim().length > 0) &&
    Number.isFinite(amtNum) &&
    amtNum > 0;

  // When amount section appears, scroll the modal body (vertical-only) so
  // the new section is visible. We do NOT use Element.scrollIntoView() because
  // on iOS PWA it triggers a window-level horizontal jump when the parent has
  // ANY ancestor with overflow set (老闆 5/5 報告：點 chip 後整頁向左偏 ~80px).
  useEffect(() => {
    if (!showAmountRow) return;
    const t = setTimeout(() => {
      const el = amountRef.current;
      const container = scrollBodyRef.current;
      if (!el || !container) return;
      const containerRect = container.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      const offset =
        elRect.top - containerRect.top - containerRect.height / 2 + elRect.height / 2;
      container.scrollTo({
        top: container.scrollTop + offset,
        behavior: "smooth",
      });
    }, 120);
    return () => clearTimeout(t);
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

    // V3.7 P1-4 — when the user picks 「其他」 and types a custom item, treat
    // it as the category itself (free-text). Old behaviour shoved the label
    // into notes and tagged the row as enum "other", which lost it for chip
    // filtering. Server-side schema accepts free-text.
    const submittedCategory =
      category === "other" && customItem.trim()
        ? customItem.trim().slice(0, 40)
        : category;
    const mergedNotes = notes.trim() || undefined;

    setSubmitting(true);
    try {
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { ...adminHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          amount: amtNum,
          category: submittedCategory,
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
        message: `已新增 NT$${amtNum.toLocaleString()}`,
      });
      onCreated?.();
      onOpenChange(false);
    } catch (e) {
      toast({
        type: "error",
        message: "新增失敗：" + (e instanceof Error ? e.message : String(e)),
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <FullscreenModal onClose={() => onOpenChange(false)} preventDismiss>
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
        <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
          新增支出
        </h2>
        <div className="w-10" />
      </div>

      {/* Scrollable body */}
      <div
        ref={scrollBodyRef}
        className="flex-1 overflow-y-auto px-5 pt-5"
        style={{
          paddingBottom: "max(env(safe-area-inset-bottom), 32px)",
          // Defensive: lock horizontal scroll on the body too.
          overflowX: "hidden",
        }}
      >
        {/* (a) 日期 */}
        <Section label="日期" complete>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full px-3 py-2.5 rounded-lg bg-[var(--color-surface)] text-[var(--color-text-primary)] text-base focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]/30"
          />
        </Section>

        {/* (b) 類別 — type toggle */}
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

        {/* (c) 分類 chips — appears once type chosen */}
        {showCategoryRow && (
          <Section
            label="分類"
            complete={
              category !== null &&
              (category !== "other" || customItem.trim().length > 0)
            }
          >
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
              <div className="mt-3">
                <input
                  ref={customItemRef}
                  type="text"
                  value={customItem}
                  onChange={(e) =>
                    setCustomItem(e.target.value.slice(0, 30))
                  }
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

        {/* (d) 金額 — appears after category */}
        {showAmountRow && (
          <Section
            label="金額"
            complete={Number.isFinite(amtNum) && amtNum > 0}
          >
            <div className="flex items-baseline gap-2">
              <span className="text-2xl text-[var(--color-text-muted)]">
                NT$
              </span>
              <input
                ref={amountRef}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                enterKeyHint="done"
                value={amount}
                onChange={(e) =>
                  setAmount(e.target.value.replace(/[^\d]/g, ""))
                }
                placeholder="0"
                className="flex-1 text-4xl font-semibold tracking-tight bg-transparent border-b border-[var(--color-surface)] focus:border-[var(--color-brand)] focus:outline-none py-2 text-[var(--color-text-primary)]"
              />
            </div>
          </Section>
        )}

        {/* 付款方式 */}
        {showAmountRow && (
          <Section label="付款方式" complete>
            <div className="flex gap-2">
              {(["CASH", "BANK_TRANSFER"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setPaidMethod(m)}
                  className={`flex-1 py-3 rounded-lg text-sm font-medium flex items-center justify-center gap-1.5 transition-colors ${
                    paidMethod === m
                      ? "bg-[var(--color-brand)] text-[var(--color-bg)]"
                      : "bg-[var(--color-surface)] text-[var(--color-text-body)]"
                  }`}
                >
                  {m === "CASH" ? (
                    <>
                      <Banknote size={16} />
                      現金
                    </>
                  ) : (
                    <>
                      <Landmark size={16} />
                      轉帳
                    </>
                  )}
                </button>
              ))}
            </div>
          </Section>
        )}

        {/* 備註 */}
        {showAmountRow && (
          <Section label="備註（選填）" complete>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="例：髮蠟補貨 3 罐 / 9 月電費"
              rows={2}
              className="w-full px-3 py-2 rounded-lg bg-[var(--color-surface)] text-[var(--color-text-primary)] text-sm placeholder:text-[var(--color-text-disabled)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]/30 resize-none"
            />
          </Section>
        )}

        {/* Submit */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting || !canSubmit}
          className="w-full py-3.5 rounded-lg bg-[var(--color-brand)] text-[var(--color-bg)] font-semibold text-base disabled:opacity-40 disabled:cursor-not-allowed transition-opacity mt-2"
        >
          {submitting ? "儲存中…" : "儲 存"}
        </button>

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
    </FullscreenModal>
  );
}

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
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M5 13l4 4L19 7" />
            </svg>
          </span>
        )}
      </div>
      {children}
    </div>
  );
}
