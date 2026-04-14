"use client";

import { useState, useEffect, useCallback, use } from "react";
import { useLiff } from "@/lib/liff/provider";
import { useToast } from "@/components/ui/toast";
import { CalendarStep } from "@/components/liff/booking/calendar-step";
import { LoadingScreen } from "@/components/liff/loading-screen";
import { IconArrowBack, IconClose } from "@/components/liff/icons";

interface BookingDetail {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  service: {
    id: string;
    name: string;
    duration: number;
    slotsNeeded: number;
    price: number;
  };
  tenant: { businessName: string };
}

interface AvailableSlot {
  time: string;
  available: boolean;
  recommended: boolean;
}

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}/${d.getDate()} (${WEEKDAYS[d.getDay()]})`;
}

export default function ReschedulePage({
  params,
}: {
  params: Promise<{ bookingId: string }>;
}) {
  const { bookingId } = use(params);
  const { isReady, liff } = useLiff();
  const { toast } = useToast();
  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [availableSlots, setAvailableSlots] = useState<AvailableSlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [violationAccepted, setViolationAccepted] = useState(false);

  useEffect(() => {
    if (!isReady) return;
    const idToken = liff?.getIDToken?.() || "";
    fetch(`/api/bookings/${bookingId}`, {
      headers: idToken ? { "X-LIFF-ID-Token": idToken } : {},
    })
      .then((r) => r.json())
      .then((data) => setBooking(data.booking || null))
      .catch(() => setBooking(null))
      .finally(() => setLoading(false));
  }, [isReady, bookingId, liff]);

  const loadSlots = useCallback(
    async (date: string, serviceId: string) => {
      setSlotsLoading(true);
      try {
        const res = await fetch(`/api/slots?date=${date}&serviceId=${serviceId}`);
        const data = await res.json();
        setAvailableSlots(
          (data.slots || []).map((s: { startTime: string; isRecommended: boolean }) => ({
            time: s.startTime,
            available: true,
            recommended: s.isRecommended,
          }))
        );
      } catch {
        setAvailableSlots([]);
      } finally {
        setSlotsLoading(false);
      }
    },
    []
  );

  const handleDateSelect = (date: string) => {
    setSelectedDate(date);
    setSelectedTime("");
    if (booking) {
      loadSlots(date, booking.service.id);
    }
  };

  const handleSubmit = async () => {
    if (!booking || !selectedDate || !selectedTime) return;
    setSubmitting(true);
    try {
      const idToken = liff?.getIDToken?.() || "";
      const res = await fetch(`/api/bookings/${bookingId}/reschedule`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(idToken ? { "X-LIFF-ID-Token": idToken } : {}),
        },
        body: JSON.stringify({ date: selectedDate, startTime: selectedTime }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast({ type: "error", message: data.error || "改期失敗" });
        return;
      }

      setSuccess(true);
    } catch {
      toast({ type: "error", message: "網路錯誤，請稍後再試" });
    } finally {
      setSubmitting(false);
    }
  };

  const liffBaseUrl = typeof window !== "undefined"
    ? `https://liff.line.me/${process.env.NEXT_PUBLIC_LIFF_ID}`
    : "";

  if (!isReady || loading) return <LoadingScreen message="載入預約資訊..." />;

  if (!booking) {
    return (
      <div className="min-h-screen bg-[#FFF8F1] flex items-center justify-center">
        <p className="text-[#A84A3B] text-sm">找不到預約</p>
      </div>
    );
  }

  const oldDateDisplay = `${formatDate(booking.date)} · ${booking.startTime} — ${booking.endTime}`;

  // < 2h reschedule → counts as a violation; force explicit consent.
  const bookingDateStr = new Date(booking.date).toLocaleDateString("en-CA", { timeZone: "Asia/Taipei" });
  const [bY, bM, bD] = bookingDateStr.split("-").map(Number);
  const [bH] = booking.startTime.split(":").map(Number);
  const appointmentTs = Date.UTC(bY, bM - 1, bD, bH - 8, 0, 0);
  const hoursUntilAppt = (appointmentTs - Date.now()) / (1000 * 60 * 60);
  const isVeryLate = hoursUntilAppt > 0 && hoursUntilAppt < 2;
  const submitDisabled =
    !selectedDate || !selectedTime || submitting || (isVeryLate && !violationAccepted);

  // Success state
  if (success) {
    return (
      <div className="min-h-screen bg-[#FFF8F1] flex flex-col items-center justify-center px-6" style={{ fontFamily: "'Manrope', 'Noto Sans TC', sans-serif" }}>
        <div className="max-w-sm w-full flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-full border-2 border-[#003D2B] flex items-center justify-center mb-6">
            <svg className="w-8 h-8 text-[#003D2B]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-[#003D2B] tracking-tight mb-2">改期成功</h1>
          <p className="text-sm text-[#003D2B]/50 mb-8">
            已改期到 {formatDate(selectedDate)} {selectedTime}
          </p>

          <div className="w-full bg-[#F3ECE4] rounded-xl p-5 mb-6">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-[#003D2B]/50">原時段</span>
              <span className="text-[#003D2B]/50 line-through">{formatDate(booking.date)} {booking.startTime}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-[#003D2B]/50">新時段</span>
              <span className="text-[#003D2B] font-bold">{formatDate(selectedDate)} {selectedTime}</span>
            </div>
          </div>

          <a
            href={`${liffBaseUrl}/my-bookings`}
            className="block w-full py-3 bg-[#003D2B] text-[#FFF8F1] font-bold text-sm tracking-wide rounded-lg text-center mb-4"
          >
            查看我的預約
          </a>
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

  return (
    <div className="min-h-screen bg-[#FFF8F1] flex flex-col" style={{ fontFamily: "'Manrope', 'Noto Sans TC', sans-serif" }}>
      {/* Header */}
      <header className="fixed top-0 w-full z-50 bg-[#FFF8F1]/80 backdrop-blur-xl">
        <div className="flex items-center justify-between px-6 h-14">
          <a
            href={`${liffBaseUrl}/my-bookings`}
            className="flex items-center gap-1 text-sm text-[#003D2B] font-medium"
          >
            <IconArrowBack className="w-5 h-5" />
            返回
          </a>
          <span className="text-sm font-bold text-[#003D2B] tracking-tight">Reschedule</span>
          <button onClick={() => liff?.closeWindow()} className="w-10 h-10 flex items-center justify-center">
            <IconClose className="w-5 h-5 text-[#003D2B]" />
          </button>
        </div>
      </header>

      {/* Current booking banner */}
      <div className="fixed top-14 w-full z-40 bg-[#F3ECE4] px-6 py-3 flex items-center justify-between">
        <div>
          <p className="text-[10px] text-[#003D2B]/40 font-bold uppercase tracking-widest">目前預約</p>
          <p className="text-sm font-semibold text-[#003D2B] mt-0.5">{oldDateDisplay}</p>
        </div>
        <span className="text-xs border border-[#003D2B]/20 text-[#003D2B] px-2 py-1 rounded">
          {booking.service.name}
        </span>
      </div>

      {/* Main content */}
      <main className="flex-1 pt-[7.5rem] pb-28 px-6 max-w-md mx-auto w-full">
        {isVeryLate && (
          <div className="mb-6 rounded-xl bg-[#FDEEEF] border border-[#A84A3B]/30 p-4">
            <p className="text-sm font-bold text-[#93000A] mb-1">
              2 小時內改期將計違規一次
            </p>
            <p className="text-xs text-[#404944] leading-relaxed mb-3">
              根據取消政策，預約 2 小時內的線上改期會自動記錄違規一次。請於下方勾選同意後才能送出。
            </p>
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={violationAccepted}
                onChange={(e) => setViolationAccepted(e.target.checked)}
                className="w-4 h-4 accent-[#A84A3B] mt-0.5 shrink-0"
              />
              <span className="text-xs text-[#003D2B] leading-relaxed">
                我了解並同意此次改期將計違規一次
              </span>
            </label>
          </div>
        )}

        <CalendarStep
          selectedDate={selectedDate}
          selectedTime={selectedTime}
          availableSlots={availableSlots}
          slotsLoading={slotsLoading}
          serviceDuration={booking.service.duration}
          serviceSlotsNeeded={booking.service.slotsNeeded}
          onDateSelect={handleDateSelect}
          onTimeSelect={setSelectedTime}
        />

        {/* Old → New comparison */}
        {selectedDate && selectedTime && (
          <div className="mt-8 bg-[#FFF8F1] border-[1.5px] border-[#003D2B] rounded-xl p-5">
            <div className="flex justify-between text-sm mb-3">
              <span className="text-[#003D2B]/50">原時段</span>
              <span className="text-[#003D2B]/50 line-through">
                {formatDate(booking.date)} {booking.startTime}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-[#003D2B]/50">新時段</span>
              <span className="text-[#003D2B] font-bold">
                {formatDate(selectedDate)} {selectedTime}
              </span>
            </div>
          </div>
        )}
      </main>

      {/* Sticky bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#FFF8F1] border-t border-[#003D2B]/5 px-6 py-4 z-50">
        <div className="max-w-md mx-auto">
          <button
            onClick={handleSubmit}
            disabled={submitDisabled}
            className={`w-full h-12 rounded-lg font-bold text-sm tracking-wide transition-all duration-200 ${
              !submitDisabled
                ? "bg-[#003D2B] text-[#FFF8F1] active:scale-[0.98]"
                : "bg-[#003D2B]/10 text-[#003D2B]/30 cursor-not-allowed"
            }`}
          >
            {submitting
              ? "改期中..."
              : isVeryLate && selectedDate && selectedTime && !violationAccepted
                ? "請先勾選同意違規條款"
                : selectedDate && selectedTime
                  ? `確認改期到 ${formatDate(selectedDate)} ${selectedTime} →`
                  : "選擇新的日期與時段"}
          </button>
        </div>
      </div>
    </div>
  );
}
