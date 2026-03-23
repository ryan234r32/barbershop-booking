"use client";

import { useState, useEffect, useCallback } from "react";
import { useLiff } from "@/lib/liff/provider";
import { ServiceStep } from "@/components/liff/booking/service-step";
import { CalendarStep } from "@/components/liff/booking/calendar-step";
import { TimeStep } from "@/components/liff/booking/time-step";
import { ConfirmStep } from "@/components/liff/booking/confirm-step";
import { SuccessStep } from "@/components/liff/booking/success-step";
import { LoadingSpinner } from "@/components/liff/loading-spinner";

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

type BookingStep = "service" | "date" | "time" | "confirm" | "success";

export default function BookingPage() {
  const { isReady, error, userId } = useLiff();
  const [step, setStep] = useState<BookingStep>("service");
  const [services, setServices] = useState<Service[]>([]);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [availableSlots, setAvailableSlots] = useState<AvailableSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [bookingResult, setBookingResult] = useState<{ id: string } | null>(null);
  const [notes, setNotes] = useState("");

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
    setLoading(true);
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
      setLoading(false);
    }
  }, []);

  const handleDateSelect = (date: string) => {
    setSelectedDate(date);
    setSelectedTime("");
    if (selectedService) {
      loadSlots(date, selectedService.id);
    }
    setStep("time");
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
        alert(data.error || "預約失敗，請稍後再試");
        return;
      }

      setBookingResult(data.booking);
      setStep("success");
    } catch {
      alert("網路錯誤，請稍後再試");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isReady) {
    return <LoadingSpinner message="正在連接 LINE..." />;
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="text-center">
          <p className="text-red-500 text-lg mb-2">連線失敗</p>
          <p className="text-gray-500 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (loading && step === "service") {
    return <LoadingSpinner message="載入服務項目..." />;
  }

  return (
    <div className="max-w-md mx-auto">
      {/* Progress bar */}
      <div className="sticky top-0 bg-white z-10 px-4 pt-4 pb-2 border-b">
        <div className="flex items-center gap-2 mb-2">
          {["service", "date", "time", "confirm"].map((s, i) => (
            <div key={s} className="flex items-center gap-2 flex-1">
              <div
                className={`h-1 flex-1 rounded ${
                  ["service", "date", "time", "confirm"].indexOf(step) >= i
                    ? "bg-emerald-500"
                    : "bg-gray-200"
                }`}
              />
            </div>
          ))}
        </div>
        <p className="text-sm text-gray-500 text-center">
          {step === "service" && "選擇服務"}
          {step === "date" && "選擇日期"}
          {step === "time" && "選擇時段"}
          {step === "confirm" && "確認預約"}
          {step === "success" && "預約成功"}
        </p>
      </div>

      {/* Steps */}
      <div className="p-4">
        {step === "service" && (
          <ServiceStep
            services={services}
            onSelect={(service) => {
              setSelectedService(service);
              setStep("date");
            }}
          />
        )}

        {step === "date" && selectedService && (
          <CalendarStep
            onSelect={handleDateSelect}
            onBack={() => setStep("service")}
          />
        )}

        {step === "time" && (
          <TimeStep
            slots={availableSlots}
            loading={loading}
            selectedTime={selectedTime}
            onSelect={(time) => {
              setSelectedTime(time);
              setStep("confirm");
            }}
            onBack={() => setStep("date")}
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
            onBack={() => setStep("time")}
            submitting={submitting}
          />
        )}

        {step === "success" && bookingResult && selectedService && (
          <SuccessStep
            bookingId={bookingResult.id}
            service={selectedService}
            date={selectedDate}
            time={selectedTime}
          />
        )}
      </div>
    </div>
  );
}
