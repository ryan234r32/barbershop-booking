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
import { Plus, X, User, Calendar, Clock } from "lucide-react";
import QRCode from "react-qr-code";
import { useToast } from "@/components/ui/toast";
import { adminHeaders } from "@/lib/auth/admin-fetch";
import { FullscreenModal } from "./fullscreen-modal";

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
  user: {
    /** V3.7 Tier 1.8 — used by 設為熟客 PATCH /api/customers/[id]/discount path */
    id?: string;
    displayName: string | null;
    /** "manual-..." prefix → walk-in 客人尚未綁 LINE，BANK_TRANSFER 時跳 QR 流程 */
    lineUserId: string;
    /** V3.7 Tier 1.8 — 熟客自動帶折扣 (NULL = 一般客) */
    defaultDiscount?: number | null;
  };
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

/** walk-in 客人 BANK_TRANSFER 三選項 */
type WalkinOption = "invite" | "manual_5" | "skip";

export function CheckoutFullPage({ booking, open, onOpenChange, onCompleted }: Props) {
  const [step, setStep] = useState<"review" | "method">("review");
  const [method, setMethod] = useState<PaymentMethod>("CASH");
  const [serviceAmount, setServiceAmount] = useState<number | "">("");
  const [products, setProducts] = useState<ProductLine[]>([]);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  // walk-in 客人 BANK_TRANSFER 流程的選項與輔助狀態
  const [walkinOption, setWalkinOption] = useState<WalkinOption>("invite");
  const [manualLast5, setManualLast5] = useState("");
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const { toast } = useToast();

  // 偵測 walk-in（手動建單但未綁 LINE）— 用於 BANK_TRANSFER 時跳三選項
  const isWalkin = booking?.user.lineUserId.startsWith("manual-") ?? false;
  const showWalkinOptions = method === "BANK_TRANSFER" && isWalkin;

  // Reset on open/close so a previous checkout doesn't leak state.
  // V3.7 Tier 1.8: 若客戶有 defaultDiscount (熟客)，自動帶入 serviceAmount =
  // service.price - defaultDiscount → 老闆 1-tap 結帳不用每次調折扣。
  useEffect(() => {
    if (open && booking) {
      setStep("review");
      setMethod("CASH");
      const discount = booking.user.defaultDiscount;
      if (typeof discount === "number" && discount > 0) {
        setServiceAmount(Math.max(0, booking.service.price - discount));
      } else {
        setServiceAmount("");
      }
      // V3.7 Tier 0.1.D — 預設展開 1 空 row（老闆要求「不用點新增商品」）
      // 空 row 在 handleSubmit filter 時自動忽略（p.name.trim() && price > 0 才算數）
      setProducts([newProductLine()]);
      setNotes("");
      setLoading(false);
      setWalkinOption("invite");
      setManualLast5("");
      setQrUrl(null);
      setQrLoading(false);
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

  /** 拿 bind-token API 產的 QR URL（admin 點「顯示 QR」時呼叫一次） */
  const handleShowQr = async () => {
    if (!booking || qrLoading) return;
    setQrLoading(true);
    try {
      const res = await fetch(`/api/admin/bookings/${booking.id}/bind-token`, {
        method: "POST",
        headers: adminHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.message || "產生 QR 失敗");
      if (!data.qrUrl) {
        toast({ type: "error", message: "QR Code 未啟用 — 請聯絡開發者設定 LINE_OA_BASIC_ID" });
        return;
      }
      setQrUrl(data.qrUrl);
    } catch (err) {
      toast({ type: "error", message: err instanceof Error ? err.message : "QR 產生失敗" });
    } finally {
      setQrLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (loading) return;
    // Validation: every visible product must have a non-empty name AND a positive price.
    const validProducts = products.filter((p) => p.name.trim() && typeof p.price === "number" && p.price > 0);
    const incompleteProducts = products.filter((p) => p.name.trim() || (typeof p.price === "number" && p.price > 0)).length - validProducts.length;
    if (incompleteProducts > 0) {
      toast({ type: "error", message: "加購商品的名稱和金額都要填" });
      return;
    }

    // walk-in BANK_TRANSFER 額外驗證
    let transferLastFive: string | undefined;
    if (showWalkinOptions) {
      if (walkinOption === "manual_5") {
        if (!/^\d{5}$/.test(manualLast5)) {
          toast({ type: "error", message: "請輸入 5 位數字後 5 碼" });
          return;
        }
        transferLastFive = manualLast5;
      }
      // option=invite or skip → 不傳 transferLastFive
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
          ...(transferLastFive ? { transferLastFive } : {}),
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

  if (!open) return null;

  return (
    // FullscreenModal — PR #92 已驗證 vaul 在 iOS PWA 不穩；preventDismiss
    // 確保結帳流程不會被誤觸關閉。
    <FullscreenModal onClose={() => onOpenChange(false)} preventDismiss>
      <div className="flex flex-col h-full">
          <div className="flex items-center justify-between px-5 pt-3 pb-2 flex-shrink-0">
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
                    <span className="text-sm text-[var(--color-text-muted)] inline-flex items-center gap-1.5">
                      <User size={14} aria-hidden /> 客戶
                    </span>
                    <span className="text-sm font-medium text-[var(--color-text-primary)]">
                      {booking.user.displayName || "未登記姓名"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between px-4 py-3">
                    <span className="text-sm text-[var(--color-text-muted)] inline-flex items-center gap-1.5">
                      <Calendar size={14} aria-hidden /> 帳單日期
                    </span>
                    <span className="text-sm font-medium text-[var(--color-text-primary)]">
                      {billingDateLabel}
                    </span>
                  </div>
                  <div className="flex items-center justify-between px-4 py-3">
                    <span className="text-sm text-[var(--color-text-muted)] inline-flex items-center gap-1.5">
                      <Clock size={14} aria-hidden /> 服務時間
                    </span>
                    <span className="text-sm font-medium text-[var(--color-text-primary)]">
                      {booking.startTime} – {booking.endTime}
                    </span>
                  </div>
                </div>

                <p className="text-[10px] font-medium text-[var(--color-text-muted)] tracking-wider mb-2">
                  服務項目
                </p>
                {/* V3.7 Tier 0.4 (autoplan consensus D-A + D-I + user 5/17):
                    服務 chip inline 顯示（拿掉 <details> 三角形），
                    quick-tile 折扣 5 個（-100 / -200 / 9折 / 85折 / 自訂）讓老闆 1-tap 改價，
                    加購 row button 加大方便濕手點。原 details "調整服務金額" 整段砍掉。 */}
                <div className="rounded-lg border border-[var(--color-surface)] mb-3 px-4 py-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-[var(--color-text-primary)]">
                      {booking.service.name}
                    </span>
                    <span className="text-sm font-medium text-[var(--color-text-primary)] tabular-nums">
                      原價 NT${booking.service.price.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 pt-2 border-t border-[var(--color-surface)]/50">
                    <span className="text-xs text-[var(--color-text-muted)] shrink-0">實收</span>
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
                      className="flex-1 border-b border-[var(--color-brand)] bg-transparent py-2 text-base font-semibold text-[var(--color-text-body)] outline-none tabular-nums"
                      aria-label="實收金額"
                    />
                  </div>
                  {/* Quick-tile 折扣（autoplan D-I：5 個常用，1 tap = 改價）*/}
                  <div className="grid grid-cols-5 gap-1.5 mt-3">
                    {[
                      { label: "原價", calc: (p: number) => p },
                      { label: "-100", calc: (p: number) => Math.max(0, p - 100) },
                      { label: "-200", calc: (p: number) => Math.max(0, p - 200) },
                      { label: "9折", calc: (p: number) => Math.round(p * 0.9) },
                      { label: "85折", calc: (p: number) => Math.round(p * 0.85) },
                    ].map((tile) => {
                      const next = tile.calc(booking.service.price);
                      const active = serviceAmount === next || (tile.label === "原價" && serviceAmount === "");
                      return (
                        <button
                          key={tile.label}
                          type="button"
                          onClick={() => setServiceAmount(tile.label === "原價" ? "" : next)}
                          className={`min-h-[44px] rounded-md text-xs font-semibold tabular-nums transition-colors ${
                            active
                              ? "bg-[var(--color-brand)] text-[var(--color-bg)]"
                              : "bg-[var(--color-surface)] text-[var(--color-text-body)] hover:bg-[var(--color-brand)]/15"
                          }`}
                          aria-label={`折扣 ${tile.label}`}
                          aria-pressed={active}
                        >
                          {tile.label}
                        </button>
                      );
                    })}
                  </div>
                  {/* V3.7 Tier 1.8 — 熟客自動帶折扣設定 + 顯示。
                      熟客身分由「設為熟客」按鈕建立 (折扣金額存 User.defaultDiscount)，
                      下次該客戶來結帳時自動帶入 serviceAmount = 原價 - defaultDiscount。 */}
                  {booking.user.id && (
                    <LoyaltyDiscountControl
                      userId={booking.user.id}
                      customerName={booking.user.displayName ?? "客人"}
                      currentDiscount={booking.user.defaultDiscount ?? null}
                      servicePrice={booking.service.price}
                    />
                  )}
                </div>

                {/* V3.7 Tier 0.1.D — 加購商品 redesign:
                      老闆要求：預設展開 1 row 不要點「新增商品」
                      UI 清楚化：標題往上、row 邊框 + label 變大 + 加大商品名 input
                      空 row 不會送出（handleSubmit filter 過濾） */}
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                    加購商品
                    <span className="ml-2 text-[10px] font-normal text-[var(--color-text-muted)]">
                      未填空白會自動忽略
                    </span>
                  </p>
                </div>
                <div className="space-y-2 mb-3">
                  {products.map((p, i) => (
                    <div
                      key={p.id}
                      className="flex items-center gap-2 rounded-lg border border-[var(--color-brand)]/15 bg-[var(--color-bg)] px-3 py-2.5"
                    >
                      <span className="text-xs text-[var(--color-text-muted)] shrink-0 font-mono">
                        {i + 1}.
                      </span>
                      <input
                        value={p.name}
                        onChange={(e) => updateProduct(p.id, { name: e.target.value })}
                        placeholder="洗髮精 / 護髮油 / 髮蠟 …"
                        className="flex-1 min-w-0 bg-transparent text-base text-[var(--color-text-body)] outline-none placeholder:text-[var(--color-text-disabled)] placeholder:text-sm"
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
                        className="w-20 bg-transparent text-base font-semibold text-[var(--color-text-body)] outline-none text-right placeholder:text-[var(--color-text-disabled)] tabular-nums"
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
                  <button
                    type="button"
                    onClick={addProduct}
                    className="inline-flex items-center gap-1 text-xs text-[var(--color-brand)] hover:opacity-80 transition-opacity mt-1"
                  >
                    <Plus size={14} />
                    再加一筆
                  </button>
                </div>

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

                {/* Walk-in 客人 BANK_TRANSFER 三選項 — 客人尚未綁 LINE，
                    管理員需指定後續對帳方式 */}
                {showWalkinOptions && (
                  <div className="mt-5 border-t border-[var(--color-surface)] pt-4">
                    <p className="text-xs font-semibold text-[var(--color-text-primary)] mb-1">
                      客人尚未綁 LINE
                    </p>
                    <p className="text-[11px] text-[var(--color-text-muted)] mb-3 leading-relaxed">
                      請選擇收款資訊的傳遞方式
                    </p>
                    <div className="space-y-2">
                      <WalkinOptionCard
                        selected={walkinOption === "invite"}
                        onSelect={() => setWalkinOption("invite")}
                        title="邀請客人加 LINE 好友（推薦）"
                        description="掃 QR 後客人即收到帳號 + 金額；之後傳 5 碼自動入帳"
                      >
                        {walkinOption === "invite" && (
                          <button
                            type="button"
                            onClick={handleShowQr}
                            disabled={qrLoading}
                            className="mt-2 w-full py-2 bg-[var(--color-brand)]/10 text-[var(--color-brand)] rounded text-xs font-semibold hover:bg-[var(--color-brand)]/20 disabled:opacity-50"
                          >
                            {qrLoading ? "產生中..." : "顯示 QR Code 給客人掃"}
                          </button>
                        )}
                      </WalkinOptionCard>

                      <WalkinOptionCard
                        selected={walkinOption === "manual_5"}
                        onSelect={() => setWalkinOption("manual_5")}
                        title="直接輸入後 5 碼"
                        description="現場詢問客人匯款後 5 碼"
                      >
                        {walkinOption === "manual_5" && (
                          <input
                            type="text"
                            inputMode="numeric"
                            pattern="\d{5}"
                            maxLength={5}
                            value={manualLast5}
                            onChange={(e) => setManualLast5(e.target.value.replace(/\D/g, "").slice(0, 5))}
                            placeholder="12345"
                            className="mt-2 w-full px-3 py-2 border border-[var(--color-surface)] rounded text-sm tracking-widest text-center font-mono outline-none focus:border-[var(--color-brand)]"
                          />
                        )}
                      </WalkinOptionCard>

                      <WalkinOptionCard
                        selected={walkinOption === "skip"}
                        onSelect={() => setWalkinOption("skip")}
                        title="暫不收款（記為待匯款）"
                        description="客人事後再補轉帳，老闆收 SMS 後手動補 5 碼"
                      />
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* QR Code 覆蓋層 — 邀請 walk-in 客人加 LINE 好友 */}
          {qrUrl && (
            <BindLineQrOverlay
              qrUrl={qrUrl}
              customerName={booking.user.displayName ?? "客人"}
              onClose={() => setQrUrl(null)}
            />
          )}

          {/* Sticky footer with total + primary action.
              V3.7 Tier 0.4 (autoplan consensus D-A): 應付金額 XXL 是老闆現場第一個要看到的，
              字級 text-3xl + 標籤「應付」加大；按鈕 destructive 改 h-16 (64pt) 符合 D-I 64pt
              destructive 規範。濕手 + 剪髮中 一 tap 即收。*/}
          <div
            className="px-5 pt-3 border-t border-[var(--color-surface)] bg-[var(--color-bg)] flex-shrink-0"
            style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
          >
            <div className="flex items-baseline justify-between mb-3">
              <span className="text-sm font-medium text-[var(--color-text-muted)]">應付</span>
              <span className="text-3xl font-bold text-[var(--color-text-primary)] tabular-nums leading-none">
                NT${finalAmount.toLocaleString()}
              </span>
            </div>
            <button
              onClick={() => {
                if (step === "review") setStep("method");
                else handleSubmit();
              }}
              disabled={loading}
              className="w-full h-16 bg-[var(--color-brand)] text-[var(--color-bg)] font-semibold rounded-lg text-base hover:opacity-90 active:opacity-80 transition-opacity disabled:opacity-50"
            >
              {loading
                ? "處理中..."
                : step === "review"
                  ? `下一步 — 選擇支付方式`
                  : `結帳 NT$${finalAmount.toLocaleString()}`}
            </button>
          </div>
      </div>
    </FullscreenModal>
  );
}

/** Walk-in BANK_TRANSFER 選項卡片 — radio button + 條件 children */
function WalkinOptionCard({
  selected,
  onSelect,
  title,
  description,
  children,
}: {
  selected: boolean;
  onSelect: () => void;
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-lg border px-4 py-3 transition-colors cursor-pointer ${
        selected
          ? "border-[var(--color-brand)] bg-[var(--color-brand)]/5"
          : "border-[var(--color-surface)] hover:bg-[var(--color-surface)]"
      }`}
      onClick={onSelect}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <p className="text-sm font-medium text-[var(--color-text-primary)]">{title}</p>
          <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5 leading-relaxed">
            {description}
          </p>
        </div>
        <span
          className={`mt-0.5 w-4 h-4 rounded-full border flex-shrink-0 ${
            selected
              ? "border-[var(--color-brand)] bg-[var(--color-brand)]"
              : "border-[var(--color-text-muted)]/40"
          }`}
          aria-hidden
        />
      </div>
      {children && <div onClick={(e) => e.stopPropagation()}>{children}</div>}
    </div>
  );
}

/** QR Code 覆蓋層 — 給 walk-in 客人掃描加 LINE 好友。
 *  使用 react-qr-code 在本地產生 inline SVG（避免依賴外部服務 + 規避 CSP 阻擋）。 */
function BindLineQrOverlay({
  qrUrl,
  customerName,
  onClose,
}: {
  qrUrl: string;
  customerName: string;
  onClose: () => void;
}) {
  return (
    <div
      className="absolute inset-0 z-10 bg-black/60 flex items-center justify-center p-6"
      onClick={onClose}
    >
      <div
        className="bg-[var(--color-bg)] rounded-2xl p-6 max-w-sm w-full text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-bold text-[var(--color-text-primary)] mb-1">
          請客人掃 QR Code
        </h3>
        <p className="text-xs text-[var(--color-text-muted)] mb-4">
          {customerName} 掃描後加為好友 + 點傳送，銀行帳號自動發送到 LINE
        </p>
        <div className="bg-white rounded-xl p-4 inline-block">
          <QRCode value={qrUrl} size={256} level="M" />
        </div>
        <p className="text-[11px] text-[var(--color-text-muted)] mt-3 leading-relaxed">
          連結 10 分鐘內有效。客人加好友後直接按「傳送」即可完成綁定。
        </p>
        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full py-2.5 border border-[var(--color-surface)] rounded-lg text-sm text-[var(--color-text-body)] hover:bg-[var(--color-surface)]"
        >
          關閉
        </button>
      </div>
    </div>
  );
}


/**
 * V3.7 Tier 1.8 — 熟客折扣設定 inline UI。
 *
 * 兩種狀態：
 *   - 已是熟客 (currentDiscount > 0): 顯示「熟客 -NN」chip + ✕ 取消按鈕
 *   - 一般客 (currentDiscount = null): 顯示「設為熟客」button → 點開 inline input → 存
 *
 * Side effect: PATCH /api/customers/[id] (defaultDiscount field) → next 結帳 auto-fill。
 * 不刷新本次 booking 的 serviceAmount (老闆可能已手動調)。
 */
function LoyaltyDiscountControl({
  userId,
  customerName,
  currentDiscount,
  servicePrice,
}: {
  userId: string;
  customerName: string;
  currentDiscount: number | null;
  servicePrice: number;
}) {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [draftAmount, setDraftAmount] = useState<string>("");
  const [saving, setSaving] = useState(false);
  // Optimistic local mirror so the chip flips immediately on save.
  const [localDiscount, setLocalDiscount] = useState<number | null>(currentDiscount);

  // Re-sync when prop changes (different booking opened).
  useEffect(() => {
    setLocalDiscount(currentDiscount);
    setEditing(false);
    setDraftAmount("");
  }, [currentDiscount, userId]);

  const save = async (next: number | null) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/customers/${userId}`, {
        method: "PATCH",
        headers: { ...adminHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ defaultDiscount: next }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      setLocalDiscount(next);
      setEditing(false);
      setDraftAmount("");
      toast({
        type: "success",
        message: next === null ? "已取消熟客身分" : `已設為熟客 -${next}`,
      });
    } catch (err) {
      toast({
        type: "error",
        message: err instanceof Error ? err.message : "儲存失敗",
      });
    } finally {
      setSaving(false);
    }
  };

  // State 1: 已是熟客
  if (localDiscount !== null && localDiscount > 0 && !editing) {
    return (
      <div className="flex items-center gap-2 mt-3 px-3 py-2 rounded-lg bg-[var(--color-success)]/10 border border-[var(--color-success)]/30">
        <span className="text-sm font-semibold text-[var(--color-success)]">
          ⭐ 熟客 −NT${localDiscount}
        </span>
        <span className="text-[11px] text-[var(--color-text-muted)] flex-1">
          {customerName} 下次自動帶入
        </span>
        <button
          type="button"
          onClick={() => save(null)}
          disabled={saving}
          className="text-xs font-medium text-[var(--color-text-muted)] hover:text-[var(--color-danger)] disabled:opacity-50"
          aria-label="取消熟客身分"
        >
          取消
        </button>
      </div>
    );
  }

  // State 2: 編輯中
  if (editing) {
    return (
      <div className="flex items-center gap-2 mt-3 px-3 py-2 rounded-lg bg-[var(--color-surface)]/60 border border-[var(--color-brand)]/30">
        <span className="text-xs text-[var(--color-text-muted)] shrink-0">折扣 NT$</span>
        <input
          type="number"
          inputMode="numeric"
          autoFocus
          value={draftAmount}
          onChange={(e) => setDraftAmount(e.target.value)}
          placeholder="100"
          className="flex-1 bg-transparent border-b border-[var(--color-brand)] py-1 text-sm font-semibold text-[var(--color-text-body)] outline-none tabular-nums"
          aria-label="熟客折扣金額"
        />
        <button
          type="button"
          onClick={() => {
            const n = Number(draftAmount);
            if (!Number.isFinite(n) || n <= 0 || n > servicePrice) {
              toast({ type: "error", message: `金額須 1-${servicePrice} 之間` });
              return;
            }
            save(Math.floor(n));
          }}
          disabled={saving || draftAmount === ""}
          className="px-3 py-1.5 rounded-md bg-[var(--color-brand)] text-[var(--color-bg)] text-xs font-semibold disabled:opacity-50"
        >
          {saving ? "儲存中" : "儲存"}
        </button>
        <button
          type="button"
          onClick={() => {
            setEditing(false);
            setDraftAmount("");
          }}
          disabled={saving}
          className="px-2 py-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] disabled:opacity-50"
        >
          ✕
        </button>
      </div>
    );
  }

  // State 3: 一般客 — 顯示「設為熟客」button
  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="inline-flex items-center gap-1.5 mt-3 min-h-[36px] px-3 rounded-md text-xs font-medium text-[var(--color-text-muted)] hover:text-[var(--color-brand)] hover:bg-[var(--color-brand)]/10 transition-colors"
    >
      ⭐ 設為熟客（下次自動帶折扣）
    </button>
  );
}
