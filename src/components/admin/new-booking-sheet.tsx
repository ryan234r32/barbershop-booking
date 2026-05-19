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

interface Variant {
  id: string;
  name: string;
  price: number;
  durationMin: number;
  slotsNeeded: number;
  sortOrder: number;
}

interface Service {
  id: string;
  name: string;
  duration: number;
  slotsNeeded: number;
  price: number;
  // V3.7 P3 (5/19): 服務變異 + 諮詢制
  hasVariants?: boolean;
  bookingMode?: "NORMAL" | "CONSULTATION";
  variants?: Variant[];
}

interface ServiceSelection {
  service: Service;
  variant?: Variant;
  /** CONSULTATION-only admin override (染漂時間每次不同) */
  overrideDurationMin?: number;
  /** CONSULTATION-only admin override */
  overridePrice?: number;
}

/** V3.7 (5/19) — 服務分類用於 admin tile 色彩分組 + 護髮 upsell 判定。 */
type ServiceCategory = "cut" | "dye" | "perm" | "treatment" | "other";

function categorizeService(service: { name: string }): ServiceCategory {
  const n = service.name;
  if (n.includes("護髮")) return "treatment";
  if (n.includes("染") || n.includes("漂")) return "dye";
  if (n.includes("燙") || n.includes("矯正")) return "perm";
  if (n.includes("剪") || n.includes("瀏海")) return "cut";
  return "other";
}

const ADMIN_CATEGORY_META: Record<
  ServiceCategory,
  { label: string; accent: string; chipBg: string; chipText: string; order: number }
> = {
  cut: { label: "剪髮類", accent: "#003D2B", chipBg: "rgba(0,61,43,0.10)", chipText: "#003D2B", order: 1 },
  dye: { label: "染髮類", accent: "#7C5BA8", chipBg: "rgba(124,91,168,0.12)", chipText: "#4F3578", order: 2 },
  perm: { label: "燙髮類", accent: "#D97D3A", chipBg: "rgba(217,125,58,0.12)", chipText: "#8A4416", order: 3 },
  treatment: { label: "護髮", accent: "#C9A961", chipBg: "rgba(201,169,97,0.14)", chipText: "#7A6420", order: 4 },
  other: { label: "其他", accent: "#73A891", chipBg: "rgba(115,168,145,0.14)", chipText: "#2F5E4B", order: 5 },
};

const ADMIN_UPSELL_TRIGGER_TERMS = ["染", "燙", "漂", "矯正"];

/** Resolve effective price/slots/duration for a selection (variant > override > service default). */
function selectionPrice(sel: ServiceSelection): number {
  if (sel.variant) return sel.variant.price;
  if (typeof sel.overridePrice === "number") return sel.overridePrice;
  return sel.service.price;
}
function selectionDurationMin(sel: ServiceSelection): number {
  if (sel.variant) return sel.variant.durationMin;
  if (typeof sel.overrideDurationMin === "number") return sel.overrideDurationMin;
  return sel.service.duration;
}
function selectionSlots(sel: ServiceSelection): number {
  if (sel.variant) return sel.variant.slotsNeeded;
  // Override durationMin → recompute slots (ceil to 1hr)
  if (typeof sel.overrideDurationMin === "number") {
    return Math.max(1, Math.ceil(sel.overrideDurationMin / 60));
  }
  return sel.service.slotsNeeded;
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
  // V3.7 P3 (5/19): selections 物件化以支援 variant 與 CONSULTATION override。
  const [selectedSelections, setSelectedSelections] = useState<ServiceSelection[]>([]);
  /** Service id 目前在 UI 上「展開中」(顯示 variant chips 或 consultation 輸入)。null = 全收。 */
  const [expandedServiceId, setExpandedServiceId] = useState<string | null>(null);
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
  const totalSlots = selectedSelections.reduce((sum, s) => sum + selectionSlots(s), 0);
  const totalPrice = selectedSelections.reduce((sum, s) => sum + selectionPrice(s), 0);
  const totalDuration = selectedSelections.reduce((sum, s) => sum + selectionDurationMin(s), 0);

  // Reset stale selections when sheet closes / reopens for a different slot.
  useEffect(() => {
    if (!open) {
      setSelectedSelections([]);
      setExpandedServiceId(null);
    }
  }, [open]);

  const isSelected = (serviceId: string) =>
    selectedSelections.some((s) => s.service.id === serviceId);

  const removeSelection = (serviceId: string) => {
    setSelectedSelections((prev) => prev.filter((s) => s.service.id !== serviceId));
  };

  /** Tap on a service tile — branches by hasVariants / bookingMode. */
  const handleServiceTileTap = (svc: Service) => {
    // Already selected → toggle off (any branch).
    if (isSelected(svc.id)) {
      removeSelection(svc.id);
      if (expandedServiceId === svc.id) setExpandedServiceId(null);
      return;
    }
    if (svc.hasVariants && svc.variants && svc.variants.length > 0) {
      // Open variant picker inline; only commit once user taps a variant chip.
      setExpandedServiceId((cur) => (cur === svc.id ? null : svc.id));
      return;
    }
    if (svc.bookingMode === "CONSULTATION") {
      // Add with default override = service defaults; expand inline editors.
      setSelectedSelections((prev) => [
        ...prev,
        { service: svc, overrideDurationMin: svc.duration, overridePrice: svc.price },
      ]);
      setExpandedServiceId(svc.id);
      return;
    }
    // NORMAL service → plain add.
    setSelectedSelections((prev) => [...prev, { service: svc }]);
  };

  const pickVariant = (svc: Service, variant: Variant) => {
    setSelectedSelections((prev) => {
      // If user re-taps a different variant for same service, replace it.
      const without = prev.filter((s) => s.service.id !== svc.id);
      return [...without, { service: svc, variant }];
    });
    setExpandedServiceId(null);
  };

  const updateOverride = (
    serviceId: string,
    field: "overrideDurationMin" | "overridePrice",
    value: number,
  ) => {
    setSelectedSelections((prev) =>
      prev.map((s) => (s.service.id === serviceId ? { ...s, [field]: value } : s)),
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
    if (!customerName.trim() || selectedSelections.length === 0) {
      toast({ type: "error", message: "請填寫客人姓名和選擇至少一個服務" });
      return;
    }
    // V3.7 P3 guard: hasVariants services 必須挑 variant 才能送
    const missingVariant = selectedSelections.find(
      (s) => s.service.hasVariants && !s.variant,
    );
    if (missingVariant) {
      toast({
        type: "error",
        message: `「${missingVariant.service.name}」要選一個尺寸/分類才能送出`,
      });
      return;
    }
    /* 5/19 bug fix: 之前只靠 server 422 報「預約時段須在營業時間內」，但客戶端
       已經知道 startTime + totalSlots，應該本地擋下避免送單失敗。
       規則：startHour + totalSlots <= 20 (DEFAULT_BUSINESS_HOURS.endTime). */
    const startH = parseInt(time.split(":")[0]);
    if (startH + totalSlots > 20) {
      const overtimeHours = (startH + totalSlots) - 20;
      toast({
        type: "error",
        message: `這組服務共 ${totalSlots} 小時，會超過 20:00 收班 ${overtimeHours} 小時。請改開始時間，或移除部分服務。`,
      });
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
      // V3.7 P3 (5/19): server shape `services: [{ serviceId, variantId?, overridePrice?, overrideDurationMin? }]`.
      // override 路徑用於 CONSULTATION 服務（染漂老闆現場決定）+ 任何想 ad-hoc
      // 調金額/時數的情況。Server 規則：override > variant > service default.
      // 只送跟 default 不同的 override 值（避免無謂寫入）。
      const servicesPayload = selectedSelections.map((sel) => {
        const defaultPrice = sel.variant?.price ?? sel.service.price;
        const defaultDuration = sel.variant?.durationMin ?? sel.service.duration;
        return {
          serviceId: sel.service.id,
          ...(sel.variant ? { variantId: sel.variant.id } : {}),
          ...(typeof sel.overridePrice === "number" && sel.overridePrice !== defaultPrice
            ? { overridePrice: sel.overridePrice }
            : {}),
          ...(typeof sel.overrideDurationMin === "number" && sel.overrideDurationMin !== defaultDuration
            ? { overrideDurationMin: sel.overrideDurationMin }
            : {}),
        };
      });
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: adminHeaders(),
        body: JSON.stringify({
          customerId: boundCustomer?.id,
          displayName: customerName.trim(),
          phone: phone.trim() || undefined,
          services: servicesPayload,
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
      setSelectedSelections([]);
      setExpandedServiceId(null);
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

        {/* Service multi-select (V3.7 P0 — 老闆 5/18 反饋) + P3 variants/consultation (5/19) */}
        <div className="mb-3">
          <div className="flex items-center justify-between mb-2">
            <label className="text-[10px] font-medium text-[var(--color-text-muted)] tracking-wider">
              選擇服務（可複選）
            </label>
            {selectedSelections.length > 0 && (() => {
              const startH = parseInt(time.split(":")[0]);
              const overtimeHours = startH + totalSlots - 20;
              const isOvertime = overtimeHours > 0;
              return (
                <span
                  className={`text-[11px] font-semibold tabular-nums ${
                    isOvertime
                      ? "text-[var(--color-danger)]"
                      : "text-[var(--color-brand)]"
                  }`}
                >
                  {isOvertime
                    ? `⚠️ 超過 ${overtimeHours} 小時收班`
                    : `共 ${totalSlots} 小時 · NT$${totalPrice.toLocaleString()}`}
                </span>
              );
            })()}
          </div>
          {/* V3.7 (5/19) — 護髮 upsell banner: 染/燙/漂 selected but 護髮 not. */}
          {(() => {
            const treatmentSvc = allServices.find(
              (svc) =>
                svc.name.includes("護髮") &&
                svc.bookingMode !== "CONSULTATION" &&
                !svc.hasVariants,
            );
            const hasTreatment = selectedSelections.some((sel) =>
              `${sel.service.name} ${sel.variant?.name ?? ""}`.includes("護髮"),
            );
            const triggers = selectedSelections.some((sel) => {
              const name = `${sel.service.name} ${sel.variant?.name ?? ""}`;
              return (
                !name.includes("護髮") &&
                ADMIN_UPSELL_TRIGGER_TERMS.some((t) => name.includes(t))
              );
            });
            if (!treatmentSvc || hasTreatment || !triggers) return null;
            return (
              <div
                className="mb-3 rounded-lg p-3 flex items-center justify-between gap-3"
                style={{
                  background: "linear-gradient(135deg, rgba(201,169,97,0.18) 0%, rgba(212,165,71,0.10) 100%)",
                  border: "1px solid rgba(201,169,97,0.45)",
                }}
              >
                <div className="min-w-0">
                  <div className="text-[11px] font-bold tracking-wider" style={{ color: "#7A6420" }}>
                    💧 建議加購
                  </div>
                  <div className="text-[13px] font-semibold text-[var(--color-text-primary)] mt-0.5">
                    護髮（NT$ {treatmentSvc.price.toLocaleString()}）效果更佳
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleServiceTileTap(treatmentSvc)}
                  className="shrink-0 px-3 py-2 rounded-md text-[12px] font-bold text-white whitespace-nowrap"
                  style={{ background: "#C9A961" }}
                >
                  加入
                </button>
              </div>
            );
          })()}
          {allServices.length === 0 ? (
            <p className="text-xs text-[var(--color-text-muted)] py-2">
              載入服務中…
            </p>
          ) : (() => {
            // Group by category, preserve original order within each.
            const groups = new Map<ServiceCategory, Service[]>();
            for (const svc of allServices) {
              const cat = categorizeService(svc);
              if (!groups.has(cat)) groups.set(cat, []);
              groups.get(cat)!.push(svc);
            }
            const orderedCats = Array.from(groups.keys()).sort(
              (a, b) => ADMIN_CATEGORY_META[a].order - ADMIN_CATEGORY_META[b].order,
            );
            return (
              <div className="space-y-3">
                {orderedCats.map((cat) => {
                  const meta = ADMIN_CATEGORY_META[cat];
                  const list = groups.get(cat)!;
                  return (
                    <div key={cat}>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span
                          className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider"
                          style={{ background: meta.chipBg, color: meta.chipText }}
                        >
                          {meta.label}
                        </span>
                        <span
                          className="flex-1 h-px"
                          style={{ background: `${meta.accent}33` }}
                        />
                        <span className="text-[10px] text-[var(--color-text-muted)] tabular-nums">
                          {list.length}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
              {list.map((s) => {
                const selection = selectedSelections.find((x) => x.service.id === s.id);
                const checked = !!selection;
                const isExpanded = expandedServiceId === s.id;
                const isVariant = !!s.hasVariants && (s.variants?.length ?? 0) > 0;
                const isConsult = s.bookingMode === "CONSULTATION";
                // Display labels — variant wins over service defaults.
                const displayName = selection?.variant
                  ? `${s.name}・${selection.variant.name}`
                  : s.name;
                const displaySlots = selection ? selectionSlots(selection) : s.slotsNeeded;
                const displayPrice = selection ? selectionPrice(selection) : s.price;
                return (
                  <div
                    key={s.id}
                    className={`relative col-span-1 ${
                      (isExpanded || (checked && isConsult)) ? "col-span-2" : ""
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => handleServiceTileTap(s)}
                      className={`relative w-full text-left px-3 py-2.5 rounded-lg border-2 transition-all overflow-hidden ${
                        checked
                          ? "bg-[var(--color-brand)]/10 border-[var(--color-brand)]"
                          : "bg-white border-[var(--color-text-muted)]/15 hover:border-[var(--color-text-muted)]/30"
                      }`}
                    >
                      {/* Category accent rail */}
                      <span
                        aria-hidden
                        className="absolute top-0 left-0 right-0 h-[2px]"
                        style={{ background: meta.accent }}
                      />
                      {checked && (
                        <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-[var(--color-brand)] text-white text-[10px] inline-flex items-center justify-center font-bold">
                          ✓
                        </span>
                      )}
                      <div className="flex items-center gap-1.5 pr-5">
                        <span className="text-[13px] font-medium text-[var(--color-text-primary)] truncate">
                          {displayName}
                        </span>
                        {isConsult && !checked && (
                          <span className="text-[9px] font-semibold text-[var(--color-warning)] bg-[var(--color-warning)]/10 px-1 py-0.5 rounded shrink-0">
                            諮詢制
                          </span>
                        )}
                        {isVariant && !selection?.variant && (
                          <span className="text-[9px] font-semibold text-[var(--color-brand)] bg-[var(--color-brand)]/10 px-1 py-0.5 rounded shrink-0">
                            選尺寸
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-[var(--color-text-muted)] mt-0.5 tabular-nums">
                        {isVariant && !selection?.variant
                          ? `${s.variants?.length ?? 0} 種價位`
                          : `${displaySlots} 小時 · NT$${displayPrice.toLocaleString()}`}
                      </div>
                    </button>

                    {/* Variant chip row (inline, only when expanded + has variants) */}
                    {isExpanded && isVariant && (
                      <div className="mt-1.5 p-2 rounded-lg bg-[var(--color-surface)] flex flex-wrap gap-1.5">
                        {s.variants!.map((v) => {
                          const isPicked = selection?.variant?.id === v.id;
                          return (
                            <button
                              key={v.id}
                              type="button"
                              onClick={() => pickVariant(s, v)}
                              className={`text-[12px] px-2.5 py-1.5 rounded-full border transition-colors ${
                                isPicked
                                  ? "bg-[var(--color-brand)] text-[var(--color-bg)] border-[var(--color-brand)]"
                                  : "bg-white text-[var(--color-text-body)] border-[var(--color-text-muted)]/25 hover:border-[var(--color-brand)]"
                              }`}
                            >
                              <span className="font-medium">{v.name}</span>
                              <span className="ml-1 tabular-nums opacity-80">
                                NT${v.price.toLocaleString()}・{v.slotsNeeded}hr
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* CONSULTATION inline override (time + price) */}
                    {checked && isConsult && (
                      <div className="mt-1.5 p-2.5 rounded-lg bg-[var(--color-warning)]/5 border border-[var(--color-warning)]/30">
                        <p className="text-[10px] text-[var(--color-text-muted)] mb-1.5 leading-snug">
                          諮詢制 — 染漂時間每次不同，請依顧客狀況調整。
                          確認預約後可在結帳時再次微調。
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                          <label className="block">
                            <span className="text-[10px] text-[var(--color-text-muted)] tracking-wider">時數（分鐘）</span>
                            <input
                              type="number"
                              inputMode="numeric"
                              min={30}
                              step={30}
                              value={selection?.overrideDurationMin ?? s.duration}
                              onChange={(e) =>
                                updateOverride(s.id, "overrideDurationMin", Number(e.target.value) || 0)
                              }
                              className="w-full mt-0.5 bg-white border border-[var(--color-text-muted)]/20 rounded px-2 py-1 text-sm tabular-nums outline-none focus:border-[var(--color-brand)]"
                            />
                          </label>
                          <label className="block">
                            <span className="text-[10px] text-[var(--color-text-muted)] tracking-wider">金額</span>
                            <input
                              type="number"
                              inputMode="numeric"
                              min={0}
                              step={100}
                              value={selection?.overridePrice ?? s.price}
                              onChange={(e) =>
                                updateOverride(s.id, "overridePrice", Number(e.target.value) || 0)
                              }
                              className="w-full mt-0.5 bg-white border border-[var(--color-text-muted)]/20 rounded px-2 py-1 text-sm tabular-nums outline-none focus:border-[var(--color-brand)]"
                            />
                          </label>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
          {selectedSelections.length > 1 && (
            <p className="text-[11px] text-[var(--color-text-muted)] mt-2">
              {selectedSelections
                .map((s) => (s.variant ? `${s.service.name}・${s.variant.name}` : s.service.name))
                .join(" + ")}
              （{totalDuration} 分）
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
