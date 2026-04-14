"use client";

import { useState, useEffect, use, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useLiff } from "@/lib/liff/provider";
import { useToast } from "@/components/ui/toast";
import { IconArrowBack, IconCheckCircle } from "@/components/liff/icons";

interface BookingDetail {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  service: { name: string; price: number };
  tenant: {
    businessName: string;
    phone: string | null;
    bankInfo: string | null;
    bankAccountName: string | null;
    bankAccountNumber: string | null;
  };
  payment: {
    status: string;
    method: string;
    transferLastFive?: string | null;
  } | null;
}

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}/${d.getDate()} (${WEEKDAYS[d.getDay()]})`;
}

type Stage = "method" | "info" | "last5" | "submitted";

export default function PaymentPage({
  params,
}: {
  params: Promise<{ bookingId: string }>;
}) {
  const { bookingId } = use(params);
  const { isReady, liff } = useLiff();
  const { toast } = useToast();
  const router = useRouter();

  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "transfer">("cash");
  const [stage, setStage] = useState<Stage>("method");
  const [digits, setDigits] = useState<string[]>(["", "", "", "", ""]);
  const [submitting, setSubmitting] = useState(false);
  const cellRefs = useRef<Array<HTMLInputElement | null>>([]);

  const fetchBooking = useCallback(async () => {
    const r = await fetch(`/api/bookings/${bookingId}`);
    const data = await r.json();
    setBooking(data.booking);
    return data.booking as BookingDetail | null;
  }, [bookingId]);

  useEffect(() => {
    if (!isReady) return;
    fetchBooking()
      .then((b) => {
        if (b?.payment?.status === "VERIFYING" || b?.payment?.status === "RECEIVED") {
          setStage("submitted");
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [isReady, fetchBooking]);

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ message: `已複製${label}`, type: "success" });
    } catch {
      toast({ message: "複製失敗", type: "error" });
    }
  };

  const handleCashConfirm = async () => {
    try {
      const idToken = liff?.getIDToken();
      if (!idToken) {
        toast({ message: "請先登入 LINE", type: "error" });
        return;
      }
      const res = await fetch(`/api/payments/${bookingId}/confirm`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
          "X-LIFF-ID-Token": idToken,
        },
        body: JSON.stringify({ method: "CASH" }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast({ message: data.error || "送出失敗", type: "error" });
        return;
      }
      toast({ message: "已選擇現金付款，到店時直接付款即可", type: "success" });
      setTimeout(() => router.push("/my-bookings"), 800);
    } catch {
      toast({ message: "送出失敗，請稍後再試", type: "error" });
    }
  };

  const handleDigitChange = (idx: number, raw: string) => {
    const v = raw.replace(/\D/g, "").slice(-1);
    setDigits((prev) => {
      const next = [...prev];
      next[idx] = v;
      return next;
    });
    if (v && idx < 4) {
      cellRefs.current[idx + 1]?.focus();
    }
  };

  const handleDigitKeyDown = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !digits[idx] && idx > 0) {
      cellRefs.current[idx - 1]?.focus();
    }
  };

  const handleDigitPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 5);
    if (!text) return;
    e.preventDefault();
    const next = ["", "", "", "", ""];
    for (let i = 0; i < text.length; i++) next[i] = text[i];
    setDigits(next);
    const focusIdx = Math.min(text.length, 4);
    cellRefs.current[focusIdx]?.focus();
  };

  const handleSubmitLast5 = async () => {
    const transferLastFive = digits.join("");
    if (transferLastFive.length !== 5) return;

    setSubmitting(true);
    try {
      const idToken = liff?.getIDToken();
      if (!idToken) {
        toast({ message: "請先登入 LINE", type: "error" });
        setSubmitting(false);
        return;
      }
      const res = await fetch(`/api/payments/${bookingId}/report-transfer`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-LIFF-ID-Token": idToken,
        },
        body: JSON.stringify({ transferLastFive }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (res.status === 409 && data.code === "PAYMENT_LOCKED") {
          toast({ message: "已回報過末五碼，如需修改請聯絡店家", type: "info" });
          await fetchBooking();
          setStage("submitted");
          return;
        }
        toast({ message: data.error || "送出失敗", type: "error" });
        return;
      }

      toast({ message: "✓ 已收到，老闆確認後會通知您", type: "success" });
      await fetchBooking();
      setStage("submitted");
    } catch {
      toast({ message: "送出失敗，請稍後再試", type: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  // --- Loading ---
  if (!isReady || loading) {
    return (
      <div className="min-h-screen bg-[#FFF8F1] flex items-center justify-center" style={{ fontFamily: "'Manrope', 'Noto Sans TC', sans-serif" }}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-6 h-6 border-2 border-[#003D2B] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-[#003D2B]/50 font-medium">載入付款資訊...</p>
        </div>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="min-h-screen bg-[#FFF8F1] flex items-center justify-center" style={{ fontFamily: "'Manrope', 'Noto Sans TC', sans-serif" }}>
        <p className="text-[#003D2B]/40 text-sm font-medium">找不到預約</p>
      </div>
    );
  }

  const isPaid = booking.payment?.status === "RECEIVED";
  const isVerifying = booking.payment?.status === "VERIFYING";
  const dateDisplay = `${formatDate(booking.date)} · ${booking.startTime} — ${booking.endTime}`;

  const bankName = booking.tenant.bankInfo || "（店家尚未設定）";
  const bankHolder = booking.tenant.bankAccountName || "（店家尚未設定）";
  const bankNumber = booking.tenant.bankAccountNumber || "（店家尚未設定）";
  const amountStr = booking.service.price.toLocaleString();
  const bankConfigured = Boolean(
    booking.tenant.bankInfo && booking.tenant.bankAccountName && booking.tenant.bankAccountNumber,
  );

  return (
    <div className="min-h-screen bg-[#FFF8F1]" style={{ fontFamily: "'Manrope', 'Noto Sans TC', sans-serif" }}>
      {/* Fixed header */}
      <header className="fixed top-0 w-full z-50 bg-[#FFF8F1]/80 backdrop-blur-xl">
        <div className="flex items-center justify-between px-6 h-16">
          <a
            href="/my-bookings"
            className="flex items-center gap-1 text-sm text-[#003D2B]/70 font-medium hover:text-[#003D2B] transition-colors"
          >
            <IconArrowBack className="w-5 h-5" />
            返回我的預約
          </a>
          <h1 className="text-lg font-bold text-[#003D2B] tracking-tight">付款</h1>
        </div>
      </header>

      <main className="pt-24 pb-16 px-6 max-w-md mx-auto">
        {/* Booking summary card */}
        <div className="bg-[#faf2ea] rounded-xl p-6 mb-8">
          <h2 className="text-xl font-bold text-[#003D2B] tracking-tight">
            {booking.service.name}
          </h2>
          <p className="text-[#404944]/70 text-sm mt-1">{dateDisplay}</p>

          <div className="mt-8 pt-6 border-t border-[#c0c9c2]/20">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-[10px] tracking-[0.1em] font-medium text-[#404944]/60 uppercase">
                  應付金額
                </p>
                <p className="text-2xl font-extrabold text-[#003D2B] mt-1">
                  NT${amountStr}
                </p>
              </div>
              <span className="text-[10px] font-bold tracking-wider px-2 py-1 rounded-sm text-[#1a503c] bg-[#b7efd4]">
                {isPaid ? "已確認" : isVerifying ? "核對中" : "待付款"}
              </span>
            </div>
          </div>
        </div>

        {/* === Submitted / Paid state === */}
        {stage === "submitted" ? (
          <div className="flex flex-col items-center py-10 space-y-4">
            <div className="w-16 h-16 rounded-full bg-[#4A7C59]/10 flex items-center justify-center">
              <IconCheckCircle className="w-8 h-8 text-[#4A7C59]" />
            </div>
            <p className="text-lg font-bold text-[#003D2B]">
              {isPaid ? "已確認收款" : "已送出對帳資訊"}
            </p>
            <p className="text-sm text-[#404944]/60 text-center px-6">
              {isPaid
                ? "感謝您的付款，期待為您服務"
                : "老闆核對後會透過 LINE 通知您，如需修改末五碼請直接聯絡店家"}
            </p>
            {booking.payment?.transferLastFive && (
              <div className="mt-4 px-4 py-2 bg-[#faf2ea] rounded-md">
                <p className="text-[10px] tracking-widest text-[#404944]/60 uppercase mb-1">
                  已回報末五碼
                </p>
                <p className="font-mono font-bold text-[#003D2B] tracking-[0.3em] text-center">
                  {booking.payment.transferLastFive}
                </p>
              </div>
            )}
            <a
              href="/my-bookings"
              className="mt-6 text-sm font-bold tracking-widest text-[#003D2B] underline underline-offset-4"
            >
              返回我的預約
            </a>
          </div>
        ) : stage === "method" ? (
          /* === Stage 0: Method picker === */
          <>
            <div className="space-y-4 mt-6">
              <h3 className="text-sm font-bold tracking-widest text-[#404944]/80 uppercase">
                選擇付款方式
              </h3>

              <label className="flex items-start gap-4 p-4 cursor-pointer">
                <input
                  type="radio"
                  name="payment-method"
                  checked={paymentMethod === "cash"}
                  onChange={() => setPaymentMethod("cash")}
                  className="w-5 h-5 mt-0.5 text-[#003D2B] border-[#707974] focus:ring-0 accent-[#003D2B]"
                />
                <div>
                  <p className="font-bold text-[#1e1b17]">到店現金付款</p>
                  <p className="text-sm text-[#404944]/60 mt-0.5">到店時直接付款即可</p>
                </div>
              </label>

              <label className="flex items-start gap-4 p-4 cursor-pointer">
                <input
                  type="radio"
                  name="payment-method"
                  checked={paymentMethod === "transfer"}
                  onChange={() => setPaymentMethod("transfer")}
                  className="w-5 h-5 mt-0.5 text-[#003D2B] border-[#707974] focus:ring-0 accent-[#003D2B]"
                />
                <div>
                  <p className="font-bold text-[#1e1b17]">銀行轉帳</p>
                  <p className="text-sm text-[#404944]/60 mt-0.5">
                    轉帳後回填轉出帳號末 5 碼
                  </p>
                </div>
              </label>
            </div>

            <button
              onClick={() => {
                if (paymentMethod === "cash") {
                  handleCashConfirm();
                } else {
                  setStage("info");
                }
              }}
              className="w-full bg-[#003D2B] text-[#FFF8F1] py-4 font-bold tracking-widest text-sm rounded mt-10 hover:bg-[#003D2B]/90 transition-colors active:scale-[0.98]"
            >
              {paymentMethod === "cash" ? "確認現金付款" : "前往轉帳"}
            </button>
          </>
        ) : stage === "info" ? (
          /* === Stage 1: Bank info === */
          <>
            <h3 className="text-sm font-bold tracking-widest text-[#404944]/80 uppercase mt-6 mb-4">
              轉帳資訊
            </h3>

            {!bankConfigured && (
              <div className="bg-[#FFF4E5] border border-[#F59E0B]/30 rounded-md px-4 py-3 mb-4 text-sm text-[#8B4513]">
                店家尚未設定銀行資訊，請改選現金或聯絡店家。
              </div>
            )}

            <div className="bg-[#faf2ea] rounded-xl p-5 space-y-4">
              <InfoRow label="銀行" value={bankName} onCopy={() => copy(bankName, "銀行")} disabled={!booking.tenant.bankInfo} />
              <InfoRow label="戶名" value={bankHolder} onCopy={() => copy(bankHolder, "戶名")} disabled={!booking.tenant.bankAccountName} />
              <InfoRow label="帳號" value={bankNumber} mono onCopy={() => copy(bankNumber.replace(/\D/g, ""), "帳號")} disabled={!booking.tenant.bankAccountNumber} />
              <InfoRow label="金額" value={`NT$${amountStr}`} onCopy={() => copy(String(booking.service.price), "金額")} />
            </div>

            <p className="text-xs text-[#404944]/60 mt-4 leading-relaxed">
              請使用銀行 App 或 ATM 轉帳上述帳號。完成後點擊下方按鈕回填轉出帳號末 5 碼。
            </p>

            <div className="flex gap-3 mt-8">
              <button
                onClick={() => setStage("method")}
                className="flex-1 border border-[#003D2B]/20 text-[#003D2B] py-4 font-bold tracking-widest text-sm rounded hover:bg-[#003D2B]/5 transition-colors"
              >
                上一步
              </button>
              <button
                onClick={() => setStage("last5")}
                disabled={!bankConfigured}
                className="flex-[2] bg-[#003D2B] text-[#FFF8F1] py-4 font-bold tracking-widest text-sm rounded hover:bg-[#003D2B]/90 transition-colors active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                我已完成轉帳
              </button>
            </div>
          </>
        ) : (
          /* === Stage 2: Last-5 entry === */
          <>
            <h3 className="text-sm font-bold tracking-widest text-[#404944]/80 uppercase mt-6 mb-2">
              回填末五碼
            </h3>
            <p className="text-sm text-[#404944]/70 mb-6 leading-relaxed">
              請至銀行 App 查詢您轉出帳戶的後 5 位數字
            </p>

            <div className="flex justify-between gap-2 mb-4" onPaste={handleDigitPaste}>
              {digits.map((d, idx) => (
                <input
                  key={idx}
                  ref={(el) => {
                    cellRefs.current[idx] = el;
                  }}
                  type="text"
                  inputMode="numeric"
                  pattern="\d{1}"
                  maxLength={1}
                  autoComplete="off"
                  value={d}
                  onChange={(e) => handleDigitChange(idx, e.target.value)}
                  onKeyDown={(e) => handleDigitKeyDown(idx, e)}
                  onFocus={(e) => e.currentTarget.select()}
                  className="w-12 h-14 sm:w-14 sm:h-16 text-center text-2xl font-bold font-mono text-[#003D2B] bg-[#faf2ea] border border-[#c0c9c2]/30 rounded-md focus:outline-none focus:border-[#003D2B] focus:bg-white transition-colors"
                />
              ))}
            </div>

            <p className="text-xs text-[#404944]/50 leading-relaxed">
              例如：您的轉出帳號是 123-456-78901，請填「78901」。送出後將鎖定無法修改，若填錯請聯絡店家。
            </p>

            <div className="flex gap-3 mt-8">
              <button
                onClick={() => setStage("info")}
                disabled={submitting}
                className="flex-1 border border-[#003D2B]/20 text-[#003D2B] py-4 font-bold tracking-widest text-sm rounded hover:bg-[#003D2B]/5 transition-colors disabled:opacity-50"
              >
                上一步
              </button>
              <button
                onClick={handleSubmitLast5}
                disabled={digits.join("").length !== 5 || submitting}
                className="flex-[2] bg-[#003D2B] text-[#FFF8F1] py-4 font-bold tracking-widest text-sm rounded hover:bg-[#003D2B]/90 transition-colors active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {submitting ? "送出中..." : "送出對帳"}
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function InfoRow({
  label,
  value,
  mono,
  onCopy,
  disabled,
}: {
  label: string;
  value: string;
  mono?: boolean;
  onCopy: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[#404944]/60 text-sm shrink-0">{label}</span>
      <div className="flex items-center gap-2 min-w-0">
        <span className={`text-[#1e1b17] font-medium text-sm truncate ${mono ? "font-mono" : ""}`}>
          {value}
        </span>
        <button
          type="button"
          onClick={onCopy}
          disabled={disabled}
          className="text-[10px] font-bold tracking-widest text-[#003D2B] border border-[#003D2B]/20 px-2 py-1 rounded hover:bg-[#003D2B]/5 transition-colors disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
        >
          複製
        </button>
      </div>
    </div>
  );
}
