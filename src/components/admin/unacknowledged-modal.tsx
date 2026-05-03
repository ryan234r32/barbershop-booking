"use client";

import { useState } from "react";
import { Phone, Scissors, Calendar, Check } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { adminHeaders } from "@/lib/auth/admin-fetch";

interface UnackBooking {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  /**
   * PRD-v3 E-1 — sent back as `expectedUpdatedAt` on ack so the server can
   * reject stale acks (e.g. the booking was rescheduled from another device
   * while this modal was open).
   */
  updatedAt?: string;
  service: { name: string; price: number };
  user: {
    displayName: string | null;
    phone: string | null;
    segment: string;
    totalVisits: number;
  };
}

interface Props {
  bookings: UnackBooking[];
  /** Called after every booking has been acknowledged (or skipped via dismiss). */
  onAllAcknowledged: () => void;
  /**
   * Called when the server returns 409 stale_ack — parent should refetch the
   * unack queue so the user sees the up-to-date booking and re-confirms.
   */
  onStale?: () => void;
}

const SEGMENT_LABEL: Record<string, string> = {
  VIP: "VIP",
  REGULAR: "常客",
  NEW: "新客",
  AT_RISK: "流失中",
  LAPSED: "已流失",
};

function formatDateTW(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("zh-TW", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  });
}

/**
 * Forced queue modal that shows EACH unacknowledged booking one at a time
 * and requires admin to click "✓ 知道了" before moving to the next.
 *
 * Semantic note (PRD-v3 §2): ack is a READ RECEIPT, not a gate. Bookings
 * always go on the calendar regardless of ack state — this modal only ensures
 * the owner doesn't miss a new booking via push notifications. Click "知道了"
 * marks it as seen; it does NOT change the booking status.
 *
 *   ┌─────────────────────────────────┐
 *   │   1 / 3        新預約通知       │
 *   ├─────────────────────────────────┤
 *   │   👤 王小明  (新客 · 0 次)      │
 *   │   📞 0912-345-678               │
 *   │   ✂️  漂髮  NT$2,600            │
 *   │   📅 5月15日 週四  14:00–17:00  │
 *   ├─────────────────────────────────┤
 *   │   [      ✓ 知道了        ]      │
 *   └─────────────────────────────────┘
 *
 * On idempotent re-ack (same booking already acked from another device), server
 * returns 200 with `wasAlreadyAcked: true` — we still advance the queue.
 */
export function UnacknowledgedModal({ bookings, onAllAcknowledged, onStale }: Props) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [staleNotice, setStaleNotice] = useState<string | null>(null);
  const total = bookings.length;

  if (total === 0) return null;

  const current = bookings[currentIndex];
  if (!current) {
    onAllAcknowledged();
    return null;
  }

  const handleAcknowledge = async () => {
    setProcessing(true);
    setStaleNotice(null);
    try {
      const res = await fetch(`/api/bookings/${current.id}/acknowledge`, {
        method: "POST",
        headers: { ...adminHeaders(), "Content-Type": "application/json" },
        body: current.updatedAt
          ? JSON.stringify({ expectedUpdatedAt: current.updatedAt })
          : undefined,
      });

      // PRD-v3 E-1: stale ack — booking was mutated since this modal opened.
      // Don't advance; surface a notice and ask parent to refetch.
      if (res.status === 409) {
        setStaleNotice("此預約剛剛被更新，請重新確認");
        onStale?.();
        return;
      }

      // 404 / other non-success — booking might have been cancelled. Advance
      // the queue rather than wedging the user; they'll see truth on the calendar.
      if (!res.ok && res.status !== 404) {
        // eslint-disable-next-line no-console
        console.warn(`acknowledge failed: ${res.status}`);
      }

      if (currentIndex + 1 >= total) {
        onAllAcknowledged();
      } else {
        setCurrentIndex((i) => i + 1);
      }
    } catch {
      alert("網路錯誤，請稍後再試");
    } finally {
      setProcessing(false);
    }
  };

  const initials = (current.user.displayName || "?").charAt(0);
  const segmentLabel =
    SEGMENT_LABEL[current.user.segment] || current.user.segment;

  return (
    <Modal isOpen={true} title="新預約通知">
      <div className="space-y-5">
        {/* Progress */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            有 {total} 筆新預約，請逐筆查看
          </p>
          <span className="text-sm font-medium text-foreground">
            {currentIndex + 1} / {total}
          </span>
        </div>

        <hr className="border-border/50" />

        {/* Booking info */}
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center shrink-0">
            <span className="text-lg font-bold text-primary">{initials}</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2">
              <p className="font-semibold text-foreground">
                {current.user.displayName || "未知顧客"}
              </p>
              <span className="text-xs text-muted-foreground">
                {segmentLabel} · {current.user.totalVisits} 次
              </span>
            </div>
            {current.user.phone && (
              <p className="text-sm text-muted-foreground mt-1 inline-flex items-center gap-1.5">
                <Phone size={14} aria-hidden /> {current.user.phone}
              </p>
            )}
            <p className="text-sm text-muted-foreground mt-1 inline-flex items-center gap-1.5">
              <Scissors size={14} aria-hidden /> {current.service.name} · NT$
              {current.service.price.toLocaleString()}
            </p>
            <p className="text-sm font-medium text-foreground mt-2 inline-flex items-center gap-1.5">
              <Calendar size={14} aria-hidden /> {formatDateTW(current.date)}　{current.startTime}–
              {current.endTime}
            </p>
          </div>
        </div>

        {/* Stale-ack notice (PRD-v3 E-1) */}
        {staleNotice && (
          <div className="rounded-lg bg-[var(--color-warning)]/10 border border-[var(--color-warning)]/30 px-3 py-2 text-xs text-[var(--color-warning)]">
            {staleNotice}
          </div>
        )}

        {/* Action button */}
        <button
          onClick={handleAcknowledge}
          disabled={processing}
          className="w-full h-[52px] bg-[var(--color-brand)] text-[var(--color-bg)] rounded-lg font-bold text-sm disabled:opacity-50 active:scale-[0.98] transition-transform"
        >
          {processing ? (
            "處理中…"
          ) : (
            <span className="inline-flex items-center justify-center gap-1.5">
              <Check size={16} aria-hidden /> 知道了
            </span>
          )}
        </button>

        <p className="text-xs text-muted-foreground text-center">
          這只是讀過提醒，不影響預約狀態。要看詳細請到日曆點該筆預約。
        </p>
      </div>
    </Modal>
  );
}
