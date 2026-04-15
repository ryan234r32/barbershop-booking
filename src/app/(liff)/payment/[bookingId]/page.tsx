"use client";

import { useState, useEffect, use, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useLiff } from "@/lib/liff/provider";
import { useToast } from "@/components/ui/toast";
import { IconArrowBack, IconCheckCircle } from "@/components/liff/icons";
import {
  formatAccountNumber,
  formatBankLabel,
} from "@/lib/ecpay/bank-codes";
import { useEcpayStatus } from "@/lib/hooks/use-ecpay-status";

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

/**
 * Format an ISO timestamp as "4/16 23:59 前" in Taipei timezone.
 * Returns empty string for nullish input.
 */
function formatExpireDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const month = get("month");
  const day = get("day");
  const hour = get("hour");
  const minute = get("minute");
  return `${month}/${day} ${hour}:${minute} 前`;
}

type Method = "cash" | "transfer" | "ecpay";
type Stage = "method" | "info" | "last5" | "submitted" | "ecpay-waiting" | "ecpay-vaccount";

export default function PaymentPage({
  params,
}: {
  params: Promise<{ bookingId: string }>;
}) {
  const { bookingId } = use(params);
  const { isReady, liff, userId: liffUserId } = useLiff();
  const { toast } = useToast();
  const router = useRouter();

  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [ecpayEnabled, setEcpayEnabled] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<Method>("cash");
  const [stage, setStage] = useState<Stage>("method");
  const [digits, setDigits] = useState<string[]>(["", "", "", "", ""]);
  const [submitting, setSubmitting] = useState(false);
  const [ecpayAmount, setEcpayAmount] = useState<number | null>(null);
  const cellRefs = useRef<Array<HTMLInputElement | null>>([]);
  const submissionFrameRef = useRef<HTMLIFrameElement | null>(null);

  const idToken = liff?.getIDToken?.() ?? null;

  const fetchBooking = useCallback(async () => {
    const tok = liff?.getIDToken?.() || "";
    const r = await fetch(`/api/bookings/${bookingId}`, {
      headers: tok ? { "X-LIFF-ID-Token": tok } : {},
    });
    const data = await r.json();
    setBooking(data.booking);
    return data.booking as BookingDetail | null;
  }, [bookingId, liff]);

  // Fetch feature flag + booking + any existing ECPay order in parallel on mount.
  useEffect(() => {
    if (!isReady) return;
    let cancelled = false;

    (async () => {
      try {
        const [cfgRes, b] = await Promise.all([
          fetch(
            liffUserId
              ? `/api/payments/config?lineUserId=${encodeURIComponent(liffUserId)}`
              : "/api/payments/config",
          )
            .then((r) => r.json())
            .catch(() => ({ ecpayEnabled: false })),
          fetchBooking(),
        ]);
        if (cancelled) return;
        setEcpayEnabled(Boolean(cfgRes?.ecpayEnabled));

        // Already submitted bank-transfer last-5? stay on submitted screen.
        if (b?.payment?.status === "VERIFYING" || b?.payment?.status === "RECEIVED") {
          setStage("submitted");
        } else if (b?.payment?.method === "ECPAY_ATM" && b?.payment?.status === "AWAITING_BANK") {
          // Resume an in-flight ECPay order — peek at status to decide which stage.
          try {
            const tok = liff?.getIDToken?.() || "";
            const sRes = await fetch(`/api/payments/${bookingId}/ecpay/status`, {
              headers: tok
                ? { "X-LIFF-ID-Token": tok, Authorization: `Bearer ${tok}` }
                : {},
              cache: "no-store",
            });
            if (sRes.ok && !cancelled) {
              const s = await sRes.json();
              setEcpayAmount(typeof s.amount === "number" ? s.amount : null);
              if (s.vAccount) setStage("ecpay-vaccount");
              else setStage("ecpay-waiting");
            } else if (!cancelled) {
              setStage("ecpay-waiting");
            }
          } catch {
            if (!cancelled) setStage("ecpay-waiting");
          }
        }
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isReady, fetchBooking, bookingId, liff, liffUserId]);

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
      const tok = liff?.getIDToken();
      if (!tok) {
        toast({ message: "請先登入 LINE", type: "error" });
        return;
      }
      const res = await fetch(`/api/payments/${bookingId}/confirm`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tok}`,
          "X-LIFF-ID-Token": tok,
        },
        body: JSON.stringify({ method: "CASH" }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast({ message: data.error || "送出失敗", type: "error" });
        return;
      }
      toast({ message: "已選擇現金付款，到店時直接付款即可", type: "success" });
      // Close LIFF back to the LINE chat — the customer sees the Flex there.
      // Fall back to /my-bookings if closeWindow is unavailable (e.g. external browser).
      setTimeout(() => {
        try {
          liff?.closeWindow();
        } catch {
          router.push("/my-bookings");
        }
      }, 800);
    } catch {
      toast({ message: "送出失敗，請稍後再試", type: "error" });
    }
  };

  /**
   * Submit the ECPay auto-submitting form into a hidden iframe so the page
   * stays put while ECPay processes the order. We don't read the response —
   * our own status endpoint + webhooks drive the UI.
   */
  const submitEcpayForm = (html: string) => {
    // Clean up any previous frame.
    if (submissionFrameRef.current) {
      submissionFrameRef.current.remove();
      submissionFrameRef.current = null;
    }
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.left = "-10000px";
    iframe.style.width = "1px";
    iframe.style.height = "1px";
    iframe.style.border = "0";
    iframe.setAttribute("aria-hidden", "true");
    iframe.name = `ecpay-submit-${Date.now()}`;
    document.body.appendChild(iframe);
    submissionFrameRef.current = iframe;

    const doc = iframe.contentDocument;
    if (!doc) {
      // Extremely unlikely (blocked iframe) — fall back to top-level submit.
      console.warn("ecpay iframe contentDocument unavailable; falling back to top submit");
      const tmp = document.createElement("div");
      tmp.innerHTML = html;
      document.body.appendChild(tmp);
      const form = tmp.querySelector("form");
      form?.submit();
      return;
    }
    doc.open();
    doc.write(html);
    doc.close();
    // The HTML produced by the SDK has its own script tag that calls form.submit().
    // If the SDK ever stops emitting that, submit the first form as a safety net.
    const firstForm = doc.querySelector("form");
    if (firstForm && !firstForm.dataset.submitted) {
      firstForm.dataset.submitted = "1";
      // Give the embedded script a tick to run first; only submit if it didn't.
      setTimeout(() => {
        try {
          firstForm.submit();
        } catch {
          /* noop */
        }
      }, 50);
    }
  };

  // Clean up the submission iframe on unmount.
  useEffect(() => {
    return () => {
      if (submissionFrameRef.current) {
        submissionFrameRef.current.remove();
        submissionFrameRef.current = null;
      }
    };
  }, []);

  const handleEcpayCreate = async () => {
    try {
      setSubmitting(true);
      const tok = liff?.getIDToken();
      if (!tok) {
        toast({ message: "請先登入 LINE", type: "error" });
        return;
      }
      const res = await fetch(`/api/payments/${bookingId}/ecpay/create-order`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tok}`,
          "X-LIFF-ID-Token": tok,
        },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (res.status === 503) {
          toast({ message: "金流服務暫時關閉，請改用其他方式", type: "error" });
        } else {
          toast({ message: data.error || "建立付款失敗", type: "error" });
        }
        return;
      }
      const data = (await res.json()) as { html: string; merchantTradeNo: string; amount: number };
      setEcpayAmount(data.amount);
      submitEcpayForm(data.html);
      setStage("ecpay-waiting");
    } catch {
      toast({ message: "建立付款失敗，請稍後再試", type: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleIvePaid = async () => {
    try {
      const res = await fetch(`/api/payments/${bookingId}/ecpay/status`, {
        headers: idToken
          ? { "X-LIFF-ID-Token": idToken, Authorization: `Bearer ${idToken}` }
          : {},
        cache: "no-store",
      });
      if (!res.ok) {
        toast({ message: "查詢失敗，請稍後再試", type: "error" });
        return;
      }
      const data = await res.json();
      if (data.status === "PAID") {
        toast({ message: "已確認收款，感謝您！", type: "success" });
        setTimeout(() => router.push("/my-bookings"), 800);
      } else {
        toast({
          message: "系統仍在確認中，最多 5 分鐘內會通知您",
          type: "info",
        });
      }
    } catch {
      toast({ message: "查詢失敗，請稍後再試", type: "error" });
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
      const tok = liff?.getIDToken();
      if (!tok) {
        toast({ message: "請先登入 LINE", type: "error" });
        setSubmitting(false);
        return;
      }
      const res = await fetch(`/api/payments/${bookingId}/report-transfer`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-LIFF-ID-Token": tok,
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
      // Close LIFF back to the LINE chat — the customer sees the Flex there.
      setTimeout(() => {
        try {
          liff?.closeWindow();
        } catch {
          /* stay on submitted screen if closeWindow unavailable */
        }
      }, 1200);
    } catch {
      toast({ message: "送出失敗，請稍後再試", type: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  // ECPay polling — only active on waiting/vaccount stages.
  const pollEnabled = stage === "ecpay-waiting" || stage === "ecpay-vaccount";
  const {
    data: ecpayStatus,
    error: ecpayPollError,
    stopped: ecpayPollStopped,
    timedOut: ecpayPollTimedOut,
    refetch: refetchEcpay,
  } = useEcpayStatus(bookingId, {
    enabled: pollEnabled,
    idToken,
  });

  // Promote waiting → vaccount the moment vAccount lands.
  useEffect(() => {
    if (ecpayStatus?.vAccount && stage === "ecpay-waiting") {
      setStage("ecpay-vaccount");
    }
    if (ecpayStatus?.status === "PAID") {
      toast({ message: "已確認收款，感謝您！", type: "success" });
      const t = setTimeout(() => router.push("/my-bookings"), 1200);
      return () => clearTimeout(t);
    }
  }, [ecpayStatus, stage, toast, router]);

  const expireDateDisplay = useMemo(
    () => formatExpireDate(ecpayStatus?.expireDate),
    [ecpayStatus?.expireDate],
  );

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
  const isAwaitingBank = booking.payment?.status === "AWAITING_BANK";
  const dateDisplay = `${formatDate(booking.date)} · ${booking.startTime} — ${booking.endTime}`;

  const bankName = booking.tenant.bankInfo || "（店家尚未設定）";
  const bankHolder = booking.tenant.bankAccountName || "（店家尚未設定）";
  const bankNumber = booking.tenant.bankAccountNumber || "（店家尚未設定）";
  const amountStr = booking.service.price.toLocaleString();
  const bankConfigured = Boolean(
    booking.tenant.bankInfo && booking.tenant.bankAccountName && booking.tenant.bankAccountNumber,
  );

  const statusBadge = isPaid
    ? "已確認"
    : isVerifying
      ? "核對中"
      : isAwaitingBank
        ? "待匯款"
        : "待付款";

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
                {statusBadge}
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
        ) : stage === "ecpay-waiting" ? (
          /* === ECPay: submitted form, waiting for vAccount webhook === */
          <div className="flex flex-col items-center py-10 space-y-5">
            {ecpayPollStopped && ecpayPollTimedOut ? (
              <>
                <p className="text-lg font-bold text-[#003D2B]">系統處理中</p>
                <p className="text-sm text-[#404944]/60 text-center px-6 leading-relaxed">
                  綠界仍在配發專屬帳號，請稍後回到此頁查看，或在 LINE 等待通知。
                </p>
                <a
                  href="/my-bookings"
                  className="mt-2 text-sm font-bold tracking-widest text-[#003D2B] underline underline-offset-4"
                >
                  返回我的預約
                </a>
              </>
            ) : ecpayPollStopped && ecpayPollError ? (
              <>
                <p className="text-lg font-bold text-[#003D2B]">連線不穩</p>
                <p className="text-sm text-[#404944]/60 text-center px-6">
                  暫時無法取得專屬帳號，請重試或回頭改用其他付款方式。
                </p>
                <button
                  onClick={() => {
                    void refetchEcpay();
                  }}
                  className="mt-2 bg-[#003D2B] text-[#FFF8F1] px-6 py-3 font-bold tracking-widest text-sm rounded"
                >
                  重試
                </button>
              </>
            ) : (
              <>
                <div className="w-10 h-10 border-2 border-[#003D2B] border-t-transparent rounded-full animate-spin" />
                <p className="text-lg font-bold text-[#003D2B]">正在產生專屬帳號</p>
                <p className="text-sm text-[#404944]/60 text-center px-6 leading-relaxed">
                  通常 10 秒內完成，請稍候⋯⋯
                </p>
              </>
            )}
          </div>
        ) : stage === "ecpay-vaccount" ? (
          /* === ECPay: show virtual account === */
          <>
            <h3 className="text-sm font-bold tracking-widest text-[#404944]/80 uppercase mt-2 mb-4">
              請匯款至以下帳號
            </h3>

            {ecpayStatus?.vAccount ? (
              <div className="bg-[#faf2ea] rounded-xl p-5 space-y-4">
                <InfoRow
                  label="銀行"
                  value={formatBankLabel(ecpayStatus.bankCode)}
                  onCopy={() => copy(ecpayStatus.bankCode ?? "", "銀行代碼")}
                  disabled={!ecpayStatus.bankCode}
                />
                <InfoRow
                  label="帳號"
                  value={formatAccountNumber(ecpayStatus.vAccount)}
                  mono
                  onCopy={() => copy(ecpayStatus.vAccount ?? "", "帳號")}
                />
                <InfoRow
                  label="金額"
                  value={`NT$${(ecpayStatus.amount ?? ecpayAmount ?? booking.service.price).toLocaleString()}`}
                  onCopy={() =>
                    copy(
                      String(ecpayStatus.amount ?? ecpayAmount ?? booking.service.price),
                      "金額",
                    )
                  }
                />
              </div>
            ) : (
              <div className="bg-[#faf2ea] rounded-xl p-5 text-sm text-[#404944]/60 text-center">
                專屬帳號載入中⋯⋯
              </div>
            )}

            {expireDateDisplay && (
              <p className="text-sm text-[#404944]/80 mt-4 font-medium">
                ⏰ 請在 {expireDateDisplay}完成
              </p>
            )}

            <p className="text-xs text-[#404944]/60 mt-2 leading-relaxed">
              💡 匯款後系統會自動確認，無需回報
            </p>

            <div className="flex gap-3 mt-8">
              <a
                href="/my-bookings"
                className="flex-1 text-center border border-[#003D2B]/20 text-[#003D2B] py-4 font-bold tracking-widest text-sm rounded hover:bg-[#003D2B]/5 transition-colors"
              >
                稍後再匯
              </a>
              <button
                onClick={handleIvePaid}
                className="flex-[2] bg-[#003D2B] text-[#FFF8F1] py-4 font-bold tracking-widest text-sm rounded hover:bg-[#003D2B]/90 transition-colors active:scale-[0.98]"
              >
                我已匯款
              </button>
            </div>
          </>
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

              {ecpayEnabled && (
                <label className="flex items-start gap-4 p-4 cursor-pointer">
                  <input
                    type="radio"
                    name="payment-method"
                    checked={paymentMethod === "ecpay"}
                    onChange={() => setPaymentMethod("ecpay")}
                    className="w-5 h-5 mt-0.5 text-[#003D2B] border-[#707974] focus:ring-0 accent-[#003D2B]"
                  />
                  <div>
                    <p className="font-bold text-[#1e1b17]">
                      ATM 專屬帳號
                      <span className="text-xs text-[#404944]/60 font-medium ml-2">
                        （自動對帳，扣 NT$10）
                      </span>
                    </p>
                    <p className="text-sm text-[#404944]/60 mt-0.5">
                      系統產生專屬帳號，匯款後自動完成對帳
                    </p>
                  </div>
                </label>
              )}
            </div>

            <button
              onClick={() => {
                if (paymentMethod === "cash") {
                  handleCashConfirm();
                } else if (paymentMethod === "transfer") {
                  setStage("info");
                } else {
                  void handleEcpayCreate();
                }
              }}
              disabled={submitting}
              className="w-full bg-[#003D2B] text-[#FFF8F1] py-4 font-bold tracking-widest text-sm rounded mt-10 hover:bg-[#003D2B]/90 transition-colors active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {paymentMethod === "cash"
                ? "確認現金付款"
                : paymentMethod === "transfer"
                  ? "前往轉帳"
                  : submitting
                    ? "建立中..."
                    : "產生專屬帳號"}
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
