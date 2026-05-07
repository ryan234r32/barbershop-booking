"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useLiff } from "@/lib/liff/provider";
import { useToast } from "@/components/ui/toast";
import { ServiceStep } from "@/components/liff/booking/service-step";
import { CalendarStep } from "@/components/liff/booking/calendar-step";
import { ConfirmStep } from "@/components/liff/booking/confirm-step";
import { SuccessStep } from "@/components/liff/booking/success-step";
import { UserInfoSheet } from "@/components/liff/booking/user-info-sheet";
import { LoadingScreen } from "@/components/liff/loading-screen";
import { IconArrowBack, IconClose } from "@/components/liff/icons";
import { Modal } from "@/components/ui/modal";
import { useBusinessConfig } from "@/lib/hooks/use-business-config";

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
  const { liff, isReady, error, userId, displayName, realName, phone, birthday } = useLiff();
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
  const [policyAgreed, setPolicyAgreed] = useState(false);
  const [showUserInfoSheet, setShowUserInfoSheet] = useState(false);
  const [userInfo, setUserInfo] = useState<{ name: string; phone: string; birthday?: string; gender?: "MALE" | "FEMALE" | "OTHER" | "PREFER_NOT_TO_SAY" } | null>(null);
  // Slot-conflict UX: when two clients race for the same slot and we lose,
  // server returns code=SLOT_UNAVAILABLE. Show a blocking modal, bounce back
  // to calendar, and refresh availability so the taken slot greys out.
  const [slotConflictOpen, setSlotConflictOpen] = useState(false);

  // 公休 / 預約窗口設定（從 /api/business-config 讀，取代寫死的 30 天 + 週一）
  const { config: businessConfig } = useBusinessConfig();

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

  const handleSubmit = async (infoOverride?: { name: string; phone: string; birthday?: string; gender?: "MALE" | "FEMALE" | "OTHER" | "PREFER_NOT_TO_SAY" }) => {
    if (!selectedService || !selectedDate || !selectedTime || !userId) return;

    const info = infoOverride || userInfo;

    setSubmitting(true);
    try {
      // Get LIFF ID token so the server can verify the caller's identity.
      // If missing (unlikely in the LINE app), the server will reject with 401.
      const idToken = liff?.getIDToken?.() || "";
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(idToken ? { "X-LIFF-ID-Token": idToken } : {}),
        },
        body: JSON.stringify({
          serviceId: selectedService.id,
          date: selectedDate,
          startTime: selectedTime,
          notes: notes || undefined,
          realName: info?.name,
          phone: info?.phone,
          birthday: info?.birthday,
          gender: info?.gender,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.code === "SLOT_UNAVAILABLE") {
          // Race lost — bounce back to calendar so they pick again, refresh
          // availability so the just-taken slot disappears, and show a
          // blocking modal so the user definitely sees what happened.
          setSelectedTime("");
          if (selectedService && selectedDate) {
            loadSlots(selectedDate, selectedService.id);
          }
          setStep("calendar");
          setSlotConflictOpen(true);
          return;
        }
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
        return policyAgreed && !submitting;
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
        // If user already has all three: realName + phone + birthday, skip the info sheet
        if (phone && realName && birthday) {
          setUserInfo({ name: realName, phone });
          handleSubmit({ name: realName, phone });
        } else {
          setShowUserInfoSheet(true);
        }
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
      {/* Sticky header */}
      <header className="sticky top-0 z-50 glassmorphic border-b-[1.5px] border-[#003D2B]/10">
        <div className="flex items-center justify-between px-6 h-14">
          {step !== "service" ? (
            <button
              onClick={handleBack}
              className="flex items-center gap-1 text-[#003D2B] text-sm font-medium"
            >
              <IconArrowBack className="w-5 h-5" />
              返回
            </button>
          ) : (
            <span className="text-[#003D2B] text-sm font-bold tracking-widest uppercase">
              1008 Hair Studio
            </span>
          )}
          <button
            onClick={() => liff?.closeWindow()}
            className="w-10 h-10 flex items-center justify-center text-[#003D2B] hover:opacity-70 transition-opacity"
          >
            <IconClose className="w-5 h-5" />
          </button>
        </div>
        {/* Progress indicator */}
        <div className="px-6 pb-1.5">
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
      </header>

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
              closedWeekdays={businessConfig.closedWeekdays}
              holidays={businessConfig.holidays.map((h) => h.date)}
              maxAdvanceDays={businessConfig.maxAdvanceDays}
            />
          )}

          {step === "confirm" && selectedService && (
            <ConfirmStep
              notes={notes}
              onNotesChange={setNotes}
              policyAgreed={policyAgreed}
              onPolicyAgreedChange={setPolicyAgreed}
              serviceName={selectedService.name}
              date={selectedDate}
              startTime={selectedTime}
              price={selectedService.price}
            />
          )}
        </div>
      </div>

      {/* Sticky bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#FFF8F1] border-t border-[#003D2B]/5 px-6 py-4 z-50">
        <div className="max-w-md mx-auto">
          <button
            onClick={handleNext}
            disabled={!canProceed}
            className={`
              w-full h-12 rounded-lg font-bold text-sm tracking-wide transition-all duration-200
              ${
                canProceed
                  ? "bg-[#003D2B] text-[#FFF8F1] shadow-lg shadow-[#003D2B]/20 hover:bg-[#003D2B]/90 active:scale-[0.98]"
                  : "bg-[#003D2B]/10 text-[#003D2B]/30 cursor-not-allowed"
              }
            `}
          >
            {stepLabel}
          </button>
        </div>
      </div>

      {/* User info collection sheet */}
      <UserInfoSheet
        isOpen={showUserInfoSheet}
        onClose={() => setShowUserInfoSheet(false)}
        onSubmit={(data) => {
          setUserInfo(data);
          setShowUserInfoSheet(false);
          handleSubmit(data);
        }}
        defaultName={displayName || ""}
        defaultPhone=""
      />

      {/* Slot conflict modal — fires when another customer wins the race */}
      <Modal
        isOpen={slotConflictOpen}
        title="時段剛被預約走了 😅"
      >
        <p className="text-sm text-[#003D2B]/80 leading-relaxed mb-6">
          您選的時段在剛剛被另一位客人搶先預約了。
          <br />
          請重新選擇其他時段，造成不便請見諒 🙇
        </p>
        <button
          onClick={() => setSlotConflictOpen(false)}
          className="w-full h-12 rounded-lg bg-[#003D2B] text-[#FFF8F1] font-bold text-sm tracking-wide active:scale-[0.98] transition-transform"
        >
          我知道了，重新選時段
        </button>
      </Modal>
    </div>
  );
}
