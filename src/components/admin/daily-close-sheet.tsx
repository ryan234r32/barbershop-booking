"use client";

/**
 * V3.7 §3 — 「完成今日結帳」全頁 sheet.
 *
 * Owner-facing reconciliation: shows expected cash + bank from system, prompts
 * for actual cash count + bank deposit confirmation, computes diff in real-time.
 * Submit POSTs /api/admin/day-close with rich body → upserts DailyCloseSnapshot
 * + flips Tenant.dayClosedAt[date] = now.
 *
 * Diff != 0 forces a `notes` value before submit (non-zero diff requires explanation).
 */

import { useEffect, useState } from "react";
import { Drawer } from "vaul";
import { useToast } from "@/components/ui/toast";
import { adminHeaders } from "@/lib/auth/admin-fetch";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: string;
  expectedCash: number;
  expectedBank: number;
  totalRevenue: number;
  totalExpense: number;
  bookingCount: number;
  expenseCount: number;
  /** Called after successful POST so the parent can SWR-mutate. */
  onClosed: () => void;
}

export function DailyCloseSheet(props: Props) {
  const {
    open,
    onOpenChange,
    date,
    expectedCash,
    expectedBank,
    totalRevenue,
    totalExpense,
    bookingCount,
    expenseCount,
    onClosed,
  } = props;
  const { toast } = useToast();
  const [actualCash, setActualCash] = useState("");
  const [bankConfirmed, setBankConfirmed] = useState(false);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setActualCash(String(expectedCash));
      setBankConfirmed(false);
      setNotes("");
    }
  }, [open, expectedCash]);

  const actualCashNum = parseInt(actualCash.replace(/,/g, ""), 10);
  const cashDiff = Number.isFinite(actualCashNum) ? actualCashNum - expectedCash : 0;
  const netProfit = totalRevenue - totalExpense;
  const needsNote = cashDiff !== 0;
  const canSubmit =
    Number.isFinite(actualCashNum) &&
    bankConfirmed &&
    (!needsNote || notes.trim().length > 0);

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/day-close", {
        method: "POST",
        headers: { ...adminHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          actualCash: actualCashNum,
          bankConfirmed,
          notes: notes.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }
      toast({ type: "success", message: "今日已結帳 ✓" });
      onClosed();
      onOpenChange(false);
    } catch (e) {
      toast({
        type: "error",
        message: "結帳失敗：" + (e instanceof Error ? e.message : String(e)),
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
          // inset-0 在 iOS PWA 會跑版。改用 explicit positioning + width 100vw
          // + transform: none 強制覆蓋 vaul inline style。
          className="fixed top-0 left-0 right-0 bottom-0 z-50 bg-[var(--color-bg)] outline-none flex flex-col h-[100dvh] focus:outline-none"
          style={{
            touchAction: "pan-y",
            overscrollBehavior: "none",
            width: "100vw",
            maxWidth: "100vw",
            transform: "none",
          }}
        >
          <div
            className="flex items-center justify-between px-4 flex-shrink-0 border-b border-[var(--color-surface)]"
            style={{ paddingTop: "max(env(safe-area-inset-top), 16px)", paddingBottom: 12 }}
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
              完成 {date.slice(5)} 結帳
            </Drawer.Title>
            <div className="w-10" />
          </div>

          <div
            className="flex-1 overflow-y-auto px-5"
            style={{ paddingBottom: "max(env(safe-area-inset-bottom), 32px)" }}
          >
            {/* System-computed totals */}
            <section className="mb-5">
              <p className="text-xs text-[var(--color-text-muted)] mb-2">系統算的</p>
              <div className="bg-[var(--color-surface)] rounded-xl p-4 space-y-2">
                <Row label="現金應有" value={expectedCash} />
                <Row label="銀行應入" value={expectedBank} />
                <div className="h-px bg-[var(--color-text-disabled)]/20" />
                <Row label="營收" value={totalRevenue} muted />
                <Row label="支出" value={-totalExpense} muted />
                <Row label="淨利" value={netProfit} bold tone={netProfit >= 0 ? "brand" : "danger"} />
                <p className="text-[10px] text-[var(--color-text-muted)] text-right">
                  {bookingCount} 筆預約 · {expenseCount} 筆支出
                </p>
              </div>
            </section>

            {/* Owner manual confirmation */}
            <section className="mb-5">
              <p className="text-xs text-[var(--color-text-muted)] mb-2">老闆實際確認</p>

              <div className="mb-3">
                <label className="text-xs text-[var(--color-text-muted)] mb-1.5 block">
                  現金抽屜實收
                </label>
                <div className="flex items-baseline gap-2">
                  <span className="text-lg text-[var(--color-text-muted)]">NT$</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={actualCash}
                    onChange={(e) => setActualCash(e.target.value.replace(/[^\d]/g, ""))}
                    className="flex-1 text-2xl font-semibold tabular-nums bg-transparent border-b border-[var(--color-surface)] focus:border-[var(--color-brand)] focus:outline-none py-1.5 text-[var(--color-text-primary)]"
                  />
                </div>
              </div>

              <label className="flex items-start gap-3 p-3 rounded-lg bg-[var(--color-surface)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={bankConfirmed}
                  onChange={(e) => setBankConfirmed(e.target.checked)}
                  className="w-5 h-5 mt-0.5 accent-[var(--color-brand)] flex-shrink-0"
                />
                <span className="text-sm text-[var(--color-text-primary)] leading-snug">
                  銀行 App 已確認進帳 NT$ {expectedBank.toLocaleString()}
                </span>
              </label>
            </section>

            {/* Anomaly indicator */}
            <section className="mb-5">
              <p className="text-xs text-[var(--color-text-muted)] mb-2">差異檢查</p>
              <div className="space-y-1.5">
                <DiffRow
                  ok={cashDiff === 0}
                  label={
                    cashDiff === 0
                      ? "現金一致"
                      : cashDiff > 0
                        ? `現金多 NT$${cashDiff.toLocaleString()}`
                        : `現金少 NT$${Math.abs(cashDiff).toLocaleString()}`
                  }
                />
                <DiffRow ok={bankConfirmed} label={bankConfirmed ? "銀行已勾選" : "銀行尚未確認"} />
              </div>
            </section>

            {/* Notes (required if diff != 0) */}
            <section className="mb-6">
              <label className="text-xs text-[var(--color-text-muted)] mb-1.5 block">
                備註{needsNote ? <span className="text-[var(--color-danger)]"> * 差異需要說明</span> : "（選填）"}
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={needsNote ? "例：找零後忘記補回 / 銅板找錯" : "備註"}
                rows={3}
                className="w-full px-3 py-2 rounded-lg bg-[var(--color-surface)] text-[var(--color-text-primary)] text-sm placeholder:text-[var(--color-text-disabled)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]/30 resize-none"
              />
            </section>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || !canSubmit}
              className="w-full py-3.5 rounded-lg bg-[var(--color-brand)] text-[var(--color-bg)] font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
            >
              {submitting ? "結帳中…" : "送出結帳"}
            </button>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

function Row({
  label,
  value,
  bold,
  muted,
  tone,
}: {
  label: string;
  value: number;
  bold?: boolean;
  muted?: boolean;
  tone?: "brand" | "danger";
}) {
  const colour =
    tone === "brand"
      ? "var(--color-brand)"
      : tone === "danger"
        ? "var(--color-danger)"
        : muted
          ? "var(--color-text-muted)"
          : "var(--color-text-primary)";
  return (
    <div className="flex items-center justify-between">
      <span className={`text-sm ${muted ? "text-[var(--color-text-muted)]" : "text-[var(--color-text-body)]"}`}>
        {label}
      </span>
      <span
        className={`tabular-nums ${bold ? "text-base font-bold" : "text-sm font-medium"}`}
        style={{ color: colour }}
      >
        {value < 0 ? `-${Math.abs(value).toLocaleString()}` : value.toLocaleString()}
      </span>
    </div>
  );
}

function DiffRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span
        className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
          ok
            ? "bg-[var(--color-success)]/15 text-[var(--color-success)]"
            : "bg-[var(--color-danger)]/15 text-[var(--color-danger)]"
        }`}
      >
        {ok ? "✓" : "!"}
      </span>
      <span className={ok ? "text-[var(--color-text-body)]" : "text-[var(--color-danger)] font-medium"}>
        {label}
      </span>
    </div>
  );
}
