"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePageTitle } from "@/lib/hooks/use-page-title";
import { useToast } from "@/components/ui/toast";
import { adminHeaders } from "@/lib/auth/admin-fetch";

/* ------------------------------------------------------------------ */
/*  Types (match GET /api/admin/payments response)                     */
/* ------------------------------------------------------------------ */

type PaymentStatus = "PENDING" | "VERIFYING" | "RECEIVED" | "WAIVED";

interface PaymentItem {
  bookingId: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  serviceName: string;
  customerName: string;
  customerPhone: string | null;
  customerLineUserId: string | null;
  amount: number;
  method: string | null;
  status: PaymentStatus;
  transferLastFive: string | null;
  verifiedAt: string | null;
  receivedAt: string | null;
}

interface PaymentsResponse {
  items: PaymentItem[];
  summary: {
    verifyingCount: number;
    pendingCount: number;
    receivedTodayAmount: number;
  };
}

type TabKey = "VERIFYING" | "PENDING" | "all";

const TAB_CONFIG: { key: TabKey; label: string }[] = [
  { key: "VERIFYING", label: "待對帳" },
  { key: "PENDING", label: "待付款" },
  { key: "all", label: "全部" },
];

const STATUS_LABELS: Record<PaymentStatus, string> = {
  PENDING: "待付款",
  VERIFYING: "待對帳",
  RECEIVED: "已收款",
  WAIVED: "已豁免",
};

const STATUS_BADGE: Record<PaymentStatus, string> = {
  PENDING: "bg-secondary text-muted-foreground",
  VERIFYING: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  RECEIVED: "bg-[var(--color-brand)]/10 text-[var(--color-brand)]",
  WAIVED: "bg-secondary text-muted-foreground",
};

/* ------------------------------------------------------------------ */
/*  Relative time helper                                               */
/* ------------------------------------------------------------------ */

function relativeTime(iso: string | null): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffMs = now - then;
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "剛剛";
  if (min < 60) return `${min} 分鐘前`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} 小時前`;
  const day = Math.floor(hr / 24);
  return `${day} 天前`;
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function PaymentsPage() {
  usePageTitle("付款對帳");
  const { toast } = useToast();

  const [tab, setTab] = useState<TabKey>("VERIFYING");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [data, setData] = useState<PaymentsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Debounce query -> 300ms
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  const loadData = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      params.set("status", tab);
      if (debouncedQuery) params.set("q", debouncedQuery);
      const res = await fetch(`/api/admin/payments?${params.toString()}`, {
        headers: adminHeaders(),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: PaymentsResponse = await res.json();
      setData(json);
    } catch (err) {
      console.error("[payments] load error", err);
      toast({ type: "error", message: "載入付款清單失敗" });
    } finally {
      setLoading(false);
    }
  }, [tab, debouncedQuery, toast]);

  useEffect(() => {
    setLoading(true);
    loadData();
  }, [loadData]);

  // Autofocus search on mount
  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  const handleMarkReceived = async (bookingId: string) => {
    setPendingAction(bookingId);
    try {
      const res = await fetch(`/api/payments/${bookingId}/mark-received`, {
        method: "PATCH",
        headers: adminHeaders(),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || `HTTP ${res.status}`);
      }
      toast({ type: "success", message: "已標記為收款" });
      await loadData();
    } catch (err) {
      console.error("[payments] mark-received error", err);
      toast({
        type: "error",
        message: err instanceof Error ? err.message : "標記失敗",
      });
    } finally {
      setPendingAction(null);
    }
  };

  const items = data?.items ?? [];
  const summary = data?.summary;

  const filteredItems = useMemo(() => {
    // Server already handles status+q; no extra filter needed
    return items;
  }, [items]);

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">付款對帳</h1>
      </div>

      {/* Search — the UI hero */}
      <div className="bg-card rounded-xl border border-border p-4">
        <label
          htmlFor="payment-search"
          className="block text-xs text-muted-foreground mb-2"
        >
          輸入末 5 碼可快速對帳（自動即時搜尋）
        </label>
        <div className="relative">
          <input
            ref={searchRef}
            id="payment-search"
            type="text"
            inputMode="numeric"
            maxLength={5}
            autoComplete="off"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value.replace(/\D/g, ""))}
            placeholder="🔍 輸入末 5 碼快速對帳"
            className="w-full h-14 px-4 text-2xl tracking-[0.4em] text-center font-mono
                       rounded-lg border border-border bg-background
                       focus:outline-none focus:ring-2 focus:ring-primary/40
                       placeholder:text-base placeholder:tracking-normal placeholder:font-sans"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-sm"
              aria-label="清除"
            >
              清除
            </button>
          )}
        </div>
      </div>

      {/* Summary cards */}
      <div className="flex gap-3 overflow-x-auto -mx-4 px-4 pb-1 lg:mx-0 lg:px-0 lg:grid lg:grid-cols-3">
        <SummaryCard
          label="待對帳"
          value={summary ? `${summary.verifyingCount} 筆` : "-"}
          tone="warn"
        />
        <SummaryCard
          label="待付款"
          value={summary ? `${summary.pendingCount} 筆` : "-"}
          tone="muted"
        />
        <SummaryCard
          label="今日已收"
          value={
            summary
              ? `NT$${summary.receivedTodayAmount.toLocaleString()}`
              : "-"
          }
          tone="brand"
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-secondary/50 rounded-lg">
        {TAB_CONFIG.map((t) => {
          const isActive = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 py-2 text-sm rounded-md transition-colors
                ${isActive
                  ? "bg-card text-foreground font-medium shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
                }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="bg-card rounded-xl border border-border py-12 text-center text-muted-foreground text-sm">
          {debouncedQuery ? "找不到符合末 5 碼的預約" : "目前沒有付款紀錄"}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredItems.map((item) => (
            <PaymentCard
              key={item.bookingId}
              item={item}
              onMarkReceived={() => handleMarkReceived(item.bookingId)}
              loading={pendingAction === item.bookingId}
              highlightedDigits={debouncedQuery}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Subcomponents                                                      */
/* ------------------------------------------------------------------ */

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "warn" | "muted" | "brand";
}) {
  const toneClass =
    tone === "warn"
      ? "text-amber-600 dark:text-amber-300"
      : tone === "brand"
        ? "text-[var(--color-brand)]"
        : "text-foreground";
  return (
    <div className="shrink-0 min-w-[140px] bg-card rounded-xl border border-border p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-xl font-bold mt-1 ${toneClass}`}>{value}</p>
    </div>
  );
}

function PaymentCard({
  item,
  onMarkReceived,
  loading,
  highlightedDigits,
}: {
  item: PaymentItem;
  onMarkReceived: () => void;
  loading: boolean;
  highlightedDigits: string;
}) {
  const showMarkBtn =
    item.status === "VERIFYING" || item.status === "PENDING";
  const canLinePing =
    item.customerLineUserId &&
    !item.customerLineUserId.startsWith("manual-");
  const lineUrl = canLinePing
    ? `https://line.me/R/ti/p/~${item.customerLineUserId}`
    : null;
  const telUrl = item.customerPhone ? `tel:${item.customerPhone}` : null;

  const last5Highlight =
    item.transferLastFive &&
    highlightedDigits &&
    item.transferLastFive === highlightedDigits;

  return (
    <div
      className={`bg-card rounded-xl border p-4 transition-colors
        ${last5Highlight
          ? "border-[var(--color-brand)] ring-2 ring-[var(--color-brand)]/30"
          : "border-border"
        }`}
    >
      {/* Top row: customer + status badge */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-foreground truncate">
            {item.customerName}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {formatDateShort(item.date)} · {item.startTime} ·{" "}
            {item.serviceName}
          </p>
        </div>
        <span
          className={`shrink-0 text-xs px-2 py-1 rounded-full ${STATUS_BADGE[item.status]}`}
        >
          {STATUS_LABELS[item.status]}
        </span>
      </div>

      {/* Middle row: last 5 + amount + time */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm mt-3">
        {item.transferLastFive && (
          <span className="font-mono text-foreground">
            末 5 碼：
            <span
              className={
                last5Highlight
                  ? "text-[var(--color-brand)] font-bold"
                  : "text-foreground"
              }
            >
              {item.transferLastFive}
            </span>
          </span>
        )}
        <span className="font-semibold text-foreground">
          NT${item.amount.toLocaleString()}
        </span>
        {item.status === "VERIFYING" && item.verifiedAt && (
          <span className="text-xs text-muted-foreground">
            {relativeTime(item.verifiedAt)}回報
          </span>
        )}
        {item.status === "RECEIVED" && item.receivedAt && (
          <span className="text-xs text-muted-foreground">
            {relativeTime(item.receivedAt)}收款
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 mt-3">
        {lineUrl ? (
          <a
            href={lineUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs px-3 py-1.5 rounded-lg border border-border text-foreground/80 hover:bg-background transition-colors"
          >
            聯絡客戶
          </a>
        ) : telUrl ? (
          <a
            href={telUrl}
            className="text-xs px-3 py-1.5 rounded-lg border border-border text-foreground/80 hover:bg-background transition-colors"
          >
            📞 {item.customerPhone}
          </a>
        ) : null}
        {showMarkBtn && (
          <button
            onClick={onMarkReceived}
            disabled={loading}
            className="text-xs px-3 py-1.5 rounded-lg bg-[var(--color-brand)] text-white hover:opacity-90 disabled:opacity-50 transition-opacity font-medium"
          >
            {loading ? "處理中..." : "✓ 已收款"}
          </button>
        )}
      </div>
    </div>
  );
}

function formatDateShort(iso: string): string {
  // YYYY-MM-DD -> M/D
  const parts = iso.split("-");
  if (parts.length !== 3) return iso;
  return `${Number(parts[1])}/${Number(parts[2])}`;
}
