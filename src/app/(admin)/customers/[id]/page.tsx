"use client";

import { useState, use } from "react";
import Link from "next/link";
import { usePageTitle } from "@/lib/hooks/use-page-title";
import useSWR from "swr";
import { ChevronLeft, Plus, Phone, Cake, Pencil, X } from "lucide-react";
import { useToast } from "@/components/ui/toast";

/** V3.7 §E — payment history row from /api/customers/[id] response */
interface PaymentRow {
  id: string;
  bookingId: string;
  amount: number;
  method: "CASH" | "BANK_TRANSFER" | "CREDIT_CARD" | string;
  status: "PENDING" | "VERIFYING" | "RECEIVED" | "WAIVED" | string;
  transferLastFive: string | null;
  verifiedAt: string | null;
  receivedAt: string | null;
  notes: string | null;
  createdAt: string;
  bookingDate: string | null;
  bookingStartTime: string | null;
  serviceName: string | null;
}

interface CustomerDetail {
  id: string;
  displayName: string | null;
  realName: string | null;
  phone: string | null;
  gender: "MALE" | "FEMALE" | "OTHER" | "PREFER_NOT_TO_SAY" | null;
  segment: string;
  isVip: boolean;
  violationCount: number;
  bookingRestricted: boolean;
  totalVisits: number;
  lastVisitAt: string | null;
  firstVisitAt: string | null;
  birthday: string | null;
  notes: string | null;
  bookings: Array<{
    id: string;
    date: string;
    startTime: string;
    status: string;
    service: { name: string; price: number };
  }>;
}

interface Stats {
  totalBookings: number;
  statusCounts: Record<string, number>;
  totalRevenue: number;
  avgPrice: number | null;
  avgIntervalDays: number | null;
}

const GENDER_LABEL: Record<string, string> = {
  MALE: "男",
  FEMALE: "女",
  OTHER: "其他",
  PREFER_NOT_TO_SAY: "—",
};

function formatRelativeDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return "今天";
  if (days === 1) return "昨天";
  if (days < 30) return `${days} 天前`;
  if (days < 365) return `${Math.floor(days / 30)} 個月前`;
  return `${Math.floor(days / 365)} 年前`;
}

const SEGMENT_STYLE: Record<string, string> = {
  VIP: "bg-[var(--color-warning)]/15 text-[var(--color-warning)]",
  REGULAR: "bg-[var(--color-success)]/15 text-[var(--color-success)]",
  NEW: "bg-[var(--color-brand)]/10 text-[var(--color-brand)]",
  AT_RISK: "bg-[var(--color-warning)]/15 text-[var(--color-warning)]",
  LAPSED: "bg-[var(--color-danger)]/15 text-[var(--color-danger)]",
};

const SEGMENT_LABEL: Record<string, string> = {
  VIP: "VIP", REGULAR: "常客", NEW: "新客", AT_RISK: "流失中", LAPSED: "已流失",
};

const STATUS_ICON: Record<string, string> = {
  COMPLETED: "✅", CONFIRMED: "🔵", CANCELLED: "❌", NO_SHOW: "⚠️",
};

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  usePageTitle("顧客詳情");
  const { toast } = useToast();
  const [newNote, setNewNote] = useState("");
  const [addingNote, setAddingNote] = useState(false);

  const { data, mutate } = useSWR(`/api/customers/${id}`, fetcher);
  const customer: CustomerDetail | null = data?.customer || null;
  const stats: Stats | null = data?.stats || null;
  const payments: PaymentRow[] = data?.payments || [];

  // V3.7 §E — correction modal state. paymentId == null means closed.
  const [correctionPaymentId, setCorrectionPaymentId] = useState<string | null>(null);
  const [correctionReason, setCorrectionReason] = useState("");
  const [savingCorrection, setSavingCorrection] = useState(false);

  if (!customer) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-6 h-6 border-2 border-[var(--color-brand)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const name = customer.displayName || customer.realName || "未知";
  const totalRevenue = stats?.totalRevenue ?? customer.bookings
    .filter((b) => b.status === "COMPLETED")
    .reduce((sum, b) => sum + (b.service?.price || 0), 0);
  const completedCount = stats?.statusCounts?.COMPLETED ?? 0;
  const noShowCount = stats?.statusCounts?.NO_SHOW ?? 0;
  const cancelledCount =
    (stats?.statusCounts?.CANCELLED ?? 0) +
    (stats?.statusCounts?.CANCELLED_BY_ADMIN ?? 0);
  const upcomingCount = stats?.statusCounts?.CONFIRMED ?? 0;
  const totalBookings = stats?.totalBookings ?? 0;
  const attendanceRate =
    completedCount + noShowCount > 0
      ? Math.round((completedCount / (completedCount + noShowCount)) * 100)
      : null;
  const avgPrice = stats?.avgPrice ?? null;
  const avgIntervalDays = stats?.avgIntervalDays ?? null;

  // Parse notes into timeline entries
  const noteEntries = (customer.notes || "")
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => {
      const match = line.match(/^(\d{4}-\d{2}-\d{2})\s+(.+)$/);
      if (match) return { date: match[1], text: match[2] };
      return { date: "", text: line };
    });

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    const dateStr = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Taipei" });
    const updatedNotes = customer.notes
      ? `${dateStr} ${newNote.trim()}\n${customer.notes}`
      : `${dateStr} ${newNote.trim()}`;

    try {
      await fetch(`/api/customers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: updatedNotes }),
      });
      toast({ type: "success", message: "筆記已儲存" });
      setNewNote("");
      setAddingNote(false);
      mutate();
    } catch {
      toast({ type: "error", message: "儲存失敗" });
    }
  };

  const submitCorrection = async () => {
    if (!correctionPaymentId || !correctionReason.trim()) return;
    setSavingCorrection(true);
    try {
      const res = await fetch(`/api/payment-notes/${correctionPaymentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: correctionReason.trim() }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({} as { error?: string }));
        throw new Error(err.error || "儲存失敗");
      }
      toast({ type: "success", message: "修正已記錄" });
      setCorrectionPaymentId(null);
      setCorrectionReason("");
      mutate();
    } catch (e) {
      toast({ type: "error", message: e instanceof Error ? e.message : "儲存失敗" });
    } finally {
      setSavingCorrection(false);
    }
  };

  const handleClearViolations = async () => {
    if (!confirm("確定要清除所有違規紀錄？")) return;
    try {
      await fetch(`/api/customers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ violationCount: 0, bookingRestricted: false, restrictedUntil: null }),
      });
      toast({ type: "success", message: "違規已清除" });
      mutate();
    } catch {
      toast({ type: "error", message: "操作失敗" });
    }
  };

  return (
    <div className="max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <Link href="/customers" className="p-1.5 rounded-lg hover:bg-[var(--color-surface)]">
          <ChevronLeft size={20} className="text-[var(--color-text-body)]" />
        </Link>
        <h1 className="text-lg font-bold text-[var(--color-text-primary)] truncate">
          {name}
        </h1>
        <span className={`shrink-0 px-2 py-0.5 rounded text-[10px] font-medium tracking-wider ${SEGMENT_STYLE[customer.segment] || SEGMENT_STYLE.NEW}`}>
          {SEGMENT_LABEL[customer.segment] || customer.segment}
        </span>
      </div>

      {/* Profile Card — 基本資料 */}
      <div className="bg-[var(--color-surface)] rounded-xl p-4 mb-3">
        <p className="text-[10px] text-[var(--color-text-muted)] tracking-wider mb-2">基本資料</p>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <p className="text-[10px] text-[var(--color-text-muted)]">本名</p>
            <p className="text-[var(--color-text-body)]">{customer.realName || "—"}</p>
          </div>
          <div>
            <p className="text-[10px] text-[var(--color-text-muted)]">性別</p>
            <p className="text-[var(--color-text-body)]">
              {customer.gender ? GENDER_LABEL[customer.gender] : "—"}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-[var(--color-text-muted)]">手機</p>
            {customer.phone ? (
              <a href={`tel:${customer.phone}`} className="flex items-center gap-1 text-[var(--color-brand)]">
                <Phone size={12} strokeWidth={1.5} />
                {customer.phone}
              </a>
            ) : (
              <p className="text-[var(--color-text-disabled)]">—</p>
            )}
          </div>
          <div>
            <p className="text-[10px] text-[var(--color-text-muted)]">生日</p>
            {customer.birthday ? (
              <p className="flex items-center gap-1 text-[var(--color-text-body)]">
                <Cake size={12} strokeWidth={1.5} />
                {customer.birthday.split("T")[0]}
              </p>
            ) : (
              <p className="text-[var(--color-text-disabled)]">—</p>
            )}
          </div>
        </div>
      </div>

      {/* Stats Card — 消費數據 (6 指標) */}
      <div className="bg-[var(--color-surface)] rounded-xl p-4 mb-4">
        <p className="text-[10px] text-[var(--color-text-muted)] tracking-wider mb-3">消費數據</p>
        <div className="grid grid-cols-3 gap-y-3 gap-x-2">
          <div>
            <p className="text-base font-bold text-[var(--color-text-primary)]">{customer.totalVisits}</p>
            <p className="text-[10px] text-[var(--color-text-muted)]">總來訪次數</p>
          </div>
          <div>
            <p className="text-base font-bold text-[var(--color-text-primary)]">
              NT${totalRevenue.toLocaleString()}
            </p>
            <p className="text-[10px] text-[var(--color-text-muted)]">總消費</p>
          </div>
          <div>
            <p className="text-base font-bold text-[var(--color-text-primary)]">
              {avgPrice !== null ? `NT$${avgPrice.toLocaleString()}` : "—"}
            </p>
            <p className="text-[10px] text-[var(--color-text-muted)]">平均消費</p>
          </div>
          <div>
            <p className="text-base font-bold text-[var(--color-text-primary)]">
              {formatRelativeDate(customer.lastVisitAt)}
            </p>
            <p className="text-[10px] text-[var(--color-text-muted)]">最近回訪</p>
          </div>
          <div>
            <p className="text-base font-bold text-[var(--color-text-primary)]">
              {avgIntervalDays !== null ? `${avgIntervalDays} 天` : "—"}
            </p>
            <p className="text-[10px] text-[var(--color-text-muted)]">平均回訪間隔</p>
          </div>
          <div>
            <p className="text-base font-bold text-[var(--color-text-primary)]">
              {attendanceRate !== null ? `${attendanceRate}%` : "—"}
            </p>
            <p className="text-[10px] text-[var(--color-text-muted)]">出席率</p>
          </div>
        </div>
        {totalBookings > 0 && (
          <div className="mt-3 pt-3 border-t border-[var(--color-text-disabled)]/30">
            <p className="text-[10px] text-[var(--color-text-muted)] mb-1">出席狀況（總預約 {totalBookings} 次）</p>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
              <span className="text-[var(--color-text-body)]">✅ 完成 {completedCount}</span>
              {upcomingCount > 0 && <span className="text-[var(--color-brand)]">🔵 即將 {upcomingCount}</span>}
              {noShowCount > 0 && <span className="text-[var(--color-warning)]">⚠️ 未到 {noShowCount}</span>}
              {cancelledCount > 0 && <span className="text-[var(--color-text-muted)]">❌ 取消 {cancelledCount}</span>}
            </div>
          </div>
        )}
      </div>

      {/* V3.7 §E — Payment history. Last-5 transfer locked, "修正" appends to notes. */}
      {payments.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-medium text-[var(--color-text-muted)] tracking-wider mb-2">
            付款記錄（{payments.length}）
          </p>
          <div className="bg-[var(--color-surface)] rounded-xl divide-y divide-[var(--color-text-disabled)]/20">
            {payments.slice(0, 12).map((p) => (
              <PaymentRowItem
                key={p.id}
                payment={p}
                onEdit={() => {
                  setCorrectionPaymentId(p.id);
                  setCorrectionReason("");
                }}
              />
            ))}
            {payments.length > 12 && (
              <p className="text-[10px] text-[var(--color-text-muted)] text-center py-2">
                共 {payments.length} 筆，僅顯示最新 12 筆
              </p>
            )}
          </div>
        </div>
      )}

      {/* Notes (Timeline) */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-medium text-[var(--color-text-muted)] tracking-wider">備註</p>
          <button
            onClick={() => setAddingNote(!addingNote)}
            className="flex items-center gap-1 text-xs text-[var(--color-brand)] font-medium"
          >
            <Plus size={14} />
            新增
          </button>
        </div>

        {addingNote && (
          <div className="mb-3">
            <textarea
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="輸入筆記..."
              rows={2}
              className="w-full bg-[var(--color-surface)] rounded-lg p-3 text-sm text-[var(--color-text-body)] placeholder:text-[var(--color-text-disabled)] outline-none resize-none mb-2"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => { setAddingNote(false); setNewNote(""); }} className="text-xs text-[var(--color-text-muted)]">取消</button>
              <button onClick={handleAddNote} className="text-xs font-medium text-[var(--color-brand)]">儲存</button>
            </div>
          </div>
        )}

        {noteEntries.length > 0 ? (
          <div className="bg-[var(--color-surface)] rounded-xl p-4 space-y-3">
            {noteEntries.map((entry, i) => (
              <div key={i} className="flex gap-3">
                {/* Timeline dot + line */}
                <div className="flex flex-col items-center shrink-0">
                  <div className="w-2 h-2 rounded-full bg-[var(--color-brand)] mt-1.5" />
                  {i < noteEntries.length - 1 && <div className="w-0.5 flex-1 bg-[var(--color-brand)]/20 mt-1" />}
                </div>
                <div className="min-w-0">
                  {entry.date && (
                    <p className="text-[10px] text-[var(--color-text-muted)] mb-0.5">{entry.date}</p>
                  )}
                  <p className="text-sm text-[var(--color-text-body)]">{entry.text}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[var(--color-text-muted)] text-center py-4">尚無備註</p>
        )}
      </div>

      {/* Booking History */}
      <div className="mb-4">
        <p className="text-xs font-medium text-[var(--color-text-muted)] tracking-wider mb-2">預約歷史</p>
        {customer.bookings.length > 0 ? (
          <div className="space-y-1">
            {customer.bookings.slice(0, 10).map((b) => (
              <div key={b.id} className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-[var(--color-surface)] transition-colors">
                <div className="flex items-center gap-2">
                  <span className="text-xs">{STATUS_ICON[b.status] || "🔵"}</span>
                  <span className="text-sm text-[var(--color-text-body)]">
                    {new Date(b.date).toLocaleDateString("zh-TW", { month: "numeric", day: "numeric" })}
                  </span>
                  <span className="text-sm text-[var(--color-text-muted)]">{b.service.name}</span>
                </div>
                <span className="text-sm text-[var(--color-text-body)]">NT${b.service.price.toLocaleString()}</span>
              </div>
            ))}
            {customer.bookings.length > 10 && (
              <p className="text-xs text-[var(--color-text-muted)] text-center py-2">
                共 {customer.bookings.length} 筆
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-[var(--color-text-muted)] text-center py-4">尚無預約</p>
        )}
      </div>

      {/* Violations */}
      <div className="flex items-center justify-between px-3 py-3 bg-[var(--color-surface)] rounded-xl">
        <span className={`text-sm ${customer.violationCount > 0 ? "text-[var(--color-danger)]" : "text-[var(--color-text-body)]"}`}>
          違規紀錄: {customer.violationCount} 次
          {customer.bookingRestricted && " (已限制)"}
        </span>
        {customer.violationCount > 0 && (
          <button
            onClick={handleClearViolations}
            className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-body)]"
          >
            清除違規
          </button>
        )}
      </div>

      {/* V3.7 §E — Correction modal. Locked transferLastFive shown read-only; the
       * reason text gets appended to Payment.notes (audit trail preserved). */}
      {correctionPaymentId && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4"
          onClick={() => !savingCorrection && setCorrectionPaymentId(null)}
        >
          <div
            className="w-full max-w-md bg-[var(--color-bg)] rounded-t-2xl sm:rounded-2xl p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-base font-bold text-[var(--color-text-primary)]">付款修正記錄</p>
              <button
                onClick={() => setCorrectionPaymentId(null)}
                disabled={savingCorrection}
                className="p-1 rounded hover:bg-[var(--color-surface)]"
              >
                <X size={18} className="text-[var(--color-text-muted)]" />
              </button>
            </div>
            <p className="text-[11px] text-[var(--color-text-muted)] leading-relaxed mb-3">
              原始末五碼會保留（不可改），您填的修正原因會以時間戳方式追加到付款備註，做為對帳憑證。
            </p>
            <textarea
              value={correctionReason}
              onChange={(e) => setCorrectionReason(e.target.value)}
              placeholder="例：客戶誤輸入末五，實際為 67890"
              rows={3}
              maxLength={500}
              className="w-full bg-[var(--color-surface)] rounded-lg p-3 text-sm text-[var(--color-text-body)] placeholder:text-[var(--color-text-disabled)] outline-none resize-none mb-3"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setCorrectionPaymentId(null)}
                disabled={savingCorrection}
                className="px-4 py-2 rounded-lg text-sm text-[var(--color-text-muted)]"
              >
                取消
              </button>
              <button
                onClick={submitCorrection}
                disabled={savingCorrection || !correctionReason.trim()}
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-[var(--color-brand)] text-[var(--color-bg)] disabled:opacity-40"
              >
                {savingCorrection ? "儲存中…" : "儲存修正"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const PAYMENT_STATUS_LABEL: Record<string, { label: string; tone: string }> = {
  PENDING: { label: "待付", tone: "text-[var(--color-text-muted)]" },
  VERIFYING: { label: "對帳中", tone: "text-[var(--color-warning)]" },
  RECEIVED: { label: "已收款", tone: "text-[var(--color-success)]" },
  WAIVED: { label: "免收", tone: "text-[var(--color-text-muted)]" },
};

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  CASH: "現金",
  BANK_TRANSFER: "轉帳",
  CREDIT_CARD: "刷卡",
};

function PaymentRowItem({
  payment,
  onEdit,
}: {
  payment: PaymentRow;
  onEdit: () => void;
}) {
  const status = PAYMENT_STATUS_LABEL[payment.status] ?? {
    label: payment.status,
    tone: "text-[var(--color-text-muted)]",
  };
  const dateAnchor = payment.receivedAt ?? payment.verifiedAt ?? payment.createdAt;
  const dateLabel = dateAnchor
    ? new Date(dateAnchor).toLocaleDateString("zh-TW", {
        timeZone: "Asia/Taipei",
        month: "numeric",
        day: "numeric",
      })
    : "—";
  const correctionLines = (payment.notes ?? "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

  return (
    <div className="px-4 py-3">
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-[var(--color-text-muted)] tabular-nums shrink-0 w-12">
          {dateLabel}
        </span>
        <span className="text-sm text-[var(--color-text-primary)] flex-1 truncate">
          {payment.serviceName ?? "—"}
        </span>
        <span className="text-sm font-semibold tabular-nums text-[var(--color-text-primary)]">
          NT${payment.amount.toLocaleString()}
        </span>
      </div>
      <div className="flex items-center gap-2 mt-1.5 text-[11px]">
        <span className="text-[var(--color-text-muted)]">
          {PAYMENT_METHOD_LABEL[payment.method] ?? payment.method}
        </span>
        {payment.transferLastFive && (
          <span className="font-mono tabular-nums text-[var(--color-text-body)]">
            末五·{payment.transferLastFive}
          </span>
        )}
        <span className={`${status.tone} font-medium`}>{status.label}</span>
        <button
          onClick={onEdit}
          className="ml-auto inline-flex items-center gap-0.5 text-[var(--color-brand)] hover:opacity-80"
        >
          <Pencil size={11} strokeWidth={1.5} />
          修正
        </button>
      </div>
      {correctionLines.length > 0 && (
        <div className="mt-2 pl-2 border-l-2 border-[var(--color-warning)]/40 space-y-0.5">
          {correctionLines.map((line, i) => (
            <p
              key={i}
              className="text-[10px] text-[var(--color-text-muted)] leading-snug"
            >
              {line}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
