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

interface BookingServiceRow {
  id: string;
  order: number;
  price: number;
  durationMin: number;
  serviceId: string;
  service: { id: string; name: string };
}

interface ServiceLite {
  id: string;
  name: string;
  price: number;
  duration: number;
  slotsNeeded: number;
}

interface BookingShape {
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

  const addService = async (serviceId: string) => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/add-service`, {
        method: "POST",
        headers: adminHeaders(),
        body: JSON.stringify({ serviceId }),
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
                <span className="font-medium">{r.service.name}</span>
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
          excludeIds={rows.map((r) => r.serviceId)}
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
  onPick: (id: string) => void;
  submitting: boolean;
}) {
  const { data } = useSWR("/api/services", servicesFetcher);
  const services = (data?.services || []).filter((s) => !excludeIds.includes(s.id));

  return (
    <div className="fixed inset-0 z-[60] bg-black/40 flex items-end justify-center" onClick={onCancel}>
      <div
        className="w-full max-w-md bg-[var(--color-bg)] rounded-t-2xl p-4 max-h-[60vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-bold text-[var(--color-text-primary)]">加服務</h3>
          <button onClick={onCancel} className="text-[var(--color-text-muted)]">
            <X size={20} />
          </button>
        </div>
        {services.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)] py-6 text-center">
            沒有可加的服務了
          </p>
        ) : (
          <ul className="space-y-1">
            {services.map((s) => (
              <li key={s.id}>
                <button
                  onClick={() => onPick(s.id)}
                  disabled={submitting}
                  className="w-full flex items-center justify-between px-3 py-3 rounded-lg hover:bg-[var(--color-surface)] disabled:opacity-50 text-left"
                >
                  <span className="text-sm font-medium text-[var(--color-text-primary)]">
                    {s.name}
                  </span>
                  <span className="text-[12px] text-[var(--color-text-muted)] tabular-nums">
                    NT${s.price.toLocaleString()} · 約 {s.duration} 分
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
