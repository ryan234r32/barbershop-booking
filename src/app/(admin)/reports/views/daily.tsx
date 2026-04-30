"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { adminHeaders } from "@/lib/auth/admin-fetch";
import { MCard } from "@/components/admin/reports/v3.6/m-card";
import { DateStrip } from "@/components/admin/reports/v3.6/date-strip";
import { NewBookingSheet } from "@/components/admin/new-booking-sheet";
import type { DailyView, DailyBookingRow } from "@/lib/reports/v3.6/aggregates";

interface DailyResponse {
  view: "daily";
  date: string;
  data: DailyView;
}

const fetcher = (url: string) =>
  fetch(url, { headers: adminHeaders() }).then((r) => {
    if (!r.ok) throw new Error(String(r.status));
    return r.json();
  });

interface DailyViewProps {
  date: string;
  onDateChange: (next: string) => void;
}

export function DailyView({ date, onDateChange }: DailyViewProps) {
  const { data, error, isLoading, mutate } = useSWR<DailyResponse>(
    `/api/reports/v3.6?view=daily&date=${date}`,
    fetcher,
    { revalidateOnFocus: false },
  );
  const [filter, setFilter] = useState<"all" | "pending" | "warning">("all");
  const [backfillOpen, setBackfillOpen] = useState(false);

  // Optimistic settle: track ids the user just clicked. UI marks them as
  // settled instantly; we still hit the API and SWR refetches in the background.
  const [optimisticSettled, setOptimisticSettled] = useState<Set<string>>(new Set());

  const decoratedRows = useMemo(() => {
    const rows = data?.data.rows ?? [];
    return rows.map((r) =>
      optimisticSettled.has(r.id) && !r.settledAt
        ? { ...r, settledAt: new Date().toISOString() }
        : r,
    );
  }, [data, optimisticSettled]);

  const filteredRows = useMemo(() => {
    if (filter === "all") return decoratedRows;
    if (filter === "pending") return decoratedRows.filter((r) => r.settledAt == null);
    return decoratedRows.filter((r) => r.isWarning);
  }, [decoratedRows, filter]);

  // Effective pending count after optimistic toggles
  const effectivePendingCount = useMemo(() => {
    if (!data) return 0;
    const opt = optimisticSettled.size;
    return Math.max(0, data.data.pendingCount - opt);
  }, [data, optimisticSettled]);
  const reconcileTotal = data?.data.reconcileTotalCount ?? 0;
  const settledCount = reconcileTotal - effectivePendingCount;
  const progressPct = reconcileTotal > 0 ? Math.round((settledCount / reconcileTotal) * 100) : 0;

  // V3.8 §5：DateStrip 預設 maxValue = today，未來日期會被 disabled。但老闆要看
  // 5 月（未來）的預定 → 放寬到「today + 60 天」覆蓋 45 天預約窗口 + 緩衝。
  const maxNavDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 60);
    return d.toLocaleDateString("en-CA", { timeZone: "Asia/Taipei" });
  }, []);

  const settleOne = async (id: string) => {
    // optimistic flip
    setOptimisticSettled((prev) => new Set(prev).add(id));
    try {
      const res = await fetch(`/api/bookings/${id}/settle`, {
        method: "PATCH",
        headers: adminHeaders(),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({} as { error?: string; message?: string }));
        // rollback
        setOptimisticSettled((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        alert(`確認失敗（${res.status}）：${err.message ?? err.error ?? "請稍後再試"}`);
        return;
      }
      // Refetch in background — SWR will reconcile and clear the optimistic
      // entry once server data agrees.
      const fresh = await mutate();
      if (fresh?.data.rows.some((r) => r.id === id && r.settledAt)) {
        setOptimisticSettled((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }
    } catch (e) {
      setOptimisticSettled((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      alert(`確認失敗：${String(e)}`);
    }
  };

  // V3.6 Pass 3 §2 — undo settle. Confirm gate to prevent thumb-fat reverts;
  // optimistic flip the row back to pending; rollback on API error. Server will
  // also fire a `paymentSettleRevokedMessage` apology to the customer (V3.7 §G).
  const unsettleOne = async (id: string) => {
    if (!confirm("撤回此筆對帳？\n客戶會收到「對帳記錄已撤銷」的補正 LINE 訊息。")) return;
    // Optimistically un-settle: pull the row out of the optimistic-settled set
    // (no-op if it wasn't there) and clear `settledAt` via SWR mutation.
    await mutate(
      (current) => {
        if (!current) return current;
        return {
          ...current,
          data: {
            ...current.data,
            rows: current.data.rows.map((r) =>
              r.id === id ? { ...r, settledAt: null } : r,
            ),
          },
        };
      },
      { revalidate: false },
    );
    setOptimisticSettled((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    try {
      const res = await fetch(`/api/bookings/${id}/settle`, {
        method: "DELETE",
        headers: adminHeaders(),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({} as { error?: string; message?: string }));
        alert(`撤回失敗（${res.status}）：${err.message ?? err.error ?? "請稍後再試"}`);
      }
    } catch (e) {
      alert(`撤回失敗：${String(e)}`);
    } finally {
      // Always re-sync with server (success → row stays unsettled, error → row pops back)
      mutate();
    }
  };

  const settleAll = async () => {
    const rows = data?.data.rows ?? [];
    const pending = rows.filter((r) => r.settledAt == null && r.bookingStatus !== "NO_SHOW");
    if (pending.length === 0) return;
    if (!confirm(`一次確認 ${pending.length} 筆未對帳預約？`)) return;
    const results = await Promise.all(
      pending.map((r) =>
        fetch(`/api/bookings/${r.id}/settle`, {
          method: "PATCH",
          headers: adminHeaders(),
        }).then((res) => res.ok),
      ),
    );
    const failed = results.filter((ok) => !ok).length;
    if (failed > 0) alert(`完成 ${pending.length - failed} 筆，失敗 ${failed} 筆`);
    mutate();
  };

  const dayClose = async () => {
    if (!data) return;
    if (data.data.pendingCount > 0) {
      alert(`還有 ${data.data.pendingCount} 筆未對帳，請先確認`);
      return;
    }
    if (!confirm("確定結班？結束後當日資料鎖定，不能直接編輯（可從補登流程進入）")) return;
    const res = await fetch("/api/admin/day-close", {
      method: "POST",
      headers: adminHeaders(),
      body: JSON.stringify({ date }),
    });
    if (res.ok) {
      window.print();
      mutate();
    }
  };

  const reopen = async () => {
    if (!confirm("解除結班？解除後可繼續編輯今日資料")) return;
    const res = await fetch("/api/admin/day-close", {
      method: "DELETE",
      headers: adminHeaders(),
      body: JSON.stringify({ date }),
    });
    if (res.ok) mutate();
  };

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <div className="h-12 bg-[var(--color-surface)] rounded-xl animate-pulse" />
        <div className="h-32 bg-[var(--color-surface)] rounded-2xl animate-pulse" />
        <div className="h-48 bg-[var(--color-surface)] rounded-2xl animate-pulse" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-[var(--color-danger)]/10 rounded-xl p-5 text-sm text-[var(--color-danger)]">
        資料載入失敗：{String(error)}
      </div>
    );
  }

  const d = data.data;

  return (
    <div className="space-y-4">
      {/* Date strip — 左右滑動選日期。
          V3.8 §5：老闆要看 5 月（未來日期）的預約 → maxValue 放寬到 60 天後，
          覆蓋 45 天預約窗口 + 緩衝。日結 / 對帳對未來日期不適用是 expected
          behavior，但 daily view 也是「看當日預約」工具，未來日期應可瀏覽。 */}
      <DateStrip kind="day" selected={date} onSelect={onDateChange} maxValue={maxNavDate} />

      {d.isClosed && (
        <p className="text-[11px] text-center text-[var(--color-text-muted)]">
          🔒 已結班 · {formatTime(d.closedAt)}
        </p>
      )}

      {/* Hero — 大字三段總覽（Pass 2 §4 字體放大） */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <BigStatCard
          label="今日應收"
          value={formatRevenue(d.totalRevenue)}
          sub={
            d.comparisonDeltaPct !== null
              ? `${d.comparisonDeltaPct >= 0 ? "↑" : "↓"} ${Math.abs(d.comparisonDeltaPct).toFixed(0)}% vs 同日 4 週中位`
              : "尚無比較資料"
          }
          tone="brand"
        />
        <BigStatCard
          label="服務客數"
          value={`${d.servedCount}`}
          sub={`客單 NT$${d.avgTicket.toLocaleString()}`}
        />
        <BigStatCard
          label="對帳進度"
          value={`${settledCount}/${reconcileTotal}`}
          sub={effectivePendingCount > 0 ? `${effectivePendingCount} 筆待確認` : "✓ 已對完"}
        />
      </div>

      {/* 漸變進度條（Pass 2 §3 紅→橘→綠） */}
      {reconcileTotal > 0 && (
        <ProgressGradient
          pct={progressPct}
          rightLabel={`${settledCount} / ${reconcileTotal}`}
          settleAll={effectivePendingCount > 0 && !d.isClosed ? settleAll : undefined}
        />
      )}

      <div className="grid grid-cols-2 gap-3">
        <PaymentCard
          icon="💵"
          label="現金"
          total={d.cashTotal}
          confirmed={d.cashConfirmed}
          pending={d.cashPending}
        />
        <PaymentCard
          icon="🏦"
          label="轉帳"
          total={d.bankTotal}
          confirmed={d.bankConfirmed}
          pending={d.bankPending}
        />
      </div>

      <MCard padding="md">
        <div className="flex items-center justify-between mb-3 gap-2">
          <p className="text-sm font-semibold text-[var(--color-text-primary)]">今日預約對帳</p>
          <FilterTabs
            value={filter}
            onChange={setFilter}
            counts={{
              all: d.rows.length,
              pending: d.pendingCount,
              warning: d.warningCount,
            }}
          />
        </div>

        {filteredRows.length === 0 ? (
          <p className="text-center text-xs text-[var(--color-text-muted)] py-6">無資料</p>
        ) : (
          <div className="space-y-1.5">
            {filteredRows.map((r) => (
              <BookingRow
                key={r.id}
                row={r}
                isClosed={d.isClosed}
                onConfirm={() => settleOne(r.id)}
                onUnsettle={() => unsettleOne(r.id)}
              />
            ))}
          </div>
        )}
      </MCard>

      {!d.isClosed && (
        <button
          onClick={() => setBackfillOpen(true)}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[var(--color-surface)] hover:bg-[var(--color-text-muted)]/10 transition-colors text-sm font-semibold text-[var(--color-text-body)]"
        >
          <span className="text-lg">➕</span>
          <span>新增預約 / 補登訂單</span>
        </button>
      )}

      <DayStatusFooter d={d} />

      {!d.isClosed ? (
        <button
          onClick={dayClose}
          disabled={d.pendingCount > 0}
          className={`w-full px-4 py-4 rounded-xl text-base font-bold transition-colors ${
            d.pendingCount > 0
              ? "bg-[var(--color-surface)] text-[var(--color-text-muted)] cursor-not-allowed"
              : "bg-[var(--color-brand)] text-[var(--color-bg)] hover:opacity-90"
          }`}
        >
          {d.pendingCount > 0
            ? `還有 ${d.pendingCount} 筆待確認 · 完成後可結班`
            : "✓ 結束今天 · 產出對帳單 PDF"}
        </button>
      ) : (
        <div className="space-y-2">
          <div className="bg-[var(--color-success)]/10 rounded-xl p-4 text-center">
            <p className="text-sm font-semibold text-[var(--color-text-primary)]">
              🔒 今日已結班
            </p>
            <p className="text-[11px] text-[var(--color-text-muted)] mt-1">
              {formatTime(d.closedAt)} 結班 · 補登可從「補登訂單」進入
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => window.print()}
              className="px-4 py-3 rounded-xl bg-[var(--color-brand)] text-[var(--color-bg)] text-sm font-semibold"
            >
              列印對帳單 PDF
            </button>
            <button
              onClick={reopen}
              className="px-4 py-3 rounded-xl bg-[var(--color-surface)] text-sm font-semibold"
            >
              解除結班
            </button>
          </div>
        </div>
      )}

      <NewBookingSheet
        open={backfillOpen}
        onOpenChange={setBackfillOpen}
        date={date}
        time="11:00"
        duration={1}
        onCreated={() => {
          setBackfillOpen(false);
          mutate();
        }}
      />
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────

/** Pass 2 — Hero card with bigger font matching 現金/轉帳 size. Each KPI is a
 * standalone card, not a tight 3-column grid. */
function BigStatCard({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub: string;
  tone?: "brand";
}) {
  return (
    <MCard padding="md">
      <p className="text-xs text-[var(--color-text-muted)]">{label}</p>
      <p
        className={`text-base sm:text-2xl font-bold tabular-nums leading-tight mt-1 whitespace-nowrap ${
          tone === "brand" ? "text-[var(--color-brand)]" : "text-[var(--color-text-primary)]"
        }`}
      >
        {value}
      </p>
      <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5 truncate">{sub}</p>
    </MCard>
  );
}

/** Pass 2 §3 — gradient progress bar (red → orange → green) for daily 對帳.
 * Color comes from the % itself: < 30% red, 30-70% orange, > 70% green. */
function ProgressGradient({
  pct,
  rightLabel,
  settleAll,
}: {
  pct: number;
  rightLabel: string;
  settleAll?: () => void;
}) {
  const clamped = Math.min(100, Math.max(0, pct));
  // Hue maps 0% → 0 (red), 50% → 30 (orange), 100% → 130 (green)
  const hue = Math.round((clamped / 100) * 130);
  const fillColor = `hsl(${hue} 75% 45%)`;
  return (
    <MCard padding="md">
      <div className="flex items-center justify-between mb-2 gap-2">
        <p className="text-xs font-semibold text-[var(--color-text-primary)]">
          對帳進度 <span className="font-mono tabular-nums">{clamped}%</span>
        </p>
        <p className="text-[10px] text-[var(--color-text-muted)] tabular-nums">{rightLabel}</p>
      </div>
      <div className="h-3 rounded-full overflow-hidden bg-[var(--color-surface)]">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{
            width: `${clamped}%`,
            background: `linear-gradient(90deg, hsl(0 75% 50%) 0%, hsl(30 80% 50%) 50%, ${fillColor} 100%)`,
          }}
        />
      </div>
      {settleAll && (
        <button
          onClick={settleAll}
          className="w-full mt-3 text-xs px-3 py-2 rounded-md bg-[var(--color-brand)] text-[var(--color-bg)] font-semibold"
        >
          全部確認 →
        </button>
      )}
    </MCard>
  );
}

/** Compact revenue formatter — keeps NT$18,700 short on small screens. */
function formatRevenue(rev: number): string {
  if (rev >= 100000) return `NT$${Math.round(rev / 1000)}k`;
  if (rev >= 10000) return `NT$${(rev / 10000).toFixed(1)}萬`;
  return `NT$${rev.toLocaleString()}`;
}

function PaymentCard({
  icon,
  label,
  total,
  confirmed,
  pending,
}: {
  icon: string;
  label: string;
  total: number;
  confirmed: number;
  pending: number;
}) {
  return (
    <MCard padding="md">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg">{icon}</span>
        <p className="text-sm font-semibold text-[var(--color-text-primary)]">{label}</p>
      </div>
      <p className="text-xl font-bold tabular-nums text-[var(--color-text-primary)]">
        NT${total.toLocaleString()}
      </p>
      <p className="text-[10px] text-[var(--color-text-muted)] mt-1 tabular-nums">
        已確認 {confirmed} · 待 {pending}
      </p>
    </MCard>
  );
}

function FilterTabs({
  value,
  onChange,
  counts,
}: {
  value: "all" | "pending" | "warning";
  onChange: (next: "all" | "pending" | "warning") => void;
  counts: { all: number; pending: number; warning: number };
}) {
  const opts: Array<{ key: "all" | "pending" | "warning"; label: string; n: number }> = [
    { key: "all", label: "全部", n: counts.all },
    { key: "pending", label: "待確認", n: counts.pending },
    { key: "warning", label: "特殊", n: counts.warning },
  ];
  return (
    <div className="flex items-center gap-1 text-[10px]">
      {opts.map((o) => (
        <button
          key={o.key}
          onClick={() => onChange(o.key)}
          className={`px-2 py-1 rounded-md transition-colors ${
            value === o.key
              ? "bg-[var(--color-brand)] text-[var(--color-bg)] font-semibold"
              : "bg-[var(--color-surface)] text-[var(--color-text-muted)]"
          }`}
        >
          {o.label} {o.n}
        </button>
      ))}
    </div>
  );
}

function BookingRow({
  row,
  isClosed,
  onConfirm,
  onUnsettle,
}: {
  row: DailyBookingRow;
  isClosed: boolean;
  onConfirm: () => void;
  onUnsettle: () => void;
}) {
  const variant = row.settledAt
    ? "confirmed"
    : row.isWarning
      ? "warning"
      : "pending";

  const baseBg =
    variant === "confirmed"
      ? "bg-[var(--color-surface)]/40"
      : variant === "warning"
        ? "bg-[var(--color-warning)]/8 border border-[var(--color-warning)]/25"
        : "bg-[var(--color-bg)] border border-[var(--color-brand)]/8";

  const sourceBadge = formatSourceBadge(row.bookingSource);
  // V3.8 §3 老闆反映：要看到末 5 碼 + 現場/轉帳 分明。把付款方式做成 pill：
  // - 現金 → 綠色 pill「現金」
  // - 轉帳含末 5 碼 → 琥珀 pill「轉帳·12345」（強調，提醒老闆對帳）
  // - 轉帳但無末 5 碼 → 琥珀 pill「轉帳」
  const paymentPill =
    row.paymentMethod === "BANK_TRANSFER"
      ? {
          label: row.transferLastFive ? `轉帳·${row.transferLastFive}` : "轉帳",
          tone: "bg-[var(--color-warning)]/15 text-[var(--color-warning)]",
        }
      : row.paymentMethod === "CASH"
        ? {
            label: "現金",
            tone: "bg-[var(--color-success)]/12 text-[var(--color-success)]",
          }
        : null;

  return (
    <div
      className={`group grid grid-cols-[2.75rem_1fr_auto_auto] sm:grid-cols-[3.5rem_1fr_5rem_6rem_4.5rem] items-center gap-x-2 sm:gap-x-3 gap-y-1 px-3 py-2.5 rounded-md text-sm ${baseBg}`}
    >
      <span className="font-mono tabular-nums text-[var(--color-text-muted)] text-xs sm:text-sm">
        {row.startTime}
      </span>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="font-semibold text-[var(--color-text-primary)] truncate">
            {row.customerName}
          </p>
          {sourceBadge && (
            <span
              className={`shrink-0 inline-flex items-center px-1.5 py-px rounded-sm text-[10px] font-semibold leading-tight ${sourceBadge.tone}`}
              title={sourceBadge.title}
            >
              {sourceBadge.label}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between gap-2 mt-1">
          <p className="text-[11px] text-[var(--color-text-muted)] truncate">
            {row.serviceName}
            {row.notes && (
              <span className="hidden sm:inline"> · {row.notes.slice(0, 20)}</span>
            )}
          </p>
          {paymentPill && (
            <span
              className={`sm:hidden shrink-0 inline-flex items-center px-1.5 py-px rounded-sm text-[10px] font-semibold leading-tight tabular-nums ${paymentPill.tone}`}
            >
              {paymentPill.label}
            </span>
          )}
        </div>
      </div>
      <span className="text-right font-mono tabular-nums text-[var(--color-text-body)] font-semibold whitespace-nowrap">
        NT${row.amount.toLocaleString()}
      </span>
      <span className="hidden sm:flex justify-center">
        {paymentPill && (
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold leading-tight tabular-nums ${paymentPill.tone}`}
          >
            {paymentPill.label}
          </span>
        )}
      </span>
      {variant === "confirmed" ? (
        // V3.6 Pass 3 §2 — clickable settle tag. Click it (mobile-first; hover
        // is unreliable on touch) → confirm dialog → DELETE settle. Confirmed
        // state is hard to undo accidentally because of the explicit prompt.
        <button
          onClick={onUnsettle}
          disabled={isClosed}
          aria-label="撤回對帳"
          title="點擊撤回對帳"
          className="inline-flex items-center justify-center gap-0.5 px-2 py-1 rounded-md bg-[var(--color-success)]/15 text-[var(--color-success)] text-[10px] font-semibold hover:bg-[var(--color-warning)]/15 hover:text-[var(--color-warning)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-[var(--color-success)]/15 disabled:hover:text-[var(--color-success)] group-hover:[&_.unsettle-icon]:inline group-active:[&_.settled-label]:hidden group-active:[&_.unsettle-icon]:inline"
        >
          <span className="settled-label group-hover:hidden">✓ 已對</span>
          <span className="unsettle-icon hidden group-hover:inline">↶ 撤回</span>
        </button>
      ) : variant === "warning" ? (
        <button
          onClick={onConfirm}
          disabled={isClosed}
          className="px-2 py-1 rounded-md bg-[var(--color-warning)]/15 text-[var(--color-warning)] text-[10px] font-semibold disabled:opacity-30"
        >
          標記
        </button>
      ) : (
        <button
          onClick={onConfirm}
          disabled={isClosed}
          className="px-2 py-1 rounded-md bg-[var(--color-brand)] text-[var(--color-bg)] text-[10px] font-semibold disabled:opacity-30"
        >
          確認
        </button>
      )}
    </div>
  );
}

/**
 * V3.7 §A/B — translate `BookingSource` enum into a small visual badge.
 * Keep the label tight (max 2 chars) so the row stays scannable on mobile.
 * Schema values: LIFF / PHONE / WALK_IN / ADMIN. Historical Excel imports
 * land as ADMIN with `hist-` prefix on user, but the row level can't tell
 * those apart cheaply — fall back to "日曆" which reads correctly anyway.
 */
function formatSourceBadge(source: string): { label: string; tone: string; title: string } | null {
  switch (source) {
    case "LIFF":
      return {
        label: "LINE",
        tone: "bg-[#00B900]/12 text-[#0E8C0E]",
        title: "客戶 LINE 自助預約",
      };
    case "PHONE":
      return {
        label: "電話",
        tone: "bg-[var(--color-warning)]/15 text-[var(--color-warning)]",
        title: "電話預約",
      };
    case "WALK_IN":
      return {
        label: "現場",
        tone: "bg-[var(--color-text-muted)]/15 text-[var(--color-text-muted)]",
        title: "現場 walk-in",
      };
    case "ADMIN":
      return {
        label: "日曆",
        tone: "bg-[var(--color-brand)]/12 text-[var(--color-brand)]",
        title: "老闆從日曆建立 / 補登",
      };
    default:
      return {
        label: source.slice(0, 2),
        tone: "bg-[var(--color-surface)] text-[var(--color-text-muted)]",
        title: source,
      };
  }
}


function DayStatusFooter({ d }: { d: DailyView }) {
  if (d.rescheduledCount + d.noShowCount + d.cancelledCount === 0) return null;
  const items: Array<{ label: string; n: number; color: string }> = [
    { label: "改期", n: d.rescheduledCount, color: "var(--color-warning)" },
    { label: "No-show", n: d.noShowCount, color: "var(--color-danger)" },
    { label: "取消", n: d.cancelledCount, color: "var(--color-text-muted)" },
  ];
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-[var(--color-surface)]/40 text-xs flex-wrap">
      <span className="text-[var(--color-text-muted)] shrink-0">今日狀況：</span>
      {items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-1 tabular-nums">
          <span
            className="inline-block w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: i.color }}
          />
          <span className="text-[var(--color-text-body)]">
            {i.label} {i.n}
          </span>
        </span>
      ))}
    </div>
  );
}

function formatTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleTimeString("zh-TW", {
    timeZone: "Asia/Taipei",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}
