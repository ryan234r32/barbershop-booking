"use client";

import { useState, useEffect, use } from "react";
import { useLiff } from "@/lib/liff/provider";
import { useToast } from "@/components/ui/toast";
import { getCancellationPolicy } from "@/lib/booking/cancellation";
import { LoadingScreen } from "@/components/liff/loading-screen";
import { IconArrowBack, IconClose } from "@/components/liff/icons";

interface BookingDetail {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  service: { name: string; price: number };
  tenant: { businessName: string; phone: string | null };
  user: { violationCount: number };
}

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}/${d.getDate()} (${WEEKDAYS[d.getDay()]})`;
}

type CancelState = "loading" | "confirm" | "phone-required" | "cancelled" | "error";

export default function CancelPage({
  params,
}: {
  params: Promise<{ bookingId: string }>;
}) {
  const { bookingId } = use(params);
  const { isReady, liff } = useLiff();
  const { toast } = useToast();
  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [state, setState] = useState<CancelState>("loading");
  const [cancelling, setCancelling] = useState(false);
  const [policy, setPolicy] = useState<{
    canCancelOnline: boolean;
    isViolation: boolean;
    reason: string;
    phoneNumber?: string;
  } | null>(null);

  useEffect(() => {
    if (!isReady) return;

    fetch(`/api/bookings/${bookingId}`)
      .then((r) => r.json())
      .then((data) => {
        if (!data.booking) {
          setState("error");
          return;
        }

        const b = data.booking;
        setBooking(b);

        // Calculate cancellation policy on the client side
        const bookingDate = new Date(b.date);
        const p = getCancellationPolicy({
          bookingDate,
          bookingTime: b.startTime,
          shopPhone: b.tenant.phone || undefined,
        });
        setPolicy(p);
        setState(p.canCancelOnline ? "confirm" : "phone-required");
      })
      .catch(() => setState("error"));
  }, [isReady, bookingId]);

  const handleCancel = async () => {
    setCancelling(true);
    try {
      const idToken = liff?.getIDToken?.() || "";
      const res = await fetch(`/api/bookings/${bookingId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(idToken ? { "X-LIFF-ID-Token": idToken } : {}),
        },
        body: JSON.stringify({ action: "cancel" }),
      });

      if (!res.ok) {
        const data = await res.json();
        if (data.phoneNumber) {
          // Backend also says must call — switch to phone-required state
          setPolicy({
            canCancelOnline: false,
            isViolation: false,
            reason: data.error,
            phoneNumber: data.phoneNumber,
          });
          setState("phone-required");
        } else {
          toast({ message: data.error || "取消失敗", type: "error" });
        }
        return;
      }

      setState("cancelled");
    } catch {
      toast({ message: "網路錯誤，請稍後再試", type: "error" });
    } finally {
      setCancelling(false);
    }
  };

  const liffBaseUrl = typeof window !== "undefined"
    ? `https://liff.line.me/${process.env.NEXT_PUBLIC_LIFF_ID}`
    : "";

  // --- Loading ---
  if (state === "loading" || !isReady) {
    return <LoadingScreen message="載入預約資訊..." />;
  }

  // --- Error ---
  if (state === "error" || !booking) {
    return (
      <div className="min-h-screen bg-[#FFF8F1] flex items-center justify-center p-6" style={{ fontFamily: "'Manrope', 'Noto Sans TC', sans-serif" }}>
        <p className="text-[#A84A3B] text-sm">找不到預約</p>
      </div>
    );
  }

  const dateDisplay = `${formatDate(booking.date)} · ${booking.startTime} — ${booking.endTime}`;

  // --- Cancelled Success ---
  if (state === "cancelled") {
    return (
      <div className="min-h-screen bg-[#FFF8F1] flex flex-col items-center justify-center px-6" style={{ fontFamily: "'Manrope', 'Noto Sans TC', sans-serif" }}>
        <div className="max-w-sm w-full flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-full border-2 border-[#003D2B] flex items-center justify-center mb-6">
            <svg className="w-8 h-8 text-[#003D2B]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>

          <h1 className="text-2xl font-bold text-[#003D2B] tracking-tight mb-2">預約已取消</h1>
          <p className="text-sm text-[#003D2B]/50 mb-10">
            {formatDate(booking.date)} {booking.startTime} 的{booking.service.name}已取消
          </p>

          {/* Rebook suggestion card */}
          <div className="w-full bg-[#F3ECE4] rounded-xl p-6 text-center mb-6">
            <p className="text-[#003D2B] font-semibold mb-1">想要重新預約嗎？</p>
            <p className="text-sm text-[#003D2B]/50 mb-4">我們隨時歡迎您</p>
            <a
              href={`${liffBaseUrl}/booking`}
              className="block w-full py-3 bg-[#003D2B] text-[#FFF8F1] font-bold text-sm tracking-wide rounded-lg"
            >
              重新預約
            </a>
          </div>

          <button
            onClick={() => liff?.closeWindow()}
            className="text-sm text-[#003D2B]/50 underline underline-offset-2"
          >
            返回 LINE
          </button>
        </div>
      </div>
    );
  }

  // --- Confirm / Phone Required ---
  return (
    <div className="min-h-screen bg-[#FFF8F1]" style={{ fontFamily: "'Manrope', 'Noto Sans TC', sans-serif" }}>
      {/* Fixed header */}
      <header className="fixed top-0 w-full z-50 bg-[#FFF8F1]/80 backdrop-blur-xl">
        <div className="flex items-center justify-between px-6 h-14">
          <a
            href={`${liffBaseUrl}/my-bookings`}
            className="flex items-center gap-1 text-sm text-[#003D2B] font-medium"
          >
            <IconArrowBack className="w-5 h-5" />
            返回
          </a>
          <span className="text-sm font-bold text-[#003D2B] tracking-tight">服務項目</span>
          <button
            onClick={() => liff?.closeWindow()}
            className="w-10 h-10 flex items-center justify-center"
          >
            <IconClose className="w-5 h-5 text-[#003D2B]" />
          </button>
        </div>
      </header>

      <main className="pt-20 pb-12 px-6 max-w-md mx-auto flex flex-col gap-8">
        {/* Page title */}
        <section>
          <h1 className="text-2xl font-bold text-[#003D2B] tracking-tight">預約詳情</h1>
          <p className="text-sm text-[#404944]/60 mt-1">確認或調整您的預約時間</p>
        </section>

        {/* Booking summary card */}
        <div className="bg-[#F9F2EC] rounded-xl p-6 flex flex-col gap-4">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-xl font-bold text-[#003D2B]">{booking.service.name}</h2>
              <p className="text-sm text-[#404944]/60 font-medium mt-0.5">
                {booking.tenant.businessName}
              </p>
            </div>
            <span className="bg-[#003D2B] text-[#FFF8F1] px-3 py-1 rounded-full text-[10px] font-semibold tracking-wide">
              即將到來
            </span>
          </div>
          <div className="flex items-center gap-3 text-[#404944]/70 text-sm">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <path d="M16 2v4M8 2v4M3 10h18" />
            </svg>
            {dateDisplay}
          </div>
          <div className="flex items-center justify-between pt-4 border-t border-[#c0c9c2]/20">
            <span className="text-sm text-[#404944]/60">應付金額</span>
            <span className="text-lg font-bold text-[#003D2B]">
              NT${booking.service.price.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Reschedule suggestion — always shown, most prominent */}
        <section className="flex flex-col gap-4 border-l-[3px] border-[#003D2B] pl-5">
          <div>
            <h3 className="text-lg font-bold text-[#003D2B]">改到其他時間？</h3>
            <p className="text-sm text-[#404944]/60 mt-0.5">不用取消，直接選新時段就好</p>
          </div>
          <a
            href={`${liffBaseUrl}/reschedule/${bookingId}`}
            className="w-full h-12 bg-[#003D2B] text-[#FFF8F1] rounded-lg font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <path d="M16 2v4M8 2v4M3 10h18" />
              <path d="M14 15l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            選擇新時段
          </a>
        </section>

        {/* Divider */}
        <div className="relative flex items-center py-2">
          <div className="flex-grow border-t border-[#c0c9c2]/30" />
          <span className="mx-4 text-xs font-bold text-[#707974] uppercase tracking-widest bg-[#eee7e0] w-8 h-8 rounded-full flex items-center justify-center">
            或
          </span>
          <div className="flex-grow border-t border-[#c0c9c2]/30" />
        </div>

        {/* Cancel section */}
        <section className="flex flex-col gap-5">
          <h3 className="text-lg font-bold text-[#003D2B]">取消預約</h3>

          {state === "confirm" && policy && (
            <>
              {/* Can cancel online */}
              <div className="bg-[#4A7C59]/10 rounded-lg p-4 flex gap-3 items-start">
                <svg className="w-5 h-5 text-[#4A7C59] mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01" />
                  <circle cx="12" cy="12" r="10" />
                </svg>
                <p className="text-sm text-[#4A7C59] font-medium leading-relaxed">
                  {policy.reason}
                </p>
              </div>

              <button
                onClick={handleCancel}
                disabled={cancelling}
                className="w-full h-12 bg-transparent border-[1.5px] border-[#A84A3B] text-[#A84A3B] rounded-lg font-bold text-sm active:bg-[#A84A3B]/5 transition-colors disabled:opacity-50"
              >
                {cancelling ? "取消中..." : "確認取消預約"}
              </button>
            </>
          )}

          {state === "phone-required" && policy && (
            <>
              {/* Must call */}
              <div className="bg-[#C88B3B]/10 rounded-lg p-4 flex gap-3 items-start">
                <svg className="w-5 h-5 text-[#C88B3B] mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                <p className="text-sm text-[#C88B3B] font-medium leading-relaxed">
                  {policy.reason}
                </p>
              </div>

              {policy.phoneNumber && (
                <a
                  href={`tel:${policy.phoneNumber}`}
                  className="flex items-center justify-center gap-3 py-4"
                >
                  <svg className="w-6 h-6 text-[#003D2B]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  <span className="text-xl font-bold text-[#003D2B]">{policy.phoneNumber}</span>
                </a>
              )}

              <p className="text-xs text-[#003D2B]/40 text-center">
                營業時間 11:00 — 20:00
              </p>

              <div className="bg-[#F3ECE4] rounded-lg p-4 mt-2">
                <p className="text-xs text-[#003D2B]/50 leading-relaxed">
                  24 小時內未到店且未致電取消，將記錄為一次違規
                  （目前 {booking.user?.violationCount ?? 0}/3 次）
                </p>
              </div>
            </>
          )}
        </section>

        {/* Bottom link */}
        <div className="text-center pt-4">
          <a
            href={`${liffBaseUrl}/my-bookings`}
            className="text-sm text-[#003D2B]/50 underline underline-offset-2"
          >
            返回我的預約
          </a>
        </div>
      </main>
    </div>
  );
}
