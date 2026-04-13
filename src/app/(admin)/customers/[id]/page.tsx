"use client";

import { useState, use } from "react";
import Link from "next/link";
import { usePageTitle } from "@/lib/hooks/use-page-title";
import useSWR from "swr";
import { ChevronLeft, Plus, Phone, Cake } from "lucide-react";
import { useToast } from "@/components/ui/toast";

interface CustomerDetail {
  id: string;
  displayName: string | null;
  realName: string | null;
  phone: string | null;
  segment: string;
  isVip: boolean;
  violationCount: number;
  bookingRestricted: boolean;
  totalVisits: number;
  lastVisitAt: string | null;
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

  if (!customer) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-6 h-6 border-2 border-[var(--color-brand)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const name = customer.displayName || customer.realName || "未知";
  const totalRevenue = customer.bookings
    .filter((b) => b.status === "COMPLETED")
    .reduce((sum, b) => sum + (b.service?.price || 0), 0);

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

      {/* Stats Card */}
      <div className="bg-[var(--color-surface)] rounded-xl p-4 mb-4">
        <div className="flex items-center justify-between mb-2">
          <div className="text-center flex-1">
            <p className="text-lg font-bold text-[var(--color-text-primary)]">{customer.totalVisits}</p>
            <p className="text-[10px] text-[var(--color-text-muted)]">來訪</p>
          </div>
          <div className="w-px h-8 bg-[var(--color-text-disabled)]" />
          <div className="text-center flex-1">
            <p className="text-lg font-bold text-[var(--color-text-primary)]">NT${totalRevenue.toLocaleString()}</p>
            <p className="text-[10px] text-[var(--color-text-muted)]">總消費</p>
          </div>
        </div>
        {customer.phone && (
          <a href={`tel:${customer.phone}`} className="flex items-center gap-1.5 text-sm text-[var(--color-brand)] mt-2">
            <Phone size={14} strokeWidth={1.5} />
            {customer.phone}
          </a>
        )}
        {customer.birthday && (
          <div className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)] mt-1">
            <Cake size={14} strokeWidth={1.5} />
            {customer.birthday.split("T")[0]}
          </div>
        )}
      </div>

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
    </div>
  );
}
