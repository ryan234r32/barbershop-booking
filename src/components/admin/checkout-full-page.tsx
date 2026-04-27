"use client";

/**
 * V3.5 夯客風格行事曆 — Checkout full-page sheet.
 *
 * Opens on top of BookingDetailFullPage when admin clicks 進行結帳. Walks the
 * admin through:
 *   1. Review service + price (with optional discount/override)
 *   2. Pick a single payment method (Phase 1)
 *      → Phase 2 will let them split a checkout across multiple methods.
 *   3. Confirm → POST /api/bookings/[id]/checkout
 *
 * On success, closes itself + signals the parent to show the post-checkout
 * note prompt (mirror of legacy 「順手記一下」 flow).
 *
 * Per plan §1.2: if the booking is still 尚未到來, the server auto-checks-in
 * before completing — admins don't need to flip the segment first.
 */

import { useEffect, useState } from "react";
import { Drawer } from "vaul";
import { useToast } from "@/components/ui/toast";
import { adminHeaders } from "@/lib/auth/admin-fetch";

export type PaymentMethod = "CASH" | "BANK_TRANSFER" | "ECPAY_ATM";

interface BookingForCheckout {
  id: string;
  startTime: string;
  endTime: string;
  date: string;
  status: string;
  checkedInAt?: string | null;
  updatedAt?: string;
  service: { name: string; price: number; slotsNeeded: number };
  user: { displayName: string | null };
}

interface Props {
  booking: BookingForCheckout | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after a successful checkout response. */
  onCompleted: () => void;
}

const METHODS: Array<{ key: PaymentMethod; label: string; description: string }> = [
  { key: "CASH", label: "現金", description: "客人現場付現" },
  { key: "BANK_TRANSFER", label: "匯款 / 轉帳", description: "客人 ATM 或網銀轉入店家帳戶" },
  { key: "ECPAY_ATM", label: "綠界虛擬帳號", description: "Tier S 啟用後才使用" },
];

export function CheckoutFullPage({ booking, open, onOpenChange, onCompleted }: Props) {
  const [step, setStep] = useState<"review" | "method">("review");
  const [method, setMethod] = useState<PaymentMethod>("CASH");
  const [amount, setAmount] = useState<number | "">("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  // Reset on open/close so a previous checkout doesn't leak state.
  useEffect(() => {
    if (open && booking) {
      setStep("review");
      setMethod("CASH");
      setAmount("");
      setNotes("");
      setLoading(false);
    }
  }, [open, booking]);

  if (!booking) return null;

  const finalAmount = typeof amount === "number" ? amount : booking.service.price;

  const handleSubmit = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/bookings/${booking.id}/checkout`, {
        method: "POST",
        headers: adminHeaders(),
        body: JSON.stringify({
          method,
          // Only send amount when admin overrode it — otherwise let the server
          // default to service.price (single source of truth).
          ...(typeof amount === "number" ? { amount } : {}),
          ...(notes.trim() ? { notes: notes.trim() } : {}),
          ...(booking.updatedAt ? { expectedUpdatedAt: booking.updatedAt } : {}),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || err.error || "結帳失敗");
      }
      toast({ type: "success", message: "已結帳" });
      onCompleted();
    } catch (err) {
      toast({ type: "error", message: err instanceof Error ? err.message : "結帳失敗" });
    } finally {
      setLoading(false);
    }
  };

  const dateObj = new Date(booking.date.slice(0, 10) + "T00:00:00+08:00");
  const billingDateLabel = `${dateObj.getMonth() + 1} 月 ${dateObj.getDate()} 日, ${dateObj.getFullYear()}`;

  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 bg-[var(--color-text-body)]/60 z-[60] backdrop-blur-sm" />
        <Drawer.Content className="fixed bottom-0 left-0 right-0 z-[60] bg-[var(--color-bg)] rounded-t-2xl h-[92vh] outline-none flex flex-col">
          <div className="mx-auto w-10 h-1 rounded-full bg-[var(--color-surface)] mt-3 mb-2 flex-shrink-0" />

          <div className="flex items-center justify-between px-5 pb-2 flex-shrink-0">
            <button
              onClick={() => {
                if (step === "method") {
                  setStep("review");
                } else {
                  onOpenChange(false);
                }
              }}
              aria-label={step === "method" ? "返回" : "關閉"}
              className="w-9 h-9 -ml-2 rounded-full flex items-center justify-center text-[var(--color-text-body)] hover:bg-[var(--color-surface)] transition-colors"
            >
              {step === "method" ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <path d="M6 6l12 12M6 18L18 6" />
                </svg>
              )}
            </button>
            <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">
              {step === "method" ? "選擇支付方式" : "結帳"}
            </h2>
            <div className="w-9" />
          </div>

          <div className="flex-1 overflow-y-auto px-5 pb-4">
            {step === "review" && (
              <>
                {/* Customer + service */}
                <div className="rounded-lg border border-[var(--color-surface)] divide-y divide-[var(--color-surface)] mb-4">
                  <div className="flex items-center justify-between px-4 py-3">
                    <span className="text-sm text-[var(--color-text-muted)]">👤 客戶</span>
                    <span className="text-sm font-medium text-[var(--color-text-primary)]">
                      {booking.user.displayName || "未登記姓名"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between px-4 py-3">
                    <span className="text-sm text-[var(--color-text-muted)]">📅 帳單日期</span>
                    <span className="text-sm font-medium text-[var(--color-text-primary)]">
                      {billingDateLabel}
                    </span>
                  </div>
                  <div className="flex items-center justify-between px-4 py-3">
                    <span className="text-sm text-[var(--color-text-muted)]">⏰ 服務時間</span>
                    <span className="text-sm font-medium text-[var(--color-text-primary)]">
                      {booking.startTime} – {booking.endTime}
                    </span>
                  </div>
                </div>

                <p className="text-[10px] font-medium text-[var(--color-text-muted)] tracking-wider mb-2">
                  服務項目
                </p>
                <div className="rounded-lg border border-[var(--color-surface)] mb-4">
                  <div className="flex items-center justify-between px-4 py-3">
                    <span className="text-sm text-[var(--color-text-primary)]">
                      {booking.service.name}
                    </span>
                    <span className="text-sm font-medium text-[var(--color-text-primary)]">
                      NT${booking.service.price.toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Override amount */}
                <details className="mb-4">
                  <summary className="text-xs text-[var(--color-text-muted)] cursor-pointer select-none">
                    調整總額（折扣 / 加價）
                  </summary>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-xs text-[var(--color-text-muted)]">NT$</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      placeholder={String(booking.service.price)}
                      value={amount === "" ? "" : amount}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v === "") setAmount("");
                        else {
                          const n = Number(v);
                          if (Number.isFinite(n) && n >= 0) setAmount(Math.floor(n));
                        }
                      }}
                      className="flex-1 border-b border-[var(--color-brand)] bg-transparent py-1.5 text-sm text-[var(--color-text-body)] outline-none"
                    />
                  </div>
                </details>

                {/* Notes */}
                <div className="mb-6">
                  <label className="text-[10px] font-medium text-[var(--color-text-muted)] tracking-wider block mb-1">
                    結帳備註（選填）
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                    placeholder="例如：抵用券 -100、給小費等"
                    className="w-full bg-[var(--color-surface)] rounded-lg p-3 text-sm text-[var(--color-text-body)] placeholder:text-[var(--color-text-disabled)] outline-none resize-none"
                  />
                </div>
              </>
            )}

            {step === "method" && (
              <>
                <p className="text-xs text-[var(--color-text-muted)] mb-3">
                  選擇客人此次的支付方式
                </p>
                <div className="space-y-2">
                  {METHODS.map((m) => {
                    const selected = method === m.key;
                    return (
                      <button
                        key={m.key}
                        onClick={() => setMethod(m.key)}
                        className={`w-full text-left rounded-lg border px-4 py-3 transition-colors ${
                          selected
                            ? "border-[var(--color-brand)] bg-[var(--color-brand)]/5"
                            : "border-[var(--color-surface)] hover:bg-[var(--color-surface)]"
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="text-sm font-medium text-[var(--color-text-primary)]">
                              {m.label}
                            </p>
                            <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
                              {m.description}
                            </p>
                          </div>
                          <span
                            className={`mt-0.5 w-4 h-4 rounded-full border ${
                              selected
                                ? "border-[var(--color-brand)] bg-[var(--color-brand)]"
                                : "border-[var(--color-text-muted)]/40"
                            }`}
                            aria-hidden
                          />
                        </div>
                      </button>
                    );
                  })}
                </div>
                <p className="text-[11px] text-[var(--color-text-muted)] mt-4 leading-relaxed">
                  Phase 2 將支援拆分多種支付（現金 + 信用卡）。目前一次結帳只能選擇一種。
                </p>
              </>
            )}
          </div>

          {/* Sticky footer with total + primary action */}
          <div
            className="px-5 pt-3 border-t border-[var(--color-surface)] bg-[var(--color-bg)] flex-shrink-0"
            style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-[var(--color-text-muted)]">合計</span>
              <span className="text-lg font-bold text-[var(--color-text-primary)]">
                NT${finalAmount.toLocaleString()}
              </span>
            </div>
            <button
              onClick={() => {
                if (step === "review") setStep("method");
                else handleSubmit();
              }}
              disabled={loading}
              className="w-full py-3 bg-[var(--color-brand)] text-[var(--color-bg)] font-semibold rounded-lg text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {loading
                ? "處理中..."
                : step === "review"
                  ? `下一步 — 選擇支付方式`
                  : `結帳 NT$${finalAmount.toLocaleString()}`}
            </button>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
