"use client";

/**
 * V3.5 夯客風格行事曆 — Booking detail full-page sheet.
 *
 * Replaces BookingDetailSheet behind the `useFullPageBookingDetail` flag.
 * Differences from the legacy sheet:
 *   1. Three-state segment 尚未到來 / 已報到 / 爽約 replaces the 5-button grid.
 *   2. 「進行結帳」 is the only money action — appears only when 已報到 (auto
 *      check-in if admin clicks it while still 尚未到來, per plan §1.2).
 *   3. Sheet snaps to ~92vh (iOS bottom-sheet feel — leaves ~50px showing the
 *      calendar behind, blurred + dimmed).
 *
 * Sub-states:
 *   - "detail"     — main view with segment + checkout button
 *   - "reschedule" — date+time picker (reused from legacy sheet)
 *   - "checkout"   — opens CheckoutFullPage via portal (controlled by parent state)
 *   - "notes"      — post-checkout note prompt
 *
 * Wave 1 keeps reschedule + cancel + notes flows unchanged from the legacy
 * sheet so the diff stays focused on the new three-state model.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { Coins, Check, Crown, AlertTriangle, ChevronRight } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { adminHeaders } from "@/lib/auth/admin-fetch";
import { CheckoutFullPage } from "./checkout-full-page";
import type { PaymentMethod } from "./checkout-full-page";
import { FullscreenModal } from "./fullscreen-modal";

interface BookingUser {
  id: string;
  displayName: string | null;
  /** 「manual-{adminId}-{uuid}」表示老闆手動建單但客人尚未綁 LINE。
   *  CheckoutFullPage 會偵測這個前綴跳出 QR 邀請流程。 */
  lineUserId: string;
  phone: string | null;
  segment: string;
  totalVisits: number;
  notes: string | null;
  lastVisitAt: string | null;
}

export interface BookingDetail {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  adminAcknowledgedAt?: string | null;
  /// V3.5: NULL = 尚未到來；NOT NULL = 已報到。
  checkedInAt?: string | null;
  /// OCC token — server returns this on every read; we send it back on writes.
  updatedAt?: string;
  service: { name: string; price: number; slotsNeeded: number };
  user: BookingUser;
}

interface Props {
  booking: BookingDetail | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after any state-changing action so the calendar refreshes. */
  onAction: () => void;
}

type SubState = "detail" | "reschedule" | "notes";

const SEGMENT: Array<{ key: "not_yet" | "checked_in" | "no_show"; label: string }> = [
  { key: "not_yet", label: "尚未到來" },
  { key: "checked_in", label: "已報到" },
  { key: "no_show", label: "爽約" },
];

/// Per-state colour: amber for pending, green for done, red for no-show.
/// Selected = coloured bg + matching text + thick coloured border (frame).
/// Unselected stays muted so only the current state pops.
const SEGMENT_STYLES: Record<
  "not_yet" | "checked_in" | "no_show",
  { selectedBg: string; selectedText: string; selectedBorder: string }
> = {
  not_yet: {
    selectedBg: "bg-[var(--color-warning)]/15",
    selectedText: "text-[var(--color-warning)]",
    selectedBorder: "border-[var(--color-warning)]",
  },
  checked_in: {
    selectedBg: "bg-[var(--color-success)]/15",
    selectedText: "text-[var(--color-success)]",
    selectedBorder: "border-[var(--color-success)]",
  },
  no_show: {
    selectedBg: "bg-[var(--color-danger)]/15",
    selectedText: "text-[var(--color-danger)]",
    selectedBorder: "border-[var(--color-danger)]",
  },
};

function segmentForBooking(b: BookingDetail): "not_yet" | "checked_in" | "no_show" | null {
  if (b.status === "NO_SHOW") return "no_show";
  if (b.status === "CONFIRMED") return b.checkedInAt ? "checked_in" : "not_yet";
  return null; // COMPLETED / CANCELLED — segment hidden
}

const segmentLabels: Record<string, string> = {
  VIP: "VIP",
  REGULAR: "常客",
  NEW: "新客",
  AT_RISK: "流失中",
  LAPSED: "已流失",
};

const segmentColors: Record<string, string> = {
  VIP: "bg-[var(--color-warning)]/15 text-[var(--color-warning)]",
  REGULAR: "bg-[var(--color-success)]/15 text-[var(--color-success)]",
  NEW: "bg-[var(--color-brand)]/10 text-[var(--color-brand)]",
  AT_RISK: "bg-[var(--color-warning)]/15 text-[var(--color-warning)]",
  LAPSED: "bg-[var(--color-danger)]/15 text-[var(--color-danger)]",
};

/// Shape of `/api/customers/[id]` slice we use here. Only fields the summary
/// card + accordion read — keeping it narrow makes the contract explicit and
/// stops drift if the customer page adds new fields later.
interface CustomerSummary {
  customer: {
    id: string;
    isVip: boolean;
    violationCount: number;
    bookingRestricted: boolean;
    notes: string | null;
    bookings: Array<{
      id: string;
      date: string;
      startTime: string;
      status: string;
      service: { name: string; price: number };
    }>;
  };
  stats: {
    totalRevenue: number;
    totalBookings: number;
  };
}

const customerFetcher = (url: string) =>
  fetch(url, { headers: adminHeaders() }).then((r) => {
    if (!r.ok) throw new Error("failed");
    return r.json() as Promise<CustomerSummary>;
  });

/// Asia/Taipei "YYYY/M/D" — historical bookings cross years so we always show year.
function formatYMD(dateStr: string): string {
  return new Date(dateStr)
    .toLocaleDateString("en-CA", {
      timeZone: "Asia/Taipei",
      year: "numeric",
      month: "numeric",
      day: "numeric",
    })
    .replace(/-/g, "/");
}

const BOOKING_STATUS_LABEL: Record<string, string> = {
  COMPLETED: "已完成",
  CONFIRMED: "已預約",
  CANCELLED: "已取消",
  CANCELLED_BY_ADMIN: "已取消",
  NO_SHOW: "爽約",
};

export function BookingDetailFullPage({ booking, open, onOpenChange, onAction }: Props) {
  const [subState, setSubState] = useState<SubState>("detail");
  const [loading, setLoading] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleTime, setRescheduleTime] = useState("");
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  // Optimistic local state: parent passes the booking it had at click time
  // and refreshes its list in the background, but the prop reference does
  // not change — so we maintain a local copy that we mutate after each
  // successful API call to keep segment + checkout button in sync without
  // requiring a sheet close/reopen.
  const [liveBooking, setLiveBooking] = useState<BookingDetail | null>(booking);
  const { toast } = useToast();

  // Re-seed live state only when the parent switches to a different booking
  // (e.g. closing this sheet and clicking another one). Listing `booking` in
  // deps would re-seed on every parent re-render and clobber in-sheet
  // optimistic updates from PATCH responses.
  useEffect(() => {
    setLiveBooking(booking);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booking?.id]);

  const view = liveBooking ?? booking;

  // Lazy-fetch customer summary (KPIs + recent bookings) only while the sheet
  // is open — keeps the calendar hot path light and dedupes re-opens via SWR
  // cache. Key=null shape ensures no request fires before the user clicks a
  // booking. Using a typed admin-aware fetcher (Bearer fallback for iOS PWA).
  const userId = view?.user?.id;
  const { data: customerData } = useSWR<CustomerSummary>(
    open && userId ? `/api/customers/${userId}` : null,
    customerFetcher,
  );

  if (!view) return null;

  const currentSegment = segmentForBooking(view);
  const isFinal = view.status === "COMPLETED" || view.status === "CANCELLED" || view.status === "CANCELLED_BY_ADMIN";

  /** Toggle 已報到 (per plan §C2: no confirm dialog — reversible). */
  const handleCheckin = async (desired: "checked_in" | "not_yet") => {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/bookings/${view.id}/checkin`, {
        method: "PATCH",
        headers: adminHeaders(),
        body: JSON.stringify({
          desired,
          ...(view.updatedAt ? { expectedUpdatedAt: view.updatedAt } : {}),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "報到失敗");
      }
      const data = await res.json();
      // Optimistic merge so segment + checkout button reflect the new state
      // immediately, without waiting for SWR list refetch + sheet reopen.
      setLiveBooking((prev) =>
        prev
          ? {
              ...prev,
              checkedInAt:
                typeof data.checkedInAt === "string"
                  ? data.checkedInAt
                  : data.checkedInAt === null
                    ? null
                    : prev.checkedInAt,
              updatedAt:
                typeof data.updatedAt === "string" ? data.updatedAt : prev.updatedAt,
            }
          : prev,
      );
      toast({ type: "success", message: desired === "checked_in" ? "已報到" : "改回尚未到來" });
      onAction();
    } catch (err) {
      toast({ type: "error", message: err instanceof Error ? err.message : "操作失敗" });
    } finally {
      setLoading(false);
    }
  };

  /** Acknowledge — same optimistic-update pattern as checkin (Codex P2,
   *  2026-04-27): without merging the response, the badge stays hidden and
   *  「我已確認知道」 stays visible until the sheet is reopened. */
  const handleAcknowledge = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/bookings/${view.id}/acknowledge`, {
        method: "POST",
        headers: adminHeaders(),
        body: JSON.stringify(
          view.updatedAt ? { expectedUpdatedAt: view.updatedAt } : {},
        ),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "確認失敗");
      }
      const data = await res.json();
      setLiveBooking((prev) =>
        prev
          ? {
              ...prev,
              adminAcknowledgedAt:
                typeof data.adminAcknowledgedAt === "string"
                  ? data.adminAcknowledgedAt
                  : new Date().toISOString(),
              updatedAt:
                typeof data.updatedAt === "string" ? data.updatedAt : prev.updatedAt,
            }
          : prev,
      );
      toast({ type: "success", message: "已確認" });
      onAction();
    } catch (err) {
      toast({ type: "error", message: err instanceof Error ? err.message : "確認失敗" });
    } finally {
      setLoading(false);
    }
  };

  /** Mark as 爽約 (per plan §C2: confirm dialog — irreversible, +1 violation). */
  const handleNoShow = async () => {
    if (loading) return;
    if (!confirm("確定標記為爽約？這會記一次違規，無法復原。")) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/bookings/${view.id}/no-show`, {
        method: "PATCH",
        headers: adminHeaders(),
        body: JSON.stringify(
          view.updatedAt ? { expectedUpdatedAt: view.updatedAt } : {},
        ),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "標記失敗");
      }
      toast({ type: "success", message: "已標記為爽約" });
      onOpenChange(false);
      onAction();
    } catch (err) {
      toast({ type: "error", message: err instanceof Error ? err.message : "操作失敗" });
    } finally {
      setLoading(false);
    }
  };

  /** Called by CheckoutFullPage after a successful POST /checkout. */
  const handleCheckoutComplete = () => {
    setCheckoutOpen(false);
    // Optimistically reflect the COMPLETED state so the user sees the
    // post-checkout note prompt instead of the segment briefly flipping.
    setLiveBooking((prev) =>
      prev
        ? {
            ...prev,
            status: "COMPLETED",
            checkedInAt: prev.checkedInAt ?? new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }
        : prev,
    );
    setSubState("notes");
    onAction();
  };

  const handleOpenReschedule = () => {
    setRescheduleDate(view.date.slice(0, 10));
    setRescheduleTime(view.startTime);
    setSubState("reschedule");
  };

  const handleConfirmReschedule = async () => {
    if (!rescheduleDate || !rescheduleTime) {
      toast({ type: "error", message: "請選擇新日期和時間" });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/bookings/${view.id}/reschedule`, {
        method: "POST",
        headers: adminHeaders(),
        body: JSON.stringify({ date: rescheduleDate, startTime: rescheduleTime }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "改期失敗");
      }
      toast({ type: "success", message: "預約已改期" });
      onOpenChange(false);
      onAction();
    } catch (err) {
      toast({ type: "error", message: err instanceof Error ? err.message : "改期失敗" });
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!confirm("確定要取消此預約？")) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/bookings/${view.id}`, {
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
        await fetch(`/api/customers/${view.user.id}`, {
          method: "PATCH",
          headers: adminHeaders(),
          body: JSON.stringify({
            notes: view.user.notes
              ? `${new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Taipei" })} ${noteText.trim()}\n${view.user.notes}`
              : `${new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Taipei" })} ${noteText.trim()}`,
          }),
        });
        toast({ type: "success", message: "筆記已儲存" });
      } catch {
        toast({ type: "error", message: "儲存失敗" });
      }
    }
    setNoteText("");
    setSubState("detail");
    onOpenChange(false);
    onAction();
  };

  const handleSkipNote = () => {
    setNoteText("");
    setSubState("detail");
    onOpenChange(false);
    onAction();
  };

  const handleClose = () => {
    setSubState("detail");
    setNoteText("");
    setCheckoutOpen(false);
    onOpenChange(false);
  };

  return (
    <>
      {open && (
        // FullscreenModal (跟 ExpenseEntrySheet / new-booking-sheet 同 pattern)。
        // preventDismiss：背景 / ESC 不關閉，唯一出口是左上 X 按鈕，避免老闆
        // 在編輯時不小心滑掉整張預約詳情。
        <FullscreenModal onClose={handleClose} preventDismiss>
          <div className="flex flex-col h-full">
            {/* Header bar with X close */}
            <div className="flex items-center justify-between px-5 pb-2 flex-shrink-0">
              <button
                onClick={() => onOpenChange(false)}
                aria-label="關閉"
                className="w-9 h-9 -ml-2 rounded-full flex items-center justify-center text-[var(--color-text-body)] hover:bg-[var(--color-surface)] transition-colors"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <path d="M6 6l12 12M6 18L18 6" />
                </svg>
              </button>
              <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">
                {subState === "reschedule" ? "改期" : subState === "notes" ? "順手記筆記" : "預約詳情"}
              </h2>
              <div className="w-9" />
            </div>

            <div className="flex-1 overflow-y-auto px-5 pb-8">
              {subState === "detail" && (
                <DetailView
                  booking={view}
                  customerData={customerData}
                  currentSegment={currentSegment}
                  isFinal={isFinal}
                  loading={loading}
                  onAcknowledge={handleAcknowledge}
                  onCheckin={handleCheckin}
                  onNoShow={handleNoShow}
                  onOpenCheckout={() => setCheckoutOpen(true)}
                  onOpenReschedule={handleOpenReschedule}
                  onCancel={handleCancel}
                />
              )}

              {subState === "notes" && (
                <NotesView
                  booking={view}
                  noteText={noteText}
                  onChange={setNoteText}
                  onSave={handleSaveNote}
                  onSkip={handleSkipNote}
                />
              )}

              {subState === "reschedule" && (
                <RescheduleView
                  booking={view}
                  date={rescheduleDate}
                  time={rescheduleTime}
                  loading={loading}
                  onDateChange={setRescheduleDate}
                  onTimeChange={setRescheduleTime}
                  onCancel={() => setSubState("detail")}
                  onConfirm={handleConfirmReschedule}
                />
              )}
            </div>
          </div>
        </FullscreenModal>
      )}

      {/* Checkout flow — opens as a nested full-page sheet on top of detail. */}
      <CheckoutFullPage
        booking={view}
        open={checkoutOpen}
        onOpenChange={setCheckoutOpen}
        onCompleted={handleCheckoutComplete}
      />
    </>
  );
}

function DetailView({
  booking,
  customerData,
  currentSegment,
  isFinal,
  loading,
  onAcknowledge,
  onCheckin,
  onNoShow,
  onOpenCheckout,
  onOpenReschedule,
  onCancel,
}: {
  booking: BookingDetail;
  customerData: CustomerSummary | undefined;
  currentSegment: ReturnType<typeof segmentForBooking>;
  isFinal: boolean;
  loading: boolean;
  onAcknowledge: () => void;
  onCheckin: (desired: "checked_in" | "not_yet") => void;
  onNoShow: () => void;
  onOpenCheckout: () => void;
  onOpenReschedule: () => void;
  onCancel: () => void;
}) {
  const showCheckout = currentSegment === "checked_in";
  const stats = customerData?.stats;
  const customer = customerData?.customer;
  const recentBookings = (customer?.bookings ?? []).slice(0, 5);

  return (
    <>
      {/* Customer summary card — name + tags + service info + KPI row +
          jump-to-full-profile button. Replaces the old 3-block header so the
          admin sees revenue / visit / last-visit at a glance without leaving
          the calendar. Full notes + recent bookings live in the accordion at
          the bottom of the sheet. */}
      <div className="mb-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
              <h2 className="text-lg font-bold text-[var(--color-text-primary)] truncate">
                {booking.user.displayName || "顧客"}
              </h2>
              <span
                className={`shrink-0 px-2 py-0.5 rounded text-[10px] font-medium tracking-wider ${segmentColors[booking.user.segment] || segmentColors.NEW}`}
              >
                {segmentLabels[booking.user.segment] || booking.user.segment}
              </span>
              {customer?.isVip && (
                <span className="shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-[var(--color-warning)]/15 text-[var(--color-warning)]">
                  <Crown size={10} aria-hidden /> VIP
                </span>
              )}
              {customer?.bookingRestricted && (
                <span className="shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-[var(--color-danger)]/15 text-[var(--color-danger)]">
                  <AlertTriangle size={10} aria-hidden /> 限制中
                </span>
              )}
            </div>
            <p className="text-sm text-[var(--color-text-body)]">
              {booking.service.name} · NT${booking.service.price.toLocaleString()}
            </p>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
              {booking.startTime} — {booking.endTime}
            </p>
          </div>
          <Link
            href={`/customers/${booking.user.id}?from=booking`}
            className="shrink-0 inline-flex items-center gap-0.5 text-[11px] text-[var(--color-brand)] hover:underline whitespace-nowrap"
          >
            完整檔案
            <ChevronRight size={12} aria-hidden />
          </Link>
        </div>

        {/* KPI row — totals come from /api/customers/[id]; visits / last
            visit fall back to the embedded booking.user (always present). */}
        <div className="grid grid-cols-3 gap-2 bg-[var(--color-surface)] rounded-lg p-3">
          <div className="text-center">
            <p className="text-[10px] text-[var(--color-text-muted)] tracking-wider mb-0.5">
              總消費
            </p>
            <p className="text-sm font-bold text-[var(--color-text-primary)]">
              {stats ? `NT$${stats.totalRevenue.toLocaleString()}` : "—"}
            </p>
          </div>
          <div className="text-center border-x border-[var(--color-text-muted)]/15">
            <p className="text-[10px] text-[var(--color-text-muted)] tracking-wider mb-0.5">
              來訪
            </p>
            <p className="text-sm font-bold text-[var(--color-text-primary)]">
              {booking.user.totalVisits} 次
            </p>
          </div>
          <div className="text-center">
            <p className="text-[10px] text-[var(--color-text-muted)] tracking-wider mb-0.5">
              上次
            </p>
            <p className="text-sm font-bold text-[var(--color-text-primary)]">
              {booking.user.lastVisitAt
                ? new Date(booking.user.lastVisitAt).toLocaleDateString("zh-TW", {
                    month: "numeric",
                    day: "numeric",
                  })
                : "—"}
            </p>
          </div>
        </div>
      </div>

      {/* Status segment — only when booking is in an actionable state.
          Each state has its own colour so the current state is unmistakable
          even at a glance: amber=pending, green=done, red=no-show. The
          selected button gets a thick coloured frame so the active state
          reads from across the room. */}
      {currentSegment && (
        <div className="mb-4">
          <p className="text-[10px] font-medium text-[var(--color-text-muted)] tracking-wider mb-1.5">
            狀態
          </p>
          <div className="grid grid-cols-3 gap-2">
            {SEGMENT.map((s) => {
              const selected = currentSegment === s.key;
              const styles = SEGMENT_STYLES[s.key];
              return (
                <button
                  key={s.key}
                  disabled={loading || (currentSegment === "no_show" && !selected)}
                  onClick={() => {
                    if (s.key === "checked_in") onCheckin("checked_in");
                    else if (s.key === "not_yet") onCheckin("not_yet");
                    else if (s.key === "no_show") onNoShow();
                  }}
                  className={`py-3 text-sm font-bold rounded-lg border-2 transition-all ${
                    selected
                      ? `${styles.selectedBg} ${styles.selectedText} ${styles.selectedBorder} shadow-sm`
                      : "bg-[var(--color-surface)] text-[var(--color-text-muted)] border-transparent hover:text-[var(--color-text-body)]"
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
          {currentSegment === "no_show" && (
            <p className="text-[11px] text-[var(--color-danger)] mt-1.5">
              此預約已標記為爽約，無法復原。如需更正請使用客戶管理頁。
            </p>
          )}
        </div>
      )}

      {/* Acknowledge button — calls parent handler so liveBooking gets the
          merged response (otherwise the badge stays hidden until the sheet
          is reopened — Codex P2 fix, 2026-04-27). */}
      {booking.status === "CONFIRMED" && !booking.adminAcknowledgedAt && (
        <button
          onClick={onAcknowledge}
          disabled={loading}
          className="w-full mb-3 py-3 bg-[var(--color-brand)]/10 border border-[var(--color-brand)] text-[var(--color-brand)] font-semibold rounded-lg text-sm hover:bg-[var(--color-brand)]/20 transition-colors disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
        >
          <Check size={16} aria-hidden /> 我已確認知道
        </button>
      )}

      {booking.adminAcknowledgedAt && booking.status === "CONFIRMED" && (
        <p className="text-xs text-[var(--color-success)] mb-3 flex items-center gap-1">
          <Check size={14} aria-hidden /> 已確認 ·{" "}
          {new Date(booking.adminAcknowledgedAt).toLocaleString("zh-TW", {
            month: "numeric",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      )}

      {/* Primary money action — only when 已報到 (auto-checkin happens server-side
          if admin clicks while still 尚未到來; we still hide here per plan §C1
          for visual cleanliness — the auto-checkin path is for safety). */}
      {showCheckout && (
        <button
          onClick={onOpenCheckout}
          disabled={loading}
          className="w-full py-3.5 bg-[var(--color-brand)] text-[var(--color-bg)] font-semibold rounded-lg text-sm hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2 mb-3"
        >
          <Coins size={16} aria-hidden />
          進行結帳
        </button>
      )}

      {/* Final-state pill */}
      {isFinal && (
        <div className="text-center py-3 mb-3 rounded-lg bg-[var(--color-surface)]">
          <span className="text-sm text-[var(--color-text-muted)]">
            {booking.status === "COMPLETED" ? "已完成" : "已取消"}
          </span>
        </div>
      )}

      {/* Secondary actions — reschedule + cancel for active bookings */}
      {booking.status === "CONFIRMED" && (
        <div className="grid grid-cols-2 gap-2 mt-2">
          <button
            onClick={onOpenReschedule}
            disabled={loading}
            className="py-2.5 border border-[var(--color-text-muted)]/30 text-[var(--color-text-body)] rounded-lg text-xs font-medium hover:bg-[var(--color-surface)] transition-colors disabled:opacity-50"
          >
            改時間
          </button>
          <button
            onClick={onCancel}
            disabled={loading}
            className="py-2.5 border border-[var(--color-danger)] text-[var(--color-danger)] rounded-lg text-xs font-medium hover:bg-[var(--color-danger)]/5 transition-colors disabled:opacity-50"
          >
            取消預約
          </button>
        </div>
      )}

      {/* Customer history accordion — recent bookings + full notes + violations.
          Native <details> avoids pulling in a new component dep. The chevron
          rotates via group-open utility. */}
      <details className="mt-4 group rounded-lg bg-[var(--color-surface)] [&>summary]:list-none">
        <summary className="flex items-center justify-between px-3 py-2.5 cursor-pointer">
          <span className="text-xs font-medium text-[var(--color-text-body)]">
            最近預約與備註
          </span>
          <ChevronRight
            size={14}
            aria-hidden
            className="text-[var(--color-text-muted)] transition-transform group-open:rotate-90"
          />
        </summary>
        <div className="px-3 pb-3 space-y-3 border-t border-[var(--color-text-muted)]/10 pt-3">
          {(customer?.notes ?? booking.user.notes) && (
            <div>
              <p className="text-[10px] font-medium text-[var(--color-text-muted)] tracking-wider mb-1">
                備註
              </p>
              <p className="text-sm text-[var(--color-text-body)] whitespace-pre-line">
                {customer?.notes ?? booking.user.notes}
              </p>
            </div>
          )}
          {customer && customer.violationCount > 0 && (
            <p className="text-[11px] text-[var(--color-danger)]">
              違規 {customer.violationCount} 次
            </p>
          )}
          <div>
            <p className="text-[10px] font-medium text-[var(--color-text-muted)] tracking-wider mb-1.5">
              最近 5 筆預約
            </p>
            {customer ? (
              recentBookings.length === 0 ? (
                <p className="text-xs text-[var(--color-text-muted)]">無紀錄</p>
              ) : (
                <ul className="space-y-1.5">
                  {recentBookings.map((b) => (
                    <li
                      key={b.id}
                      className="flex items-center justify-between gap-2 text-xs"
                    >
                      <span className="text-[var(--color-text-body)] truncate">
                        {formatYMD(b.date)} · {b.service.name}
                      </span>
                      <span className="shrink-0 text-[var(--color-text-muted)]">
                        {BOOKING_STATUS_LABEL[b.status] ?? b.status} · NT$
                        {b.service.price.toLocaleString()}
                      </span>
                    </li>
                  ))}
                </ul>
              )
            ) : (
              <p className="text-xs text-[var(--color-text-muted)]">載入中…</p>
            )}
          </div>
        </div>
      </details>
    </>
  );
}

function NotesView({
  booking,
  noteText,
  onChange,
  onSave,
  onSkip,
}: {
  booking: BookingDetail;
  noteText: string;
  onChange: (s: string) => void;
  onSave: () => void;
  onSkip: () => void;
}) {
  return (
    <>
      <div className="text-center mb-4">
        <div className="w-12 h-12 rounded-full bg-[var(--color-success)]/15 flex items-center justify-center mx-auto mb-2">
          <svg
            className="w-6 h-6 text-[var(--color-success)]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-base font-bold text-[var(--color-text-primary)]">預約已完成！</h2>
        <p className="text-sm text-[var(--color-text-body)]">
          {booking.user.displayName} — {booking.service.name}
        </p>
      </div>

      <div className="mb-3">
        <p className="text-xs font-medium text-[var(--color-text-muted)] tracking-wider mb-2">
          順手記一下
        </p>
        <textarea
          value={noteText}
          onChange={(e) => onChange(e.target.value)}
          placeholder="今天的服務筆記..."
          rows={4}
          className="w-full bg-[var(--color-surface)] rounded-lg p-3 text-sm text-[var(--color-text-body)] placeholder:text-[var(--color-text-disabled)] outline-none resize-none"
        />
      </div>

      {booking.user.notes && (
        <p className="text-xs text-[var(--color-text-muted)] italic mb-4 line-clamp-2">
          上次筆記: {booking.user.notes.split("\n")[0]}
        </p>
      )}

      <div className="flex items-center justify-between gap-3">
        <button onClick={onSkip} className="text-sm text-[var(--color-text-muted)]">
          跳過
        </button>
        <button
          onClick={onSave}
          className="px-6 py-2.5 bg-[var(--color-brand)] text-[var(--color-bg)] font-semibold rounded-lg text-sm hover:opacity-90 transition-opacity"
        >
          儲存筆記
        </button>
      </div>
    </>
  );
}

function RescheduleView({
  booking,
  date,
  time,
  loading,
  onDateChange,
  onTimeChange,
  onCancel,
  onConfirm,
}: {
  booking: BookingDetail;
  date: string;
  time: string;
  loading: boolean;
  onDateChange: (s: string) => void;
  onTimeChange: (s: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <>
      <p className="text-xs text-[var(--color-text-muted)] mb-4">
        {booking.user.displayName} · {booking.service.name} · {booking.service.slotsNeeded} 小時
      </p>

      <div className="mb-3">
        <label className="text-[10px] font-medium text-[var(--color-text-muted)] tracking-wider block mb-1">
          新日期
        </label>
        <input
          type="date"
          value={date}
          onChange={(e) => onDateChange(e.target.value)}
          className="w-full border-b border-[var(--color-brand)] bg-transparent py-2 text-sm text-[var(--color-text-body)] outline-none"
        />
      </div>

      <div className="mb-6">
        <label className="text-[10px] font-medium text-[var(--color-text-muted)] tracking-wider block mb-1">
          新時段（11:00 - 19:00）
        </label>
        <select
          value={time}
          onChange={(e) => onTimeChange(e.target.value)}
          className="w-full border-b border-[var(--color-brand)] bg-transparent py-2 text-sm text-[var(--color-text-body)] outline-none"
        >
          {Array.from({ length: 9 }, (_, i) => {
            const hour = 11 + i;
            const t = `${String(hour).padStart(2, "0")}:00`;
            return (
              <option key={t} value={t}>
                {t}
              </option>
            );
          })}
        </select>
      </div>

      <p className="text-[11px] text-[var(--color-text-muted)] mb-4">
        改期會檢查時段是否可用 + 重置「我已知道」狀態 + 通知客戶 LINE。
      </p>

      <div className="flex items-center justify-between gap-3">
        <button
          onClick={onCancel}
          disabled={loading}
          className="text-sm text-[var(--color-text-muted)] disabled:opacity-50"
        >
          返回
        </button>
        <button
          onClick={onConfirm}
          disabled={loading || !date || !time}
          className="px-6 py-2.5 bg-[var(--color-brand)] text-[var(--color-bg)] font-semibold rounded-lg text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {loading ? "改期中..." : "確認改期"}
        </button>
      </div>
    </>
  );
}

export type { PaymentMethod };
