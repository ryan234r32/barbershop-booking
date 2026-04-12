"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useLiff } from "@/lib/liff/provider";
import { useToast } from "@/components/ui/toast";
import { ServiceStep } from "@/components/liff/booking/service-step";
import { CalendarStep } from "@/components/liff/booking/calendar-step";
import { ConfirmStep } from "@/components/liff/booking/confirm-step";
import { SuccessStep } from "@/components/liff/booking/success-step";
import { CancelPolicySheet } from "@/components/liff/booking/cancel-policy-sheet";
import { LoadingScreen } from "@/components/liff/loading-screen";

interface Service {
  id: string;
  name: string;
  description: string | null;
  duration: number;
  slotsNeeded: number;
  price: number;
}

interface AvailableSlot {
  time: string;
  available: boolean;
  recommended: boolean;
}

type BookingStep = "service" | "calendar" | "confirm" | "success";

export default function BookingPage() {
  const { isReady, error, userId } = useLiff();
  const { toast } = useToast();
  const [step, setStep] = useState<BookingStep>("service");
  const [services, setServices] = useState<Service[]>([]);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [availableSlots, setAvailableSlots] = useState<AvailableSlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [bookingResult, setBookingResult] = useState<{ id: string } | null>(null);
  const [notes, setNotes] = useState("");
  const [showCancelPolicy, setShowCancelPolicy] = useState(false);

  // Load services
  useEffect(() => {
    if (!isReady) return;
    fetch("/api/services")
      .then((r) => r.json())
      .then((data) => setServices(data.services))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [isReady]);

  // Load available slots when date + service selected
  const loadSlots = useCallback(async (date: string, serviceId: string) => {
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
  }, []);

  const handleDateSelect = (date: string) => {
    setSelectedDate(date);
    setSelectedTime("");
    if (selectedService) {
      loadSlots(date, selectedService.id);
    }
  };

  const handleTimeSelect = (time: string) => {
    setSelectedTime(time);
  };

  const handleServiceSelect = (service: Service) => {
    setSelectedService(service);
    // If re-selecting same service, stay on step; otherwise reset date/time
    if (selectedService?.id !== service.id) {
      setSelectedDate("");
      setSelectedTime("");
      setAvailableSlots([]);
    }
  };

  const handleSubmit = async () => {
    if (!selectedService || !selectedDate || !selectedTime || !userId) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceId: selectedService.id,
          date: selectedDate,
          startTime: selectedTime,
          lineUserId: userId,
          notes: notes || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast({ type: "error", message: data.error || "預約失敗，請稍後再試" });
        return;
      }

      setBookingResult(data.booking);
      setStep("success");
    } catch {
      toast({ type: "error", message: "網路錯誤，請稍後再試" });
    } finally {
      setSubmitting(false);
    }
  };

  // Determine if the "Next" button should be enabled
  const canProceed = (() => {
    switch (step) {
      case "service":
        return !!selectedService;
      case "calendar":
        return !!selectedDate && !!selectedTime;
      case "confirm":
        return !submitting;
      default:
        return false;
    }
  })();

  const handleNext = () => {
    switch (step) {
      case "service":
        if (selectedService) setStep("calendar");
        break;
      case "calendar":
        if (selectedDate && selectedTime) setStep("confirm");
        break;
      case "confirm":
        handleSubmit();
        break;
    }
  };

  const handleBack = () => {
    switch (step) {
      case "calendar":
        setStep("service");
        break;
      case "confirm":
        setStep("calendar");
        break;
    }
  };

  // Step number for the bottom bar label
  const stepLabel = (() => {
    switch (step) {
      case "service":
        return "下一步：選擇日期與時段";
      case "calendar":
        return "下一步：備註與確認";
      case "confirm":
        return submitting ? "預約中..." : "確認預約";
      default:
        return "";
    }
  })();

  if (!isReady) {
    return <LoadingScreen />;
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="text-center max-w-xs mx-auto">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-50">
            <svg className="h-7 w-7 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <p className="text-lg font-semibold text-gray-900 mb-2">請在 LINE 中開啟</p>
          <p className="text-gray-500 text-sm mb-6">此預約系統需要透過 LINE 開啟才能使用</p>
          <p className="text-gray-400 text-xs mb-4 break-all">({error})</p>
          <button
            onClick={() => window.location.reload()}
            className="block w-full rounded-xl bg-[#003D2B] px-6 py-2.5 text-sm font-medium text-[#FFF8F1] transition hover:opacity-90 mb-2"
          >
            重新載入
          </button>
          <Link
            href="/"
            className="block rounded-xl border border-[#003D2B]/20 px-6 py-2.5 text-sm font-medium text-[#003D2B] transition hover:bg-[#003D2B]/5"
          >
            回到首頁
          </Link>
          <p className="mt-6 text-sm text-[#003D2B]/50">
            或致電預約：<a href="tel:02-2396-2306" className="text-[#003D2B] underline">02-2396-2306</a>
          </p>
        </div>
      </div>
    );
  }

  if (loading && step === "service") {
    return <LoadingScreen message="載入服務項目..." />;
  }

  // Success step — full page, no bottom bar
  if (step === "success" && bookingResult && selectedService) {
    return (
      <div className="max-w-md mx-auto px-6">
        <SuccessStep
          bookingId={bookingResult.id}
          service={selectedService}
          date={selectedDate}
          time={selectedTime}
        />
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto min-h-screen flex flex-col bg-[#FFF8F1]">
      {/* Progress indicator */}
      <div className="px-6 pt-6 pb-2">
        <div className="flex items-center gap-2">
          {(["service", "calendar", "confirm"] as const).map((s, i) => (
            <div key={s} className="flex-1">
              <div
                className={`h-[2px] rounded-full transition-all duration-300 ${
                  (["service", "calendar", "confirm"] as const).indexOf(step as "service" | "calendar" | "confirm") >= i
                    ? "bg-[#003D2B]"
                    : "bg-[#003D2B]/10"
                }`}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Step content */}
      <div className="flex-1 px-6 pt-6 pb-32">
        <div key={step} className="animate-fadeIn">
          {step === "service" && (
            <ServiceStep
              services={services}
              selectedService={selectedService}
              onSelect={handleServiceSelect}
            />
          )}

          {step === "calendar" && selectedService && (
            <CalendarStep
              selectedDate={selectedDate}
              selectedTime={selectedTime}
              availableSlots={availableSlots}
              slotsLoading={slotsLoading}
              serviceDuration={selectedService.duration}
              serviceSlotsNeeded={selectedService.slotsNeeded}
              onDateSelect={handleDateSelect}
              onTimeSelect={handleTimeSelect}
            />
          )}

          {step === "confirm" && selectedService && (
            <ConfirmStep
              service={selectedService}
              date={selectedDate}
              time={selectedTime}
              notes={notes}
              onNotesChange={setNotes}
              onConfirm={handleSubmit}
              onBack={handleBack}
              submitting={submitting}
              onShowCancelPolicy={() => setShowCancelPolicy(true)}
            />
          )}
        </div>
      </div>

      {/* Sticky bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#FFF8F1] border-t border-[#003D2B]/5 px-6 py-4 z-50">
        <div className="max-w-md mx-auto flex items-center gap-3">
          {step !== "service" && (
            <button
              onClick={handleBack}
              className="w-12 h-12 flex items-center justify-center border-[1.5px] border-[#003D2B] rounded-xl text-[#003D2B] shrink-0 transition-colors hover:bg-[#003D2B]/5"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
                arrow_back
              </span>
            </button>
          )}
          <button
            onClick={handleNext}
            disabled={!canProceed}
            className={`
              flex-1 h-12 rounded-xl font-bold text-sm tracking-wide transition-all duration-200
              ${
                canProceed
                  ? "bg-[#003D2B] text-[#FFF8F1] shadow-lg shadow-[#003D2B]/20 hover:bg-[#003D2B]/90"
                  : "bg-[#003D2B]/10 text-[#003D2B]/30 cursor-not-allowed"
              }
            `}
          >
            {stepLabel}
          </button>
        </div>
      </div>

      {/* Cancel Policy Sheet */}
      <CancelPolicySheet
        isOpen={showCancelPolicy}
        onClose={() => setShowCancelPolicy(false)}
      />
    </div>
  );
}
