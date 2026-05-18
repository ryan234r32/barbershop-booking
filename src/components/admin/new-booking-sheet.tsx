"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";
import { adminHeaders } from "@/lib/auth/admin-fetch";
import { FullscreenModal } from "./fullscreen-modal";
import { Modal } from "@/components/ui/modal";
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
  const router = useRouter();
  const [source, setSource] = useState<"PHONE" | "WALK_IN">("PHONE");
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  // V3.7 P0 multi-service (5/18 老闆反饋): admin 新增預約應該能一次選多個服務
  // (剪 + 染 + 護)，總時數 = sum slotsNeeded。不再限定 1hr。
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [isTest, setIsTest] = useState(false);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<CustomerSuggestion[]>([]);
  const [boundCustomer, setBoundCustomer] = useState<CustomerSuggestion | null>(null);
  // Phase 6 P1: post-creation prompt to fill missing customer data.
  const [completePrompt, setCompletePrompt] = useState<{
    userId: string;
    missing: string[];
  } | null>(null);
  const { toast } = useToast();

  const { data: servicesData } = useSWR("/api/services", fetcher);
  // Show ALL services regardless of duration. Multi-select; total time auto-computed.
  const allServices: Service[] = servicesData?.services || [];
  // Stable display order = catalog order from API (already sortOrder asc server-side).
  const selectedServices = selectedServiceIds
    .map((id) => allServices.find((s) => s.id === id))
    .filter((s): s is Service => !!s);
  const totalSlots = selectedServices.reduce((sum, s) => sum + s.slotsNeeded, 0);
  const totalPrice = selectedServices.reduce((sum, s) => sum + s.price, 0);
  const totalDuration = selectedServices.reduce((sum, s) => sum + s.duration, 0);

  // Reset stale selections when sheet closes / reopens for a different slot.
  useEffect(() => {
    if (!open) setSelectedServiceIds([]);
  }, [open]);

  const toggleService = (id: string) => {
    setSelectedServiceIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

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
    if (!customerName.trim() || selectedServiceIds.length === 0) {
      toast({ type: "error", message: "請填寫客人姓名和選擇至少一個服務" });
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
          // V3.7 P0 multi-service — send full array; server sums slotsNeeded / price.
          serviceIds: selectedServiceIds,
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
      const data = await res.json();
      toast({ type: "success", message: "預約已新增" });
      onCreated();
      setCustomerName("");
      setPhone("");
      setSelectedServiceIds([]);
      setNotes("");
      setBoundCustomer(null);
      setIsTest(false);

      // Phase 6 P1: if the resulting customer is missing key profile fields,
      // prompt admin to fill them now (sunk-cost moment — they just typed
      // the booking, the customer is fresh in mind).
      const u = data?.booking?.user as
        | { id: string; phone: string | null; gender: string | null; birthday: string | null }
        | undefined;
      if (u) {
        const missing: string[] = [];
        if (!u.phone) missing.push("手機");
        if (!u.gender) missing.push("性別");
        if (!u.birthday) missing.push("生日");
        if (missing.length > 0) {
          setCompletePrompt({ userId: u.id, missing });
          return; // keep sheet rendered as backdrop until prompt is dismissed
        }
      }
      onOpenChange(false);
    } catch (err) {
      toast({ type: "error", message: err instanceof Error ? err.message : "新增失敗" });
    } finally {
      setLoading(false);
    }
  };

  const dateObj = new Date(date + "T00:00:00+08:00");
  const startHour = parseInt(time.split(":")[0]);
  // Effective slots: if user has picked services, use sum; else hint from props
  // (default duration=1 just for the "starting at" header before any pick).
  const effectiveSlots = totalSlots || duration;
  const endTime = `${String(startHour + effectiveSlots).padStart(2, "0")}:00`;
  const dateDisplay = effectiveSlots > 1
    ? `${dateObj.getMonth() + 1}/${dateObj.getDate()} (${WEEKDAYS[dateObj.getDay()]}) ${time} — ${endTime}（${effectiveSlots} 小時）`
    : `${dateObj.getMonth() + 1}/${dateObj.getDate()} (${WEEKDAYS[dateObj.getDay()]}) ${time}（1 小時）`;

  const segmentLabels: Record<string, string> = {
    VIP: "VIP", REGULAR: "常客", NEW: "新客", AT_RISK: "流失中",
  };

  if (!open) return null;

  return (
    <>
    {/* Full-page overlay via FullscreenModal (跟 ExpenseEntrySheet / DailyCloseSheet 同 pattern，
        PR #92 已驗證 vaul 在 iOS PWA 不穩 → 改用 portal + fixed div)。
        preventDismiss=true：背景 / ESC 不關閉，唯一出口是左上 X / 底部取消 / 確認新增。 */}
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

        {/* Service multi-select (V3.7 P0 — 老闆 5/18 反饋) */}
        <div className="mb-3">
          <div className="flex items-center justify-between mb-2">
            <label className="text-[10px] font-medium text-[var(--color-text-muted)] tracking-wider">
              選擇服務（可複選）
            </label>
            {selectedServiceIds.length > 0 && (
              <span className="text-[11px] font-semibold text-[var(--color-brand)] tabular-nums">
                共 {totalSlots} 小時 · NT${totalPrice.toLocaleString()}
              </span>
            )}
          </div>
          {allServices.length === 0 ? (
            <p className="text-xs text-[var(--color-text-muted)] py-2">
              載入服務中…
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-1.5">
              {allServices.map((s) => {
                const checked = selectedServiceIds.includes(s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => toggleService(s.id)}
                    className={`relative text-left px-3 py-2.5 rounded-lg border-2 transition-all ${
                      checked
                        ? "bg-[var(--color-brand)]/10 border-[var(--color-brand)]"
                        : "bg-white border-[var(--color-text-muted)]/15 hover:border-[var(--color-text-muted)]/30"
                    }`}
                  >
                    {checked && (
                      <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-[var(--color-brand)] text-white text-[10px] inline-flex items-center justify-center font-bold">
                        ✓
                      </span>
                    )}
                    <div className="text-[13px] font-medium text-[var(--color-text-primary)] pr-5 truncate">
                      {s.name}
                    </div>
                    <div className="text-[11px] text-[var(--color-text-muted)] mt-0.5 tabular-nums">
                      {s.slotsNeeded} 小時 · NT${s.price.toLocaleString()}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
          {selectedServices.length > 1 && (
            <p className="text-[11px] text-[var(--color-text-muted)] mt-2">
              {selectedServices.map((s) => s.name).join(" + ")}（{totalDuration} 分）
            </p>
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

    {/* Phase 6 P1: 順便補登 prompt — fires when the just-created booking's
        customer is missing phone / gender / birthday. */}
    <Modal
      isOpen={!!completePrompt}
      title="這位顧客缺資料，要順便補登嗎？"
    >
      {completePrompt && (
        <>
          <p className="text-sm text-[var(--color-text-body)] leading-relaxed mb-2">
            缺：<span className="font-semibold">{completePrompt.missing.join("、")}</span>
          </p>
          <p className="text-xs text-[var(--color-text-muted)] mb-5">
            趁印象還新時補登最快 — 之後行銷推播、提醒訊息都會用到這些資料。
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setCompletePrompt(null);
                onOpenChange(false);
              }}
              className="flex-1 h-11 rounded-lg border border-[var(--color-brand)]/20 text-[var(--color-brand)] text-sm font-medium"
            >
              稍後再說
            </button>
            <button
              type="button"
              onClick={() => {
                const target = `/customers/${completePrompt.userId}`;
                setCompletePrompt(null);
                onOpenChange(false);
                router.push(target);
              }}
              className="flex-1 h-11 rounded-lg bg-[var(--color-brand)] text-[var(--color-bg)] text-sm font-semibold"
            >
              去補登 →
            </button>
          </div>
        </>
      )}
    </Modal>
    </>
  );
}
