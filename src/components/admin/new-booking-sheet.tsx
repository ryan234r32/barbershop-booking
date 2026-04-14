"use client";

import { useState, useEffect } from "react";
import { Drawer } from "vaul";
import { useToast } from "@/components/ui/toast";
import useSWR from "swr";

interface Props {
  date: string; // YYYY-MM-DD
  time: string; // HH:00
  duration?: number; // in hours (slotsNeeded), default 1
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

interface Service {
  id: string;
  name: string;
  duration: number;
  slotsNeeded: number;
  price: number;
}

interface CustomerSuggestion {
  id: string;
  displayName: string;
  phone: string | null;
  segment: string;
  totalVisits: number;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

export function NewBookingSheet({ date, time, duration = 1, open, onOpenChange, onCreated }: Props) {
  const [source, setSource] = useState<"PHONE" | "WALK_IN">("PHONE");
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<CustomerSuggestion[]>([]);
  const { toast } = useToast();

  const { data: servicesData } = useSWR("/api/services", fetcher);
  const allServices: Service[] = servicesData?.services || [];
  // Filter by slotsNeeded matching duration
  const services = allServices.filter((s) => s.slotsNeeded === duration);

  // Reset serviceId if the duration changed and current selection no longer valid
  useEffect(() => {
    if (serviceId && !services.some((s) => s.id === serviceId)) {
      setServiceId("");
    }
  }, [duration, services, serviceId]);

  // Customer search
  useEffect(() => {
    if (customerName.length < 1) { setSuggestions([]); return; }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/customers?search=${encodeURIComponent(customerName)}&limit=5`);
        const data = await res.json();
        setSuggestions(data.customers || []);
      } catch { /* silent */ }
    }, 300);
    return () => clearTimeout(timer);
  }, [customerName]);

  const selectCustomer = (c: CustomerSuggestion) => {
    setCustomerName(c.displayName);
    setPhone(c.phone || "");
    setSuggestions([]);
  };

  const handleSubmit = async () => {
    if (!customerName.trim() || !serviceId) {
      toast({ type: "error", message: "請填寫客人姓名和選擇服務" });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId: process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID || "",
          lineUserId: `admin-${Date.now()}`,
          displayName: customerName.trim(),
          phone: phone.trim() || undefined,
          serviceId,
          date,
          startTime: time,
          source,
          notes: notes.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed");
      }
      toast({ type: "success", message: "預約已新增" });
      onOpenChange(false);
      onCreated();
      // Reset form
      setCustomerName("");
      setPhone("");
      setServiceId("");
      setNotes("");
    } catch (err) {
      toast({ type: "error", message: err instanceof Error ? err.message : "新增失敗" });
    } finally {
      setLoading(false);
    }
  };

  const dateObj = new Date(date + "T00:00:00+08:00");
  const startHour = parseInt(time.split(":")[0]);
  const endTime = `${String(startHour + duration).padStart(2, "0")}:00`;
  const dateDisplay = duration > 1
    ? `${dateObj.getMonth() + 1}/${dateObj.getDate()} (${WEEKDAYS[dateObj.getDay()]}) ${time} — ${endTime}（${duration} 小時）`
    : `${dateObj.getMonth() + 1}/${dateObj.getDate()} (${WEEKDAYS[dateObj.getDay()]}) ${time}（1 小時）`;

  const segmentLabels: Record<string, string> = {
    VIP: "VIP", REGULAR: "常客", NEW: "新客", AT_RISK: "流失中",
  };

  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 bg-[var(--color-text-body)]/50 z-50" />
        <Drawer.Content className="fixed bottom-0 left-0 right-0 z-50 bg-[var(--color-bg)] rounded-t-2xl max-h-[85vh] outline-none">
          <div className="mx-auto w-10 h-1 rounded-full bg-[var(--color-surface)] mt-3 mb-4" />
          <div className="px-5 pb-8 overflow-y-auto">
            <h2 className="text-lg font-bold text-[var(--color-text-primary)] mb-1">新增預約</h2>
            <p className="text-sm text-[var(--color-text-muted)] mb-4">{dateDisplay}</p>

            {/* Source toggle */}
            <div className="flex mb-4 border border-[var(--color-brand)] rounded-lg overflow-hidden">
              {(["PHONE", "WALK_IN"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setSource(s)}
                  className={`flex-1 py-2 text-sm font-medium transition-colors ${
                    source === s
                      ? "bg-[var(--color-brand)] text-[var(--color-bg)]"
                      : "text-[var(--color-brand)]"
                  }`}
                >
                  {s === "PHONE" ? "電話" : "現場"}
                </button>
              ))}
            </div>

            {/* Customer name */}
            <div className="mb-3 relative">
              <label className="text-[10px] font-medium text-[var(--color-text-muted)] tracking-wider block mb-1">客人姓名</label>
              <input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full border-b border-[var(--color-brand)] bg-transparent py-2 text-sm text-[var(--color-text-body)] outline-none placeholder:text-[var(--color-text-disabled)]"
                placeholder="搜尋或輸入姓名"
              />
              {suggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 bg-[var(--color-bg)] border border-[var(--color-surface)] rounded-lg shadow-sm z-10 mt-1">
                  {suggestions.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => selectCustomer(c)}
                      className="w-full text-left px-3 py-2.5 text-sm hover:bg-[var(--color-surface)] transition-colors flex items-center justify-between"
                    >
                      <span className="text-[var(--color-text-primary)]">{c.displayName}</span>
                      <span className="text-[10px] text-[var(--color-text-muted)]">
                        {segmentLabels[c.segment] || ""} · {c.totalVisits}次
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Phone */}
            <div className="mb-3">
              <label className="text-[10px] font-medium text-[var(--color-text-muted)] tracking-wider block mb-1">電話</label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full border-b border-[var(--color-brand)] bg-transparent py-2 text-sm text-[var(--color-text-body)] outline-none placeholder:text-[var(--color-text-disabled)]"
                placeholder="選填"
              />
            </div>

            {/* Service */}
            <div className="mb-3">
              <label className="text-[10px] font-medium text-[var(--color-text-muted)] tracking-wider block mb-1">
                選擇服務（{duration} 小時）
              </label>
              {services.length === 0 ? (
                <p className="text-xs text-[var(--color-danger)] py-2">
                  沒有符合 {duration} 小時的服務，請調整時長。
                </p>
              ) : (
                <select
                  value={serviceId}
                  onChange={(e) => setServiceId(e.target.value)}
                  className="w-full border-b border-[var(--color-brand)] bg-transparent py-2 text-sm text-[var(--color-text-body)] outline-none"
                >
                  <option value="">請選擇</option>
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} · {s.duration}分 · NT${s.price.toLocaleString()}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Notes */}
            <div className="mb-6">
              <label className="text-[10px] font-medium text-[var(--color-text-muted)] tracking-wider block mb-1">備註</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full bg-[var(--color-surface)] rounded-lg p-3 text-sm text-[var(--color-text-body)] placeholder:text-[var(--color-text-disabled)] outline-none resize-none"
                placeholder="輸入備註（選填）"
              />
            </div>

            {/* Buttons */}
            <div className="flex items-center justify-between gap-3">
              <button
                onClick={() => onOpenChange(false)}
                className="text-sm text-[var(--color-text-muted)]"
              >
                取消
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="px-8 py-2.5 bg-[var(--color-brand)] text-[var(--color-bg)] font-semibold rounded-lg text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {loading ? "新增中..." : "確認新增"}
              </button>
            </div>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
