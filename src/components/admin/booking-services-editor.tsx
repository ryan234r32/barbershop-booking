"use client";

/**
 * V3.7 Tier 0.2 — admin can add extra services to an existing booking
 * (剪+染+護 etc). Chip list = current services. 「加服務」 opens a slim picker
 * sheet listing tenant services not yet on this booking; tap to add.
 *
 * Records via POST /api/bookings/[id]/add-service (BookingService row).
 * Does NOT auto-extend slotsOccupied/endTime — admin manages time manually
 * via reschedule if needed. Checkout amounts are still entered manually.
 */

import { useState } from "react";
import useSWR from "swr";
import { Plus, X } from "lucide-react";
import { adminHeaders } from "@/lib/auth/admin-fetch";
import { useToast } from "@/components/ui/toast";

interface VariantLite {
  id: string;
  name: string;
  price: number;
  durationMin: number;
  slotsNeeded: number;
  sortOrder: number;
}

interface BookingServiceRow {
  id: string;
  order: number;
  price: number;
  durationMin: number;
  serviceId: string;
  service: { id: string; name: string };
  /** V3.7 P3 — when set, chip shows「service・variant」instead of just service */
  variant?: { id: string; name: string } | null;
}

interface ServiceLite {
  id: string;
  name: string;
  price: number;
  duration: number;
  slotsNeeded: number;
  // V3.7 P3 (5/19)
  hasVariants?: boolean;
  bookingMode?: "NORMAL" | "CONSULTATION";
  variants?: VariantLite[];
}

interface BookingShape {
  serviceId?: string;
  services?: BookingServiceRow[];
  service?: { name: string; price: number };
}

const bookingFetcher = (url: string) =>
  fetch(url, { headers: adminHeaders() }).then((r) => r.json() as Promise<{ booking: BookingShape }>);

const servicesFetcher = (url: string) =>
  fetch(url, { headers: adminHeaders() }).then((r) => r.json() as Promise<{ services: ServiceLite[] }>);

export function BookingServicesEditor({
  bookingId,
  onChange,
}: {
  bookingId: string;
  /** Fired after add/remove succeeds so parent can refetch its list. */
  onChange?: () => void;
}) {
  const { toast } = useToast();
  const { data, mutate } = useSWR(`/api/bookings/${bookingId}`, bookingFetcher);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const booking = data?.booking;
  const rows = (booking?.services ?? []).slice().sort((a, b) => a.order - b.order);
  const hasMulti = rows.length > 0;

  // Fallback: pre-Tier-0.2 bookings may not have services[] populated yet
  // (backfill ran on prod but new ones double-write). Show legacy service.name
  // so admins see something useful even when the row is missing.
  const fallbackName = booking?.service?.name;

  const addService = async (payload: { serviceId: string; variantId?: string }) => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/add-service`, {
        method: "POST",
        headers: adminHeaders(),
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "加服務失敗");
      }
      await mutate();
      onChange?.();
      setPickerOpen(false);
      toast({ type: "success", message: "已加入服務" });
    } catch (err) {
      toast({ type: "error", message: err instanceof Error ? err.message : "加服務失敗" });
    } finally {
      setSubmitting(false);
    }
  };

  const removeService = async (rowId: string) => {
    if (submitting) return;
    if (!confirm("確定要移除這項服務？")) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/add-service?bookingServiceId=${rowId}`, {
        method: "DELETE",
        headers: adminHeaders(),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "移除失敗");
      }
      await mutate();
      onChange?.();
    } catch (err) {
      toast({ type: "error", message: err instanceof Error ? err.message : "移除失敗" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-[10px] font-medium text-[var(--color-text-muted)] tracking-wider">
          服務
        </p>
        <button
          onClick={() => setPickerOpen(true)}
          disabled={submitting}
          className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--color-brand)] hover:underline disabled:opacity-50"
        >
          <Plus size={12} aria-hidden />
          加服務
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {hasMulti
          ? rows.map((r) => (
              <span
                key={r.id}
                className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-[var(--color-surface)] border border-[var(--color-text-muted)]/15 text-[12px] text-[var(--color-text-primary)]"
              >
                <span className="font-medium">
                  {r.variant?.name ? `${r.service.name}・${r.variant.name}` : r.service.name}
                </span>
                <span className="text-[var(--color-text-muted)]">NT${r.price.toLocaleString()}</span>
                {r.order > 0 && (
                  <button
                    onClick={() => removeService(r.id)}
                    disabled={submitting}
                    className="ml-0.5 -mr-0.5 text-[var(--color-text-muted)] hover:text-[var(--color-danger)] disabled:opacity-30"
                    aria-label={`移除 ${r.service.name}`}
                  >
                    <X size={11} />
                  </button>
                )}
              </span>
            ))
          : fallbackName && (
              <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-[var(--color-surface)] border border-[var(--color-text-muted)]/15 text-[12px] text-[var(--color-text-primary)]">
                <span className="font-medium">{fallbackName}</span>
              </span>
            )}
      </div>

      {pickerOpen && (
        <ServicePicker
          /* Codex review P2 — pre-backfill bookings have empty services[] but
             a legacy booking.serviceId. Exclude that too so the owner can't
             accidentally duplicate the primary service as an add-on. */
          excludeIds={[
            ...(booking?.serviceId ? [booking.serviceId] : []),
            ...rows.map((r) => r.serviceId),
          ]}
          onCancel={() => setPickerOpen(false)}
          onPick={addService}
          submitting={submitting}
        />
      )}
    </div>
  );
}

function ServicePicker({
  excludeIds,
  onCancel,
  onPick,
  submitting,
}: {
  excludeIds: string[];
  onCancel: () => void;
  onPick: (payload: { serviceId: string; variantId?: string }) => void;
  submitting: boolean;
}) {
  const { data } = useSWR("/api/services", servicesFetcher);
  const services = (data?.services || []).filter((s) => !excludeIds.includes(s.id));
  // V3.7 P3: step state — "list" → tap service tile;
  //   if hasVariants → "variants"; if CONSULTATION → "consult" (inline override).
  const [step, setStep] = useState<"list" | "variants" | "consult">("list");
  const [pickedService, setPickedService] = useState<ServiceLite | null>(null);
  const [consultDuration, setConsultDuration] = useState(60);
  const [consultPrice, setConsultPrice] = useState(0);

  const handleServiceTap = (s: ServiceLite) => {
    if (s.hasVariants && s.variants && s.variants.length > 0) {
      setPickedService(s);
      setStep("variants");
      return;
    }
    if (s.bookingMode === "CONSULTATION") {
      setPickedService(s);
      setConsultDuration(s.duration);
      setConsultPrice(s.price);
      setStep("consult");
      return;
    }
    onPick({ serviceId: s.id });
  };

  const goBack = () => {
    setPickedService(null);
    setStep("list");
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/40 flex items-end justify-center" onClick={onCancel}>
      <div
        className="w-full max-w-md bg-[var(--color-bg)] rounded-t-2xl p-4 max-h-[60vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {step !== "list" && (
              <button
                onClick={goBack}
                className="text-[var(--color-text-muted)] text-sm"
                aria-label="返回"
              >
                ←
              </button>
            )}
            <h3 className="text-base font-bold text-[var(--color-text-primary)]">
              {step === "list" && "加服務"}
              {step === "variants" && `選${pickedService?.name ?? ""}的尺寸`}
              {step === "consult" && "染漂諮詢制"}
            </h3>
          </div>
          <button onClick={onCancel} className="text-[var(--color-text-muted)]">
            <X size={20} />
          </button>
        </div>

        {step === "list" && (
          services.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)] py-6 text-center">
              沒有可加的服務了
            </p>
          ) : (
            <ul className="space-y-1">
              {services.map((s) => {
                const isVariant = !!s.hasVariants && (s.variants?.length ?? 0) > 0;
                const isConsult = s.bookingMode === "CONSULTATION";
                return (
                  <li key={s.id}>
                    <button
                      onClick={() => handleServiceTap(s)}
                      disabled={submitting}
                      className="w-full flex items-center justify-between px-3 py-3 rounded-lg hover:bg-[var(--color-surface)] disabled:opacity-50 text-left"
                    >
                      <span className="flex items-center gap-1.5 min-w-0">
                        <span className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                          {s.name}
                        </span>
                        {isConsult && (
                          <span className="text-[9px] font-semibold text-[var(--color-warning)] bg-[var(--color-warning)]/10 px-1 py-0.5 rounded shrink-0">
                            諮詢制
                          </span>
                        )}
                        {isVariant && (
                          <span className="text-[9px] font-semibold text-[var(--color-brand)] bg-[var(--color-brand)]/10 px-1 py-0.5 rounded shrink-0">
                            選尺寸
                          </span>
                        )}
                      </span>
                      <span className="text-[12px] text-[var(--color-text-muted)] tabular-nums shrink-0 ml-2">
                        {isVariant
                          ? `${s.variants?.length ?? 0} 種價位`
                          : `NT$${s.price.toLocaleString()} · 約 ${s.duration} 分`}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )
        )}

        {step === "variants" && pickedService && (
          <ul className="space-y-1">
            {(pickedService.variants ?? []).map((v) => (
              <li key={v.id}>
                <button
                  onClick={() => onPick({ serviceId: pickedService.id, variantId: v.id })}
                  disabled={submitting}
                  className="w-full flex items-center justify-between px-3 py-3 rounded-lg hover:bg-[var(--color-surface)] disabled:opacity-50 text-left"
                >
                  <span className="text-sm font-medium text-[var(--color-text-primary)]">
                    {pickedService.name}・{v.name}
                  </span>
                  <span className="text-[12px] text-[var(--color-text-muted)] tabular-nums">
                    NT${v.price.toLocaleString()} · {v.slotsNeeded} hr
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {step === "consult" && pickedService && (
          <div>
            <p className="text-[12px] text-[var(--color-text-muted)] mb-3 leading-relaxed">
              染漂諮詢制 — 老闆已 LINE 確認後排程。
              請依現場狀況輸入這次的時數 + 金額（之後結帳可再調整）。
            </p>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <label className="block">
                <span className="text-[10px] text-[var(--color-text-muted)] tracking-wider">時數（分鐘）</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={30}
                  step={30}
                  value={consultDuration}
                  onChange={(e) => setConsultDuration(Number(e.target.value) || 0)}
                  className="w-full mt-0.5 bg-white border border-[var(--color-text-muted)]/25 rounded px-2 py-2 text-sm tabular-nums outline-none focus:border-[var(--color-brand)]"
                />
              </label>
              <label className="block">
                <span className="text-[10px] text-[var(--color-text-muted)] tracking-wider">金額</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={100}
                  value={consultPrice}
                  onChange={(e) => setConsultPrice(Number(e.target.value) || 0)}
                  className="w-full mt-0.5 bg-white border border-[var(--color-text-muted)]/25 rounded px-2 py-2 text-sm tabular-nums outline-none focus:border-[var(--color-brand)]"
                />
              </label>
            </div>
            <button
              onClick={() => onPick({ serviceId: pickedService.id })}
              disabled={submitting}
              className="w-full h-11 rounded-lg bg-[var(--color-brand)] text-[var(--color-bg)] text-sm font-semibold disabled:opacity-50"
            >
              加入此服務
            </button>
            <p className="text-[10px] text-[var(--color-text-muted)] mt-2 leading-snug">
              ※ 時數/金額僅供現場參考；最終以結帳調整為準（Phase 5 將寫入 API）。
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
