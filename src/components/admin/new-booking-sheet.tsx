"use client";

import { useState, useEffect } from "react";
import { useToast } from "@/components/ui/toast";
import { adminHeaders } from "@/lib/auth/admin-fetch";
import { FullscreenModal } from "./fullscreen-modal";
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

// Same human, two User rows: e.g. LIFF created "陳昶龍 Ryan" (real lineUserId,
// phone filled), then admin manually typed "陳昶龍" (lineUserId="manual-…",
// phone null). Treat as one suggestion so admin can't pick the empty record.
function isLikelySamePerson(a: CustomerSuggestion, b: CustomerSuggestion) {
  if (a.id === b.id) return true;
  if (a.phone && b.phone && a.phone === b.phone) return true;
  const an = a.displayName.trim();
  const bn = b.displayName.trim();
  if (an && an === bn) return true;
  // One name is the other + " <Latin alias>" — e.g. "陳昶龍" vs "陳昶龍 Ryan".
  // Latin-only suffix is a common LINE-display-name pattern; pure-Chinese
  // suffixes (e.g. "陳昶" vs "陳昶龍") could be different people, so we
  // require the trailing fragment to be Latin/alphanumeric only.
  const [shorter, longer] = an.length <= bn.length ? [an, bn] : [bn, an];
  if (shorter.length >= 2 && longer.startsWith(shorter)) {
    const rest = longer.slice(shorter.length).trim();
    if (rest && /^[A-Za-z][A-Za-z0-9 .'-]*$/.test(rest)) return true;
  }
  return false;
}

// Pick the more useful record: prefer phone-filled, then more visits,
// then real LIFF user (lineUserId starts with "U") over manual stubs.
function preferRecord(a: CustomerSuggestion, b: CustomerSuggestion) {
  if (!!a.phone !== !!b.phone) return a.phone ? a : b;
  if (a.totalVisits !== b.totalVisits) return a.totalVisits > b.totalVisits ? a : b;
  return a;
}

function dedupeCustomers(list: CustomerSuggestion[]): CustomerSuggestion[] {
  const out: CustomerSuggestion[] = [];
  for (const c of list) {
    const i = out.findIndex((kept) => isLikelySamePerson(kept, c));
    if (i === -1) out.push(c);
    else out[i] = preferRecord(out[i], c);
  }
  return out;
}

export function NewBookingSheet({ date, time, duration = 1, open, onOpenChange, onCreated }: Props) {
  const [source, setSource] = useState<"PHONE" | "WALK_IN">("PHONE");
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [notes, setNotes] = useState("");
  const [isTest, setIsTest] = useState(false);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<CustomerSuggestion[]>([]);
  const [boundCustomer, setBoundCustomer] = useState<CustomerSuggestion | null>(null);
  const { toast } = useToast();

  const { data: servicesData } = useSWR("/api/services", fetcher);
  const allServices: Service[] = servicesData?.services || [];
  const services = allServices.filter((s) => s.slotsNeeded === duration);

  useEffect(() => {
    if (serviceId && !services.some((s) => s.id === serviceId)) {
      setServiceId("");
    }
  }, [duration, services, serviceId]);

  // (FullscreenModal handles body scroll lock + ESC; nothing extra needed here.)

  useEffect(() => {
    if (customerName.trim().length < 2) { setSuggestions([]); return; }
    if (boundCustomer && customerName === boundCustomer.displayName) {
      setSuggestions([]);
      return;
    }
    // 200ms debounce + AbortController: stale "陳" responses can't overwrite
    // the "陳昶龍" results when typing fast on a cold-started Vercel function.
    // Pull 8 raw rows so dedupe still has 5 distinct people to show.
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/customers?search=${encodeURIComponent(customerName)}&limit=8`,
          { signal: ctrl.signal }
        );
        if (!res.ok) return;
        const data = await res.json();
        setSuggestions(dedupeCustomers(data.customers || []).slice(0, 5));
      } catch { /* silent — abort or network */ }
    }, 200);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [customerName, boundCustomer]);

  const selectCustomer = (c: CustomerSuggestion) => {
    setCustomerName(c.displayName);
    setPhone(c.phone || "");
    setSuggestions([]);
    setBoundCustomer(c);
  };

  const handleNameChange = (next: string) => {
    setCustomerName(next);
    if (boundCustomer && next !== boundCustomer.displayName) {
      toast({ type: "info", message: "已解除綁定，這次會建立新客戶" });
      setBoundCustomer(null);
    }
  };

  const handlePhoneChange = (next: string) => {
    setPhone(next);
    if (boundCustomer && next !== (boundCustomer.phone || "")) {
      toast({ type: "info", message: "已解除綁定，這次會建立新客戶" });
      setBoundCustomer(null);
    }
  };

  const handleSubmit = async () => {
    if (!customerName.trim() || !serviceId) {
      toast({ type: "error", message: "請填寫客人姓名和選擇服務" });
      return;
    }
    setLoading(true);
    try {
      const trimmedNotes = notes.trim();
      const finalNotes = isTest
        ? trimmedNotes
          ? `[TEST] ${trimmedNotes}`
          : `[TEST]`
        : trimmedNotes || undefined;
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: adminHeaders(),
        body: JSON.stringify({
          customerId: boundCustomer?.id,
          displayName: customerName.trim(),
          phone: phone.trim() || undefined,
          serviceId,
          date,
          startTime: time,
          source,
          notes: finalNotes,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed");
      }
      toast({ type: "success", message: "預約已新增" });
      onOpenChange(false);
      onCreated();
      setCustomerName("");
      setPhone("");
      setServiceId("");
      setNotes("");
      setBoundCustomer(null);
      setIsTest(false);
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

  if (!open) return null;

  return (
    // Full-page overlay via FullscreenModal (跟 ExpenseEntrySheet / DailyCloseSheet 同 pattern，
    // PR #92 已驗證 vaul 在 iOS PWA 不穩 → 改用 portal + fixed div)。
    // preventDismiss=true：背景 / ESC 不關閉，唯一出口是左上 X / 底部取消 / 確認新增。
    <FullscreenModal onClose={() => onOpenChange(false)} preventDismiss>
      {/* Header — X close on the left, title centred */}
      <div
        className="flex items-center justify-between px-3 border-b border-[var(--color-surface)] flex-shrink-0"
        style={{ paddingTop: "calc(0.5rem + env(safe-area-inset-top))", paddingBottom: "0.5rem" }}
      >
        <button
          onClick={() => onOpenChange(false)}
          aria-label="關閉"
          className="w-10 h-10 rounded-full flex items-center justify-center text-[var(--color-text-body)] hover:bg-[var(--color-surface)] transition-colors"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M6 6l12 12M6 18L18 6" />
          </svg>
        </button>
        <h2 className="text-base font-semibold text-[var(--color-text-primary)]">新增預約</h2>
        <div className="w-10" />
      </div>

      <div className="px-5 pt-4 pb-4 overflow-y-auto flex-1">
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
            onChange={(e) => handleNameChange(e.target.value)}
            className="w-full border-b border-[var(--color-brand)] bg-transparent py-2 text-sm text-[var(--color-text-body)] outline-none placeholder:text-[var(--color-text-disabled)]"
            placeholder="搜尋或輸入姓名"
          />
          {boundCustomer && (
            <p className="text-[11px] text-[#1a503c] mt-1 flex items-center gap-1">
              <span aria-hidden>✓</span>
              已綁定既有客戶（{segmentLabels[boundCustomer.segment] || ""} · {boundCustomer.totalVisits} 次）
            </p>
          )}
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
            onChange={(e) => handlePhoneChange(e.target.value)}
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
        <div className="mb-3">
          <label className="text-[10px] font-medium text-[var(--color-text-muted)] tracking-wider block mb-1">備註</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full bg-[var(--color-surface)] rounded-lg p-3 text-sm text-[var(--color-text-body)] placeholder:text-[var(--color-text-disabled)] outline-none resize-none"
            placeholder="輸入備註（選填）"
          />
        </div>

        {/* [TEST] flag */}
        <div className="mb-6">
          <label className="flex items-center gap-2 cursor-pointer select-none py-1">
            <input
              type="checkbox"
              checked={isTest}
              onChange={(e) => setIsTest(e.target.checked)}
              className="w-4 h-4 accent-[var(--color-warning)]"
            />
            <span className="text-sm text-[var(--color-text-body)]">
              <span className="font-mono text-[var(--color-warning)] mr-1">[TEST]</span>
              標記為測試 — 不計入營收統計
            </span>
          </label>
        </div>
      </div>

      {/* Sticky footer with safe-area padding (iOS PWA home indicator) */}
      <div
        className="px-5 pt-3 border-t border-[var(--color-surface)] flex items-center justify-between gap-3 bg-[var(--color-bg)] flex-shrink-0"
        style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
      >
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
    </FullscreenModal>
  );
}
