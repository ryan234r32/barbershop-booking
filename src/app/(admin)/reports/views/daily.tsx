"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { adminHeaders } from "@/lib/auth/admin-fetch";
import { MCard } from "@/components/admin/reports/v3.6/m-card";
import { DateStrip } from "@/components/admin/reports/v3.6/date-strip";
import { NewBookingSheet } from "@/components/admin/new-booking-sheet";
import { ExpenseEntrySheet } from "@/components/admin/expense-entry-sheet";
import { DailyCloseSheet } from "@/components/admin/daily-close-sheet";
import { CATEGORY_LABELS, type ExpenseCategory } from "@/lib/expenses/categories";
import type { DailyView, DailyBookingRow } from "@/lib/reports/v3.6/aggregates";

interface ExpenseRowData {
  id: string;
  date: string;
  amount: number;
  category: ExpenseCategory;
  type: "FIXED" | "VARIABLE";
  paidMethod: "CASH" | "BANK_TRANSFER";
  notes: string | null;
  createdAt: string;
  recurringRule: { id: string; name: string } | null;
}

interface ExpensesResponse {
  from: string;
  to: string;
  count: number;
  totalAmount: number;
  expenses: ExpenseRowData[];
}

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
  const [expenseSheetOpen, setExpenseSheetOpen] = useState(false);
  const [closeSheetOpen, setCloseSheetOpen] = useState(false);

  // V3.7 §1 — today's expenses for the selected date.
  const {
    data: expensesData,
    mutate: mutateExpenses,
  } = useSWR<ExpensesResponse>(
    `/api/expenses?from=${date}&to=${date}`,
    fetcher,
    { revalidateOnFocus: false },
  );
  const expenses = expensesData?.expenses ?? [];
  const expenseTotal = expensesData?.totalAmount ?? 0;
  const expenseCash = expenses
    .filter((e) => e.paidMethod === "CASH")
    .reduce((s, e) => s + e.amount, 0);
  const expenseBank = expenses
    .filter((e) => e.paidMethod === "BANK_TRANSFER")
    .reduce((s, e) => s + e.amount, 0);

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

  /**
   * V3.7 — open the rich DailyCloseSheet instead of the legacy 1-click flow.
   * Legacy POST is still available (the API supports both shapes); kept inline
   * here only as the fallback for the "list still has pending bookings" case.
   */
  const openCloseSheet = () => {
    if (!data) return;
    if (data.data.pendingCount > 0) {
      alert(`還有 ${data.data.pendingCount} 筆未對帳，請先確認`);
      return;
    }
    setCloseSheetOpen(true);
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
          sub={`客單 ${d.avgTicket.toLocaleString()}`}
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

      {/* V3.7 §1 — 支出 / 淨利 (cash + bank breakdown beneath payment row) */}
      <div className="grid grid-cols-2 gap-3">
        <ExpenseSummaryCard
          total={expenseTotal}
          count={expenses.length}
          cash={expenseCash}
          bank={expenseBank}
        />
        <NetProfitCard
          revenue={d.totalRevenue}
          expense={expenseTotal}
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

      {/* V3.7 §1 — 今日支出列表 */}
      <MCard padding="md">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-[var(--color-text-primary)]">
            今日支出
            {expenses.length > 0 && (
              <span className="ml-2 text-xs font-normal text-[var(--color-text-muted)]">
                {expenses.length} 筆 · NT${expenseTotal.toLocaleString()}
              </span>
            )}
          </p>
          {!d.isClosed && (
            <button
              onClick={() => setExpenseSheetOpen(true)}
              className="text-xs font-semibold text-[var(--color-brand)] hover:opacity-80"
            >
              + 新增支出
            </button>
          )}
        </div>
        {expenses.length === 0 ? (
          <p className="text-center text-xs text-[var(--color-text-muted)] py-6">
            無支出記錄
          </p>
        ) : (
          <div className="space-y-1.5">
            {expenses.map((e) => (
              <ExpenseRow
                key={e.id}
                expense={e}
                isClosed={d.isClosed}
                onDeleted={() => mutateExpenses()}
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
          onClick={openCloseSheet}
          disabled={d.pendingCount > 0}
          className={`w-full px-4 py-4 rounded-xl text-base font-bold transition-colors ${
            d.pendingCount > 0
              ? "bg-[var(--color-surface)] text-[var(--color-text-muted)] cursor-not-allowed"
              : "bg-[var(--color-brand)] text-[var(--color-bg)] hover:opacity-90"
          }`}
        >
          {d.pendingCount > 0
            ? `還有 ${d.pendingCount} 筆待確認 · 完成後可結帳`
            : "✓ 完成今日結帳"}
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

      {/* V3.7 §1 — Expense entry sheet */}
      <ExpenseEntrySheet
        open={expenseSheetOpen}
        onOpenChange={setExpenseSheetOpen}
        defaultDate={date}
        onCreated={() => {
          mutateExpenses();
        }}
      />

      {/* V3.7 §3 — Daily close sheet (rich reconciliation) */}
      <DailyCloseSheet
        open={closeSheetOpen}
        onOpenChange={setCloseSheetOpen}
        date={date}
        expectedCash={d.cashTotal - expenseCash}
        expectedBank={d.bankTotal - expenseBank}
        totalRevenue={d.totalRevenue}
        totalExpense={expenseTotal}
        bookingCount={d.rows.length}
        expenseCount={expenses.length}
        onClosed={() => {
          mutate();
          mutateExpenses();
        }}
      />

      {/* V3.7 §1 — Floating Action Button. Sits above the bottom tab bar
          (~64px tall) — 14 + 64 + 8 safe = bottom-20 on iOS PWA. */}
      {!d.isClosed && (
        <button
          onClick={() => setExpenseSheetOpen(true)}
          aria-label="新增支出"
          className="fixed bottom-20 right-4 z-40 w-14 h-14 rounded-full bg-[var(--color-brand)] text-[var(--color-bg)] shadow-xl flex items-center justify-center hover:opacity-90 active:scale-95 transition-all"
          style={{ boxShadow: "0 8px 24px rgba(0, 61, 43, 0.35)" }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      )}
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
        className={`text-lg sm:text-2xl font-bold tabular-nums leading-tight mt-1 whitespace-nowrap ${
          tone === "brand" ? "text-[var(--color-brand)]" : "text-[var(--color-text-primary)]"
        }`}
      >
        {value}
      </p>
      <p
        className="text-[11px] text-[var(--color-text-muted)] mt-1 leading-snug line-clamp-2 break-words"
        title={sub}
      >
        {sub}
      </p>
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

/** Compact revenue formatter (V3.8: 拿掉 NT$ 前綴 — 老闆說「大家都知道是台幣」). */
function formatRevenue(rev: number): string {
  if (rev >= 100000) return `${Math.round(rev / 1000)}k`;
  if (rev >= 10000) return `${(rev / 10000).toFixed(1)}萬`;
  return rev.toLocaleString();
}

/** V3.7 §1 — today's expense total card with cash/bank breakdown. */
function ExpenseSummaryCard({
  total,
  count,
  cash,
  bank,
}: {
  total: number;
  count: number;
  cash: number;
  bank: number;
}) {
  return (
    <MCard padding="md">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg">📋</span>
        <p className="text-sm font-semibold text-[var(--color-text-primary)]">
          支出
        </p>
      </div>
      <p className="text-2xl font-bold tabular-nums text-[var(--color-danger)]">
        {total > 0 ? `-${total.toLocaleString()}` : "0"}
      </p>
      <p className="text-[10px] text-[var(--color-text-muted)] mt-1 tabular-nums">
        {count > 0 ? `現金 ${cash} · 轉帳 ${bank}` : "尚無支出"}
      </p>
    </MCard>
  );
}

/** V3.7 §1 — today's net profit (revenue − expense). */
function NetProfitCard({
  revenue,
  expense,
}: {
  revenue: number;
  expense: number;
}) {
  const net = revenue - expense;
  const tone = net >= 0 ? "var(--color-brand)" : "var(--color-danger)";
  return (
    <MCard padding="md">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg">💰</span>
        <p className="text-sm font-semibold text-[var(--color-text-primary)]">
          淨利
        </p>
      </div>
      <p
        className="text-2xl font-bold tabular-nums"
        style={{ color: tone }}
      >
        {net.toLocaleString()}
      </p>
      <p className="text-[10px] text-[var(--color-text-muted)] mt-1 tabular-nums leading-tight break-words">
        營收 {revenue.toLocaleString()} − 支出 {expense.toLocaleString()}
      </p>
    </MCard>
  );
}

/** V3.7 §1 — single expense row. Long-press / chevron tap reveals delete. */
function ExpenseRow({
  expense,
  isClosed,
  onDeleted,
}: {
  expense: ExpenseRowData;
  isClosed: boolean;
  onDeleted: () => void;
}) {
  const handleDelete = async () => {
    if (!confirm(`刪除這筆支出 NT$${expense.amount.toLocaleString()}？`)) return;
    const res = await fetch(`/api/expenses/${expense.id}`, {
      method: "DELETE",
      headers: adminHeaders(),
    });
    if (res.ok) onDeleted();
    else alert("刪除失敗");
  };
  return (
    <div className="flex items-center gap-3 py-2 px-1 border-b border-[var(--color-surface)] last:border-b-0">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium text-[var(--color-text-primary)] truncate">
            {CATEGORY_LABELS[expense.category]}
          </span>
          {expense.type === "FIXED" && (
            <span className="text-[9px] px-1 rounded bg-[var(--color-surface)] text-[var(--color-text-muted)] flex-shrink-0">
              固定
            </span>
          )}
          {expense.recurringRule && (
            <span className="text-[9px] px-1 rounded bg-[var(--color-brand)]/10 text-[var(--color-brand)] flex-shrink-0">
              定期
            </span>
          )}
        </div>
        {expense.notes && (
          <p className="text-[11px] text-[var(--color-text-muted)] truncate mt-0.5">
            {expense.notes}
          </p>
        )}
      </div>
      <div className="text-right flex-shrink-0">
        <p className="text-sm font-bold tabular-nums text-[var(--color-danger)]">
          -{expense.amount.toLocaleString()}
        </p>
        <p className="text-[10px] text-[var(--color-text-muted)]">
          {expense.paidMethod === "CASH" ? "💵" : "🏦"}
        </p>
      </div>
      {!isClosed && !expense.recurringRule && (
        <button
          onClick={handleDelete}
          aria-label="刪除"
          className="w-6 h-6 flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-danger)] flex-shrink-0"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6" />
          </svg>
        </button>
      )}
    </div>
  );
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
      <p className="text-2xl font-bold tabular-nums text-[var(--color-text-primary)]">
        {total.toLocaleString()}
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

  // V3.8: 老闆反映「應該是分現場和轉帳，而不是 LINE」— 拿掉 source badge
  // (LIFF/PHONE/WALK_IN/ADMIN)，只保留 payment method pill (現金/轉帳·12345)。
  // const sourceBadge = formatSourceBadge(row.bookingSource);  // disabled per
  void formatSourceBadge;  // 保留 function 但 not used，避免 TS unused warning
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

  // V3.8 daily-row redesign：
  // - 字體放大 (text-base on mobile, was text-sm)
  // - 客戶名 truncate 改為允許換行（避免長名 "Test 陳昶龍 Ryan" 被砍）
  // - Action 按鈕大 1 號 (px-3 py-1.5 text-xs，原本 px-2 py-1 text-[10px] 太小難按)
  // - row vertical padding py-2.5 → py-3 (更多呼吸空間)
  return (
    <div
      className={`group grid grid-cols-[2.75rem_1fr_auto_auto] sm:grid-cols-[3.5rem_1fr_5rem_6rem_5rem] items-center gap-x-2.5 sm:gap-x-3 gap-y-1.5 px-3 py-3 rounded-lg ${baseBg}`}
    >
      <span className="font-mono tabular-nums text-[var(--color-text-muted)] text-sm self-start pt-0.5">
        {row.startTime}
      </span>
      <div className="min-w-0">
        <p
          className="font-semibold text-[var(--color-text-primary)] text-sm sm:text-base leading-tight break-all"
          title={row.customerName}
        >
          {row.customerName}
        </p>
        <div className="flex items-center justify-between gap-2 mt-1">
          <p className="text-xs text-[var(--color-text-muted)] truncate" title={row.serviceName}>
            {row.serviceName}
            {row.notes && (
              <span className="hidden sm:inline"> · {row.notes.slice(0, 20)}</span>
            )}
          </p>
          {paymentPill && (
            <span
              className={`sm:hidden shrink-0 inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold leading-tight tabular-nums ${paymentPill.tone}`}
            >
              {paymentPill.label}
            </span>
          )}
        </div>
      </div>
      <span className="text-right font-mono tabular-nums text-[var(--color-text-primary)] text-sm sm:text-base font-bold whitespace-nowrap self-start pt-0.5">
        NT${row.amount.toLocaleString()}
      </span>
      <span className="hidden sm:flex justify-center self-start pt-0.5">
        {paymentPill && (
          <span
            className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-bold leading-tight tabular-nums ${paymentPill.tone}`}
          >
            {paymentPill.label}
          </span>
        )}
      </span>
      <div className="self-start pt-0.5 flex justify-end">
        {variant === "confirmed" ? (
          // 已對 → 點擊可撤回（confirm dialog 確認）
          <button
            onClick={onUnsettle}
            disabled={isClosed}
            aria-label="撤回對帳"
            title="點擊撤回對帳"
            className="inline-flex items-center justify-center gap-0.5 px-3 py-1.5 rounded-md bg-[var(--color-success)]/15 text-[var(--color-success)] text-xs font-bold hover:bg-[var(--color-warning)]/15 hover:text-[var(--color-warning)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-[var(--color-success)]/15 disabled:hover:text-[var(--color-success)] group-hover:[&_.unsettle-icon]:inline group-active:[&_.settled-label]:hidden group-active:[&_.unsettle-icon]:inline whitespace-nowrap"
          >
            <span className="settled-label group-hover:hidden">✓ 已對</span>
            <span className="unsettle-icon hidden group-hover:inline">↶ 撤回</span>
          </button>
        ) : variant === "warning" ? (
          <button
            onClick={onConfirm}
            disabled={isClosed}
            className="px-3 py-1.5 rounded-md bg-[var(--color-warning)]/20 text-[var(--color-warning)] text-xs font-bold disabled:opacity-30 whitespace-nowrap"
          >
            標記
          </button>
        ) : (
          <button
            onClick={onConfirm}
            disabled={isClosed}
            className="px-4 py-1.5 rounded-md bg-[var(--color-brand)] text-[var(--color-bg)] text-xs font-bold disabled:opacity-30 whitespace-nowrap shadow-sm"
          >
            確認
          </button>
        )}
      </div>
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
