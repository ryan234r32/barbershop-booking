"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { adminHeaders } from "@/lib/auth/admin-fetch";

interface UnackBooking {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
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
 * and requires admin to click "✓ 已確認" before moving to the next.
 *
 *   ┌─────────────────────────────────┐
 *   │   1 / 3        新預約待確認     │
 *   ├─────────────────────────────────┤
 *   │   👤 王小明  (新客 · 0 次)      │
 *   │   📞 0912-345-678               │
 *   │   ✂️  漂髮  NT$2,600            │
 *   │   📅 5月15日 週四  14:00–17:00  │
 *   ├─────────────────────────────────┤
 *   │   [    ✓ 我已確認知道    ]      │
 *   └─────────────────────────────────┘
 *
 * On idempotent re-ack (same booking already acked from another device), server
 * returns 200 with `wasAlreadyAcked: true` — we still advance the queue.
 */
export function UnacknowledgedModal({ bookings, onAllAcknowledged }: Props) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [processing, setProcessing] = useState(false);
  const total = bookings.length;

  if (total === 0) return null;

  const current = bookings[currentIndex];
  if (!current) {
    onAllAcknowledged();
    return null;
  }

  const handleAcknowledge = async () => {
    setProcessing(true);
    try {
      const res = await fetch(`/api/bookings/${current.id}/acknowledge`, {
        method: "POST",
        headers: adminHeaders(),
      });

      // 404 / 410 / etc — the booking might have been cancelled while modal was
      // open. Treat any non-success the same: advance the queue rather than
      // wedging the user. They'll see the truth on the calendar.
      if (!res.ok && res.status !== 404) {
        // Soft warning, but still advance to avoid blocking on a transient.
        // eslint-disable-next-line no-console
        console.warn(`acknowledge failed: ${res.status}`);
      }

      if (currentIndex + 1 >= total) {
        onAllAcknowledged();
      } else {
        setCurrentIndex((i) => i + 1);
      }
    } catch {
      // Network error — let user retry by leaving them on the same item.
      alert("網路錯誤，請稍後再試");
    } finally {
      setProcessing(false);
    }
  };

  const initials = (current.user.displayName || "?").charAt(0);
  const segmentLabel =
    SEGMENT_LABEL[current.user.segment] || current.user.segment;

  return (
    <Modal isOpen={true} title="新預約待確認">
      <div className="space-y-5">
        {/* Progress */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            有 {total} 筆新預約等你確認
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
              <p className="text-sm text-muted-foreground mt-1">
                📞 {current.user.phone}
              </p>
            )}
            <p className="text-sm text-muted-foreground mt-1">
              ✂️ {current.service.name} · NT$
              {current.service.price.toLocaleString()}
            </p>
            <p className="text-sm font-medium text-foreground mt-2">
              📅 {formatDateTW(current.date)}　{current.startTime}–
              {current.endTime}
            </p>
          </div>
        </div>

        {/* Action button */}
        <button
          onClick={handleAcknowledge}
          disabled={processing}
          className="w-full h-[52px] bg-[var(--color-brand)] text-[var(--color-bg)] rounded-lg font-bold text-sm disabled:opacity-50 active:scale-[0.98] transition-transform"
        >
          {processing ? "確認中…" : "✓ 我已確認知道"}
        </button>

        <p className="text-xs text-muted-foreground text-center">
          確認後不可取消。要看詳細請到日曆點該筆預約。
        </p>
      </div>
    </Modal>
  );
}
