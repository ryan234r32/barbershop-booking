"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { usePageTitle } from "@/lib/hooks/use-page-title";

interface Service {
  id: string;
  name: string;
  duration: number;
  slotsNeeded: number;
  price: number;
}

interface AvailableSlot {
  time: string;
  available: boolean;
  recommended: boolean;
}

export default function NewBookingPage() {
  usePageTitle("新增預約");
  const router = useRouter();
  const [services, setServices] = useState<Service[]>([]);
  const [selectedService, setSelectedService] = useState("");
  const [date, setDate] = useState("");
  const [slots, setSlots] = useState<AvailableSlot[]>([]);
  const [selectedTime, setSelectedTime] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [source, setSource] = useState<"PHONE" | "WALK_IN">("PHONE");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);

  useEffect(() => {
    fetch("/api/services")
      .then((r) => r.json())
      .then((d) => setServices(d.services || []));
  }, []);

  useEffect(() => {
    if (!date || !selectedService) return;
    setLoadingSlots(true);
    setSelectedTime("");
    fetch(`/api/slots?date=${date}&serviceId=${selectedService}`)
      .then((r) => r.json())
      .then((d) => setSlots(d.slots || []))
      .finally(() => setLoadingSlots(false));
  }, [date, selectedService]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedService || !date || !selectedTime) return;

    setSubmitting(true);
    try {
      // For admin bookings, we create a placeholder LINE user ID
      const lineUserId = `admin-${Date.now()}`;

      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceId: selectedService,
          date,
          startTime: selectedTime,
          lineUserId,
          notes: `[${source === "PHONE" ? "電話" : "現場"}] ${customerName} ${customerPhone}\n${notes}`.trim(),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "建立預約失敗");
        return;
      }

      router.push("/dashboard");
    } catch {
      alert("網路錯誤");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-bold text-foreground mb-6">手動新增預約</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Source */}
        <div>
          <label className="text-sm text-muted-foreground block mb-1">來源</label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setSource("PHONE")}
              className={`flex-1 py-2 rounded-lg text-sm ${source === "PHONE" ? "bg-primary text-white" : "bg-secondary text-muted-foreground"}`}
            >
              電話預約
            </button>
            <button
              type="button"
              onClick={() => setSource("WALK_IN")}
              className={`flex-1 py-2 rounded-lg text-sm ${source === "WALK_IN" ? "bg-primary text-white" : "bg-secondary text-muted-foreground"}`}
            >
              現場預約
            </button>
          </div>
        </div>

        {/* Customer info */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm text-muted-foreground block mb-1">顧客姓名</label>
            <input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:border-primary"
              placeholder="王小明"
            />
          </div>
          <div>
            <label className="text-sm text-muted-foreground block mb-1">電話</label>
            <input
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:border-primary"
              placeholder="0912-345-678"
            />
          </div>
        </div>

        {/* Service */}
        <div>
          <label className="text-sm text-muted-foreground block mb-1">服務項目</label>
          <select
            value={selectedService}
            onChange={(e) => setSelectedService(e.target.value)}
            className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:border-primary"
            required
          >
            <option value="">選擇服務</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.duration}分鐘 · NT${s.price})
              </option>
            ))}
          </select>
        </div>

        {/* Date */}
        <div>
          <label className="text-sm text-muted-foreground block mb-1">日期</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:border-primary"
            required
          />
        </div>

        {/* Time slots */}
        {date && selectedService && (
          <div>
            <label className="text-sm text-muted-foreground block mb-1">時段</label>
            {loadingSlots ? (
              <p className="text-sm text-muted-foreground">載入中...</p>
            ) : (
              <div className="grid grid-cols-5 gap-2">
                {slots.map((slot) => (
                  <button
                    key={slot.time}
                    type="button"
                    disabled={!slot.available}
                    onClick={() => setSelectedTime(slot.time)}
                    className={`py-2 text-sm rounded-lg ${
                      !slot.available
                        ? "bg-secondary text-muted-foreground/50 cursor-not-allowed"
                        : selectedTime === slot.time
                        ? "bg-primary text-white"
                        : "bg-card border border-border hover:border-primary"
                    }`}
                  >
                    {slot.time}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Notes */}
        <div>
          <label className="text-sm text-muted-foreground block mb-1">備註</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full px-3 py-2 border border-border rounded-lg text-sm resize-none h-20 focus:outline-none focus:border-primary"
          />
        </div>

        <button
          type="submit"
          disabled={submitting || !selectedService || !date || !selectedTime}
          className={`w-full py-2.5 rounded-lg font-medium text-white ${
            submitting ? "bg-gray-400" : "bg-primary hover:bg-primary"
          }`}
        >
          {submitting ? "建立中..." : "建立預約"}
        </button>
      </form>
    </div>
  );
}
