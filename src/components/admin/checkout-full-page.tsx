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
import { Plus, X } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { adminHeaders } from "@/lib/auth/admin-fetch";

export type PaymentMethod = "CASH" | "BANK_TRANSFER" | "ECPAY_ATM";

/**
 * Free-text 加購商品 line item — kept lightweight per V3.5 plan §4 (no
 * Product table). Owner sells products rarely (~handful per month) so the
 * value of full SKU tracking doesn't justify a schema migration. Items are
 * rendered into Payment.notes as human-readable breakdown so it shows up in
 *付款對帳 + 現金流 history without changing aggregations.
 */
interface ProductLine {
  id: string;
  name: string;
  price: number | "";
}

function newProductLine(): ProductLine {
  // crypto.randomUUID() exists in modern browsers + Node — used purely as
  // a stable React key so reordering doesn't cause input remounts.
  return {
    id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Math.random()),
    name: "",
    price: "",
  };
}

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
  const [serviceAmount, setServiceAmount] = useState<number | "">("");
  const [products, setProducts] = useState<ProductLine[]>([]);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  // Reset on open/close so a previous checkout doesn't leak state.
  useEffect(() => {
    if (open && booking) {
      setStep("review");
      setMethod("CASH");
      setServiceAmount("");
      setProducts([]);
      setNotes("");
      setLoading(false);
    }
  }, [open, booking]);

  if (!booking) return null;

  // Service total = override (if set) or price from service.
  const serviceTotal = typeof serviceAmount === "number" ? serviceAmount : booking.service.price;
  const productsTotal = products.reduce(
    (sum, p) => sum + (typeof p.price === "number" ? p.price : 0),
    0,
  );
  const finalAmount = serviceTotal + productsTotal;

  const addProduct = () => setProducts((prev) => [...prev, newProductLine()]);
  const updateProduct = (id: string, patch: Partial<ProductLine>) =>
    setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  const removeProduct = (id: string) =>
    setProducts((prev) => prev.filter((p) => p.id !== id));

  const handleSubmit = async () => {
    if (loading) return;
    // Validation: every visible product must have a non-empty name AND a positive price.
    const validProducts = products.filter((p) => p.name.trim() && typeof p.price === "number" && p.price > 0);
    const incompleteProducts = products.filter((p) => p.name.trim() || (typeof p.price === "number" && p.price > 0)).length - validProducts.length;
    if (incompleteProducts > 0) {
      toast({ type: "error", message: "加購商品的名稱和金額都要填" });
      return;
    }

    setLoading(true);
    try {
      // Build a human-readable breakdown for Payment.notes so future bookkeeping
      // can see the product mix without a separate table. Format:
      //   服務: 男性剪髮 NT$1,000 (折扣後)
      //   商品: 造型品 NT$600 / 護髮油 NT$200
      //   --
      //   {admin's manual note if any}
      const lines: string[] = [];
      if (serviceTotal !== booking.service.price) {
        lines.push(
          `服務: ${booking.service.name} NT$${serviceTotal.toLocaleString()}（原價 ${booking.service.price.toLocaleString()}，已調整）`,
        );
      } else {
        lines.push(`服務: ${booking.service.name} NT$${serviceTotal.toLocaleString()}`);
      }
      if (validProducts.length > 0) {
        const breakdown = validProducts
          .map((p) => `${p.name.trim()} NT$${(p.price as number).toLocaleString()}`)
          .join(" / ");
        lines.push(`商品: ${breakdown}`);
      }
      if (notes.trim()) {
        lines.push("--");
        lines.push(notes.trim());
      }
      const composedNotes = lines.join("\n");

      const res = await fetch(`/api/bookings/${booking.id}/checkout`, {
        method: "POST",
        headers: adminHeaders(),
        body: JSON.stringify({
          method,
          // Always send the computed grand total — server defaults to
          // service.price if amount is omitted, but we now have products on
          // top of (or in place of) the service price, so be explicit.
          amount: finalAmount,
          notes: composedNotes,
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
                <div className="rounded-lg border border-[var(--color-surface)] mb-3">
                  <div className="flex items-center justify-between px-4 py-3">
                    <span className="text-sm text-[var(--color-text-primary)]">
                      {booking.service.name}
                    </span>
                    <span className="text-sm font-medium text-[var(--color-text-primary)] tabular-nums">
                      NT${serviceTotal.toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Service amount override */}
                <details className="mb-5">
                  <summary className="text-xs text-[var(--color-text-muted)] cursor-pointer select-none">
                    調整服務金額（折扣 / 加價）
                  </summary>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-xs text-[var(--color-text-muted)]">NT$</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      placeholder={String(booking.service.price)}
                      value={serviceAmount === "" ? "" : serviceAmount}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v === "") setServiceAmount("");
                        else {
                          const n = Number(v);
                          if (Number.isFinite(n) && n >= 0) setServiceAmount(Math.floor(n));
                        }
                      }}
                      className="flex-1 border-b border-[var(--color-brand)] bg-transparent py-1.5 text-sm text-[var(--color-text-body)] outline-none"
                    />
                  </div>
                </details>

                {/* Products (free text — see ProductLine docstring at top) */}
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-medium text-[var(--color-text-muted)] tracking-wider">
                    加購商品
                  </p>
                  <button
                    type="button"
                    onClick={addProduct}
                    className="flex items-center gap-1 text-xs text-[var(--color-brand)] hover:opacity-80 transition-opacity"
                  >
                    <Plus size={14} />
                    新增商品
                  </button>
                </div>
                {products.length === 0 ? (
                  <p className="text-[11px] text-[var(--color-text-muted)] mb-5">
                    若客人有加購商品（造型品、護髮油等）請點「新增商品」加入。
                  </p>
                ) : (
                  <div className="space-y-2 mb-5">
                    {products.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center gap-2 rounded-lg border border-[var(--color-surface)] px-3 py-2"
                      >
                        <input
                          value={p.name}
                          onChange={(e) => updateProduct(p.id, { name: e.target.value })}
                          placeholder="商品名稱"
                          className="flex-1 min-w-0 bg-transparent text-sm text-[var(--color-text-body)] outline-none placeholder:text-[var(--color-text-disabled)]"
                          aria-label="商品名稱"
                        />
                        <span className="text-xs text-[var(--color-text-muted)] shrink-0">NT$</span>
                        <input
                          type="number"
                          inputMode="numeric"
                          value={p.price === "" ? "" : p.price}
                          onChange={(e) => {
                            const v = e.target.value;
                            if (v === "") updateProduct(p.id, { price: "" });
                            else {
                              const n = Number(v);
                              if (Number.isFinite(n) && n >= 0) updateProduct(p.id, { price: Math.floor(n) });
                            }
                          }}
                          placeholder="0"
                          className="w-20 bg-transparent text-sm text-[var(--color-text-body)] outline-none text-right placeholder:text-[var(--color-text-disabled)] tabular-nums"
                          aria-label="商品金額"
                        />
                        <button
                          type="button"
                          onClick={() => removeProduct(p.id)}
                          aria-label="移除商品"
                          className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10 transition-colors"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

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
