"use client";

/**
 * V3.7 §C — Past-due reconciliation banner.
 *
 * Replaces the disruptive `<PastDueModal>` popup with a sticky red banner at
 * the top of the 財務 tab. Tap to expand → reveals the per-booking 已收現金 /
 * 已轉帳 / 未到 actions. Banner disappears (and "完成今日結帳" unlocks) when the
 * past-due list reaches zero.
 *
 * The banner is intentionally rendered inside `reports/page.tsx` so it appears
 * on all three tabs (daily/monthly/annual) of the 財務 surface.
 */

import { useState } from "react";
import useSWR from "swr";
import { Banknote, Landmark } from "lucide-react";
import { adminHeaders } from "@/lib/auth/admin-fetch";
import { useToast } from "@/components/ui/toast";

interface PastDueBooking {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  service: { name: string; price: number };
  user: { displayName: string | null };
  payment: { status: string; method: string; transferLastFive: string | null } | null;
}

const fetcher = (url: string) =>
  fetch(url, { headers: adminHeaders() }).then((r) => {
    if (!r.ok) throw new Error(String(r.status));
    return r.json();
  });

export function PastDueBanner() {
  const { data, mutate } = useSWR<{ bookings: PastDueBooking[] }>(
    "/api/bookings/past-due",
    fetcher,
    { revalidateOnFocus: true, refreshInterval: 60_000 },
  );
  const [expanded, setExpanded] = useState(false);
  const { toast } = useToast();
  const [pendingId, setPendingId] = useState<string | null>(null);

  const bookings = data?.bookings ?? [];
  if (bookings.length === 0) return null;

  const resolve = async (id: string, action: "cash" | "transfer" | "no-show") => {
    setPendingId(id);
    try {
      let res: Response;
      if (action === "no-show") {
        res = await fetch(`/api/bookings/${id}/no-show`, {
          method: "PATCH",
          headers: adminHeaders(),
        });
      } else {
        // cash / transfer → close as paid via checkout endpoint (POST not PATCH)
        res = await fetch(`/api/bookings/${id}/checkout`, {
          method: "POST",
          headers: { ...adminHeaders(), "Content-Type": "application/json" },
          body: JSON.stringify({
            method: action === "cash" ? "CASH" : "BANK_TRANSFER",
          }),
        });
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }
      toast({
        type: "success",
        message: action === "no-show" ? "已標為未到" : "已記錄收款",
      });
      mutate();
    } catch (e) {
      toast({
        type: "error",
        message: "操作失敗：" + (e instanceof Error ? e.message : String(e)),
      });
    } finally {
      setPendingId(null);
    }
  };

  return (
    <div className="bg-[var(--color-danger)]/10 border border-[var(--color-danger)]/30 rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[var(--color-danger)]/5 transition-colors"
      >
        <span className="w-7 h-7 rounded-full bg-[var(--color-danger)] text-[var(--color-bg)] flex items-center justify-center text-xs font-bold flex-shrink-0">
          {bookings.length}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[var(--color-danger)]">
            還有 {bookings.length} 筆過期預約未對帳
          </p>
          <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
            點開逐筆標記「已收現金 / 已轉帳 / 未到」
          </p>
        </div>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          className={`text-[var(--color-danger)] flex-shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {expanded && (
        <div className="px-2 pb-2 space-y-1.5">
          {bookings.map((b) => (
            <div
              key={b.id}
              className="bg-[var(--color-bg)] rounded-lg p-3 border border-[var(--color-surface)]"
            >
              <div className="flex items-baseline justify-between gap-2 mb-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[var(--color-text-primary)] truncate">
                    {b.user.displayName ?? "（未具名）"} · {b.service.name}
                  </p>
                  <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
                    {b.date.slice(5)} {b.startTime} · NT${b.service.price.toLocaleString()}
                    {b.payment?.transferLastFive && (
                      <span className="ml-1 text-[var(--color-brand)]">
                        · 末五碼 {b.payment.transferLastFive}
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  onClick={() => resolve(b.id, "cash")}
                  disabled={pendingId === b.id}
                  className="py-2 rounded-lg bg-[var(--color-success)]/10 text-[var(--color-success)] text-xs font-semibold disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
                >
                  <Banknote size={14} aria-hidden /> 現金
                </button>
                <button
                  onClick={() => resolve(b.id, "transfer")}
                  disabled={pendingId === b.id}
                  className="py-2 rounded-lg bg-[var(--color-brand)]/10 text-[var(--color-brand)] text-xs font-semibold disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
                >
                  <Landmark size={14} aria-hidden /> 轉帳
                </button>
                <button
                  onClick={() => resolve(b.id, "no-show")}
                  disabled={pendingId === b.id}
                  className="py-2 rounded-lg bg-[var(--color-surface)] text-[var(--color-text-muted)] text-xs font-semibold disabled:opacity-50"
                >
                  未到
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
