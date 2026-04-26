"use client";

/**
 * Undo toast shown immediately after a successful drag-reschedule (PRD-v3 E-5).
 * 5-second auto-dismiss; click "撤銷" within that window to revert.
 *
 * Sits at the bottom of the calendar, above the FAB. Dismisses on:
 *  - timer elapse
 *  - successful undo
 *  - manual close
 *  - another reschedule firing
 */

import { useEffect, useState } from "react";
import { Undo2, X } from "lucide-react";
import { adminHeaders } from "@/lib/auth/admin-fetch";

export interface RescheduleResult {
  bookingId: string;
  oldDate: string;
  oldStartTime: string;
  newDate: string;
  newStartTime: string;
  customerName: string;
}

interface Props {
  result: RescheduleResult | null;
  onDismiss: () => void;
  onUndone: () => void;
}

const VISIBLE_MS = 5000;

export function RescheduleUndoToast({ result, onDismiss, onUndone }: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!result) return;
    setError(null);
    const t = setTimeout(onDismiss, VISIBLE_MS);
    return () => clearTimeout(t);
  }, [result, onDismiss]);

  if (!result) return null;

  const handleUndo = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/bookings/${result.bookingId}/reschedule-undo`,
        { method: "POST", headers: adminHeaders() },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "撤銷失敗");
      onUndone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "撤銷失敗");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-32 right-4 md:bottom-20 md:right-6 z-40 max-w-xs shadow-lg rounded-lg bg-[var(--color-text-primary)] text-[var(--color-bg)] flex items-center gap-2 px-3 py-2.5 text-sm"
    >
      <span className="flex-1 truncate">
        已將 <strong>{result.customerName}</strong> 改期到{" "}
        {result.newDate.slice(5)} {result.newStartTime}
        {error && <span className="block text-[var(--color-danger)] text-[11px] mt-0.5">{error}</span>}
      </span>
      <button
        type="button"
        onClick={handleUndo}
        disabled={submitting}
        className="flex items-center gap-1 px-2 py-1 rounded bg-[var(--color-bg)]/15 hover:bg-[var(--color-bg)]/25 disabled:opacity-50 transition-colors text-[var(--color-bg)] font-medium text-xs"
      >
        <Undo2 size={14} />
        撤銷
      </button>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="關閉"
        className="p-1 rounded hover:bg-[var(--color-bg)]/15 transition-colors"
      >
        <X size={14} />
      </button>
    </div>
  );
}
