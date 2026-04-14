"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { adminHeaders } from "@/lib/auth/admin-fetch";

interface PastDueBooking {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  service: { name: string; price: number };
  user: { displayName: string | null };
  payment?: {
    status: "PENDING" | "VERIFYING" | "RECEIVED" | "WAIVED";
    method: "CASH" | "BANK_TRANSFER";
    transferLastFive: string | null;
  } | null;
}

interface PastDueModalProps {
  bookings: PastDueBooking[];
  onProcessed: () => void;
}

export function PastDueModal({ bookings, onProcessed }: PastDueModalProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [processing, setProcessing] = useState(false);
  const total = bookings.length;

  if (total === 0) return null;

  const current = bookings[currentIndex];
  if (!current) {
    onProcessed();
    return null;
  }

  const handleAction = async (action: "complete" | "no_show") => {
    setProcessing(true);
    try {
      const res = await fetch(`/api/bookings/${current.id}`, {
        method: "PATCH",
        headers: adminHeaders(),
        body: JSON.stringify({ action }),
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "操作失敗");
        return;
      }

      if (currentIndex + 1 >= total) {
        onProcessed();
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
  const dateStr = new Date(current.date).toLocaleDateString("zh-TW", { month: "numeric", day: "numeric", weekday: "short" });

  return (
    <Modal isOpen={true} title="請確認預約狀態">
      <div className="space-y-5">
        {/* Progress */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">有 {total} 筆預約需要確認</p>
          <span className="text-sm font-medium text-foreground">{currentIndex + 1} / {total}</span>
        </div>

        <hr className="border-border/50" />

        {/* Booking info */}
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center shrink-0">
            <span className="text-lg font-bold text-primary">{initials}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-foreground">{current.user.displayName || "未知顧客"}</p>
            <p className="text-sm text-muted-foreground mt-1">{current.service.name}</p>
            <p className="text-sm text-muted-foreground">{current.startTime} — {current.endTime}</p>
            <p className="text-sm font-semibold text-foreground mt-1">NT${current.service.price.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground mt-2">
              {dateStr}
            </p>
          </div>
        </div>

        {/* Payment context: show VERIFYING transfer last-5 so admin can cross-check with bank app */}
        {current.payment?.status === "VERIFYING" && current.payment.transferLastFive && (
          <div className="bg-[var(--color-brand)]/5 border border-[var(--color-brand)]/20 rounded-lg px-3 py-2.5">
            <p className="text-xs text-muted-foreground">客戶已回報轉帳</p>
            <p className="text-sm font-bold text-foreground mt-0.5">
              末 5 碼：<span className="font-mono tracking-widest">{current.payment.transferLastFive}</span>
            </p>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={() => handleAction("complete")}
            disabled={processing}
            className="flex-1 h-[52px] bg-[var(--color-success)] text-white rounded-lg font-bold text-sm disabled:opacity-50 active:scale-[0.98] transition-transform"
          >
            已收款 ✓
          </button>
          <button
            onClick={() => handleAction("no_show")}
            disabled={processing}
            className="flex-1 h-[52px] bg-transparent border-[1.5px] border-[var(--color-danger)] text-[var(--color-danger)] rounded-lg font-bold text-sm disabled:opacity-50 active:scale-[0.98] transition-transform"
          >
            未到 ✗
          </button>
        </div>

        <p className="text-xs text-muted-foreground text-center">確認後將自動更新客人狀態</p>
      </div>
    </Modal>
  );
}
