"use client";

import { useState } from "react";
import { Drawer } from "vaul";
import { useToast } from "@/components/ui/toast";
import { adminHeaders } from "@/lib/auth/admin-fetch";

interface BookingUser {
  id: string;
  displayName: string | null;
  phone: string | null;
  segment: string;
  totalVisits: number;
  notes: string | null;
  lastVisitAt: string | null;
}

interface BookingDetail {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  /** ISO timestamp when admin clicked "I've seen this", or null if not yet. */
  adminAcknowledgedAt?: string | null;
  service: { name: string; price: number; slotsNeeded: number };
  user: BookingUser;
}

interface Props {
  booking: BookingDetail | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAction: () => void; // refresh calendar after action
}

type SheetState = "detail" | "notes";

export function BookingDetailSheet({ booking, open, onOpenChange, onAction }: Props) {
  const [state, setState] = useState<SheetState>("detail");
  const [noteText, setNoteText] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  if (!booking) return null;

  const handleComplete = async (paymentMethod: "CASH" | "BANK_TRANSFER") => {
    setLoading(true);
    try {
      const res = await fetch(`/api/bookings/${booking.id}`, {
        method: "PATCH",
        headers: adminHeaders(),
        body: JSON.stringify({ action: "complete", paymentMethod }),
      });
      if (!res.ok) throw new Error("Failed to complete booking");
      setState("notes");
    } catch {
      toast({ type: "error", message: "操作失敗，請稍後再試" });
    } finally {
      setLoading(false);
    }
  };

  const handleNoShow = async () => {
    if (!confirm("確定標記為未到場？這會記一次違規。")) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/bookings/${booking.id}`, {
        method: "PATCH",
        headers: adminHeaders(),
        body: JSON.stringify({ action: "no_show" }),
      });
      if (!res.ok) throw new Error("Failed");
      toast({ type: "success", message: "已標記為未到場" });
      onOpenChange(false);
      onAction();
    } catch {
      toast({ type: "error", message: "操作失敗" });
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!confirm("確定要取消此預約？")) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/bookings/${booking.id}`, {
        method: "PATCH",
        headers: adminHeaders(),
        body: JSON.stringify({ action: "admin_cancel" }),
      });
      if (!res.ok) throw new Error("Failed");
      toast({ type: "success", message: "預約已取消" });
      onOpenChange(false);
      onAction();
    } catch {
      toast({ type: "error", message: "操作失敗" });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveNote = async () => {
    if (noteText.trim()) {
      try {
        await fetch(`/api/customers/${booking.user.id}`, {
          method: "PATCH",
          headers: adminHeaders(),
          body: JSON.stringify({
            notes: booking.user.notes
              ? `${new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Taipei" })} ${noteText.trim()}\n${booking.user.notes}`
              : `${new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Taipei" })} ${noteText.trim()}`,
          }),
        });
        toast({ type: "success", message: "筆記已儲存" });
      } catch {
        toast({ type: "error", message: "儲存失敗" });
      }
    }
    setNoteText("");
    setState("detail");
    onOpenChange(false);
    onAction();
  };

  const handleSkipNote = () => {
    setNoteText("");
    setState("detail");
    onOpenChange(false);
    onAction();
  };

  const segmentLabels: Record<string, string> = {
    VIP: "VIP", REGULAR: "常客", NEW: "新客", AT_RISK: "流失中", LAPSED: "已流失",
  };

  const segmentColors: Record<string, string> = {
    VIP: "bg-[var(--color-warning)]/15 text-[var(--color-warning)]",
    REGULAR: "bg-[var(--color-success)]/15 text-[var(--color-success)]",
    NEW: "bg-[var(--color-brand)]/10 text-[var(--color-brand)]",
    AT_RISK: "bg-[var(--color-warning)]/15 text-[var(--color-warning)]",
    LAPSED: "bg-[var(--color-danger)]/15 text-[var(--color-danger)]",
  };

  return (
    <Drawer.Root open={open} onOpenChange={(o) => { if (!o) { setState("detail"); setNoteText(""); } onOpenChange(o); }}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 bg-[var(--color-text-body)]/50 z-50" />
        <Drawer.Content className="fixed bottom-0 left-0 right-0 z-50 bg-[var(--color-bg)] rounded-t-2xl max-h-[85vh] outline-none">
          <div className="mx-auto w-10 h-1 rounded-full bg-[var(--color-surface)] mt-3 mb-4" />
          <div className="px-5 pb-8 overflow-y-auto">
            {state === "detail" && (
              <>
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h2 className="text-lg font-bold text-[var(--color-text-primary)]">
                      {booking.user.displayName || "顧客"}
                    </h2>
                    <p className="text-sm text-[var(--color-text-body)] mt-0.5">
                      {booking.service.name} · NT${booking.service.price.toLocaleString()}
                    </p>
                    <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                      {booking.startTime} — {booking.endTime}
                    </p>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-medium tracking-wider ${segmentColors[booking.user.segment] || segmentColors.NEW}`}>
                    {segmentLabels[booking.user.segment] || booking.user.segment}
                  </span>
                </div>

                {/* Stats */}
                <p className="text-xs text-[var(--color-text-muted)] mb-4">
                  來訪 {booking.user.totalVisits} 次
                  {booking.user.lastVisitAt && ` · 上次: ${new Date(booking.user.lastVisitAt).toLocaleDateString("zh-TW", { month: "numeric", day: "numeric" })}`}
                </p>

                {/* Notes */}
                {booking.user.notes && (
                  <div className="bg-[var(--color-surface)] rounded-lg p-3 mb-4">
                    <p className="text-[10px] font-medium text-[var(--color-text-muted)] tracking-wider mb-1">備註</p>
                    <p className="text-sm text-[var(--color-text-body)] whitespace-pre-line line-clamp-3">
                      {booking.user.notes}
                    </p>
                  </div>
                )}

                {/* Acknowledge button — shown only for unacked CONFIRMED bookings.
                    Once clicked, it disappears (replaced by quiet "已確認" badge below). */}
                {booking.status === "CONFIRMED" && !booking.adminAcknowledgedAt && (
                  <button
                    onClick={async () => {
                      setLoading(true);
                      try {
                        await fetch(`/api/bookings/${booking.id}/acknowledge`, {
                          method: "POST",
                          headers: adminHeaders(),
                        });
                        toast({ type: "success", message: "已確認" });
                        onAction(); // refresh calendar so red dot disappears
                      } catch {
                        toast({ type: "error", message: "確認失敗，請重試" });
                      } finally {
                        setLoading(false);
                      }
                    }}
                    disabled={loading}
                    className="w-full mb-3 py-3 bg-[var(--color-brand)]/10 border border-[var(--color-brand)] text-[var(--color-brand)] font-semibold rounded-lg text-sm hover:bg-[var(--color-brand)]/20 transition-colors disabled:opacity-50"
                  >
                    ✓ 我已確認知道
                  </button>
                )}

                {/* Quiet "已確認" badge once acked */}
                {booking.adminAcknowledgedAt && (
                  <p className="text-xs text-[var(--color-success)] mb-3 flex items-center gap-1">
                    ✓ 已確認 ·{" "}
                    {new Date(booking.adminAcknowledgedAt).toLocaleString("zh-TW", {
                      month: "numeric",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                )}

                {/* Actions */}
                {booking.status === "CONFIRMED" && (
                  <div className="space-y-3">
                    {/* Primary: complete cash */}
                    <button
                      onClick={() => handleComplete("CASH")}
                      disabled={loading}
                      className="w-full py-3 bg-[var(--color-brand)] text-[var(--color-bg)] font-semibold rounded-lg text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
                    >
                      完成（現金）
                    </button>

                    {/* Secondary row */}
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() => handleComplete("BANK_TRANSFER")}
                        disabled={loading}
                        className="py-2.5 border border-[var(--color-brand)] text-[var(--color-brand)] rounded-lg text-xs font-medium hover:bg-[var(--color-brand)]/5 transition-colors disabled:opacity-50"
                      >
                        完成（轉帳）
                      </button>
                      <button
                        disabled={loading}
                        className="py-2.5 border border-[var(--color-text-muted)]/30 text-[var(--color-text-body)] rounded-lg text-xs font-medium hover:bg-[var(--color-surface)] transition-colors disabled:opacity-50"
                      >
                        改時間
                      </button>
                      <button
                        onClick={handleCancel}
                        disabled={loading}
                        className="py-2.5 border border-[var(--color-danger)] text-[var(--color-danger)] rounded-lg text-xs font-medium hover:bg-[var(--color-danger)]/5 transition-colors disabled:opacity-50"
                      >
                        取消
                      </button>
                    </div>

                    {/* Tertiary: no show */}
                    <div className="pt-3">
                      <button
                        onClick={handleNoShow}
                        disabled={loading}
                        className="text-xs text-[var(--color-danger)] underline underline-offset-2 hover:opacity-80 disabled:opacity-50"
                      >
                        未到
                      </button>
                    </div>
                  </div>
                )}

                {booking.status !== "CONFIRMED" && (
                  <div className="text-center py-4">
                    <span className="text-sm text-[var(--color-text-muted)]">
                      {booking.status === "COMPLETED" ? "已完成" : booking.status === "NO_SHOW" ? "未到場" : "已取消"}
                    </span>
                  </div>
                )}
              </>
            )}

            {state === "notes" && (
              <>
                <div className="text-center mb-4">
                  <div className="w-12 h-12 rounded-full bg-[var(--color-success)]/15 flex items-center justify-center mx-auto mb-2">
                    <svg className="w-6 h-6 text-[var(--color-success)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h2 className="text-base font-bold text-[var(--color-text-primary)]">預約已完成！</h2>
                  <p className="text-sm text-[var(--color-text-body)]">{booking.user.displayName} — {booking.service.name}</p>
                </div>

                <div className="mb-3">
                  <p className="text-xs font-medium text-[var(--color-text-muted)] tracking-wider mb-2">順手記一下</p>
                  <textarea
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    placeholder="今天的服務筆記..."
                    rows={3}
                    className="w-full bg-[var(--color-surface)] rounded-lg p-3 text-sm text-[var(--color-text-body)] placeholder:text-[var(--color-text-disabled)] outline-none resize-none"
                  />
                </div>

                {booking.user.notes && (
                  <p className="text-xs text-[var(--color-text-muted)] italic mb-4 line-clamp-2">
                    上次筆記: {booking.user.notes.split("\n")[0]}
                  </p>
                )}

                <div className="flex items-center justify-between gap-3">
                  <button
                    onClick={handleSkipNote}
                    className="text-sm text-[var(--color-text-muted)]"
                  >
                    跳過
                  </button>
                  <button
                    onClick={handleSaveNote}
                    className="px-6 py-2.5 bg-[var(--color-brand)] text-[var(--color-bg)] font-semibold rounded-lg text-sm hover:opacity-90 transition-opacity"
                  >
                    儲存筆記
                  </button>
                </div>
              </>
            )}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
