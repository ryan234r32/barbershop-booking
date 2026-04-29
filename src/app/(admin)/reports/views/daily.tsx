"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { adminHeaders } from "@/lib/auth/admin-fetch";
import { MCard } from "@/components/admin/reports/v3.6/m-card";
import { MTag } from "@/components/admin/reports/v3.6/m-tag";
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
  date: string; // YYYY-MM-DD
  onDateChange: (next: string) => void;
}

export function DailyView({ date, onDateChange }: DailyViewProps) {
  const { data, error, isLoading, mutate } = useSWR<DailyResponse>(
    `/api/reports/v3.6?view=daily&date=${date}`,
    fetcher,
    { revalidateOnFocus: false },
  );
  const [filter, setFilter] = useState<"all" | "pending" | "warning">("all");

  const filteredRows = useMemo(() => {
    const rows = data?.data.rows ?? [];
    if (filter === "all") return rows;
    if (filter === "pending") return rows.filter((r) => r.bookingStatus === "COMPLETED" && r.settledAt == null);
    return rows.filter((r) => r.isWarning);
  }, [data, filter]);

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
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

  const settleOne = async (id: string) => {
    const res = await fetch(`/api/bookings/${id}/settle`, {
      method: "PATCH",
      headers: adminHeaders(),
    });
    if (res.ok) mutate();
    else alert("確認失敗");
  };

  const settleAll = async () => {
    const pending = d.rows.filter((r) => r.bookingStatus === "COMPLETED" && r.settledAt == null);
    await Promise.all(
      pending.map((r) =>
        fetch(`/api/bookings/${r.id}/settle`, {
          method: "PATCH",
          headers: adminHeaders(),
        }),
      ),
    );
    mutate();
  };

  const dayClose = async () => {
    if (d.pendingCount > 0) {
      alert(`還有 ${d.pendingCount} 筆未對帳，請先確認`);
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

  return (
    <div className="space-y-4">
      {/* Header — 日期 + 切換器 */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => onDateChange(shiftDay(date, -1))}
          className="px-3 py-2 rounded-lg bg-[var(--color-surface)] text-sm font-medium hover:bg-[var(--color-text-muted)]/10"
        >
          ← 前一天
        </button>
        <div className="flex-1 text-center bg-[var(--color-bg)] border border-[var(--color-brand)]/12 rounded-lg px-3 py-2">
          <p className="text-sm font-bold text-[var(--color-text-primary)] tabular-nums">
            {date} · {d.weekdayLabel}
          </p>
          <p className="text-[10px] text-[var(--color-text-muted)]">
            {d.isClosed ? `🔒 已結班 · ${formatTime(d.closedAt)}` : "營業中"}
          </p>
        </div>
        <button
          onClick={() => onDateChange(shiftDay(date, +1))}
          disabled={date >= todayIso()}
          className="px-3 py-2 rounded-lg bg-[var(--color-surface)] text-sm font-medium hover:bg-[var(--color-text-muted)]/10 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          後一天 →
        </button>
      </div>

      {/* Hero — 三段總覽 */}
      <MCard padding="lg">
        <div className="grid grid-cols-3 gap-3 mb-4">
          <HeroStat
            label="今日營收"
            value={`NT$${d.totalRevenue.toLocaleString()}`}
            sub={
              d.comparisonDeltaPct !== null
                ? `${d.comparisonDeltaPct >= 0 ? "↑" : "↓"} ${Math.abs(d.comparisonDeltaPct).toFixed(0)}% vs 4 週同日中位`
                : "尚無比較資料"
            }
            highlight
          />
          <HeroStat
            label="服務客數"
            value={`${d.servedCount}`}
            sub={`客單 NT$${d.avgTicket.toLocaleString()}`}
          />
          <HeroStat
            label="對帳進度"
            value={`${d.servedCount - d.pendingCount}/${d.servedCount}`}
            sub={`${d.pendingCount} 筆待確認`}
          />
        </div>

        {/* Progress bar of confirmed/pending */}
        {d.servedCount > 0 && (
          <div className="grid grid-cols-7 gap-1 mb-2">
            {Array.from({ length: Math.min(d.servedCount, 14) }).map((_, i) => {
              const isConfirmed = i < d.servedCount - d.pendingCount;
              return (
                <div
                  key={i}
                  className={`h-2 rounded-full ${
                    isConfirmed ? "bg-[var(--color-success)]" : "bg-[var(--color-surface)]"
                  }`}
                />
              );
            })}
          </div>
        )}

        <div className="flex items-center justify-between mt-2">
          <p className="text-[11px] text-[var(--color-text-muted)]">
            💡 點擊每筆確認，或按右側「全部確認」
          </p>
          {d.pendingCount > 0 && !d.isClosed && (
            <button
              onClick={settleAll}
              className="text-xs px-3 py-1.5 rounded-md bg-[var(--color-brand)] text-[var(--color-bg)] font-semibold"
            >
              全部確認 →
            </button>
          )}
        </div>
      </MCard>

      {/* 支付方式分類雙卡 */}
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

      {/* 對帳清單 */}
      <MCard padding="md">
        <div className="flex items-center justify-between mb-3">
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
              />
            ))}
          </div>
        )}
      </MCard>

      {/* 例外操作 */}
      {!d.isClosed && (
        <div className="grid grid-cols-3 gap-2">
          <ExceptionButton icon="➕" label="新增 Walk-in" href="/calendar?walkin=1" />
          <ExceptionButton icon="⊘" label="標記 No-show" href="#" />
          <ExceptionButton icon="📝" label="補登訂單" href="/calendar?backfill=1" />
        </div>
      )}

      {/* 結班按鈕 */}
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
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────

function HeroStat({
  label,
  value,
  sub,
  highlight,
}: {
  label: string;
  value: string;
  sub: string;
  highlight?: boolean;
}) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">
        {label}
      </p>
      <p
        className={`text-xl font-bold tabular-nums leading-tight mt-0.5 ${
          highlight ? "text-[var(--color-brand)]" : "text-[var(--color-text-primary)]"
        }`}
      >
        {value}
      </p>
      <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5 truncate">{sub}</p>
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
    { key: "warning", label: "異常", n: counts.warning },
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
}: {
  row: DailyBookingRow;
  isClosed: boolean;
  onConfirm: () => void;
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

  return (
    <div
      className={`grid grid-cols-[3.5rem_1fr_5rem_4rem_4.5rem] items-center gap-2 px-2 py-2 rounded-md text-xs ${baseBg}`}
    >
      <span className="font-mono tabular-nums text-[var(--color-text-muted)]">
        {row.startTime}
      </span>
      <div className="min-w-0">
        <p className="font-semibold text-[var(--color-text-primary)] truncate">
          {row.customerName}
        </p>
        <p className="text-[10px] text-[var(--color-text-muted)] truncate">
          {row.serviceName}
          {row.notes && ` · ${row.notes.slice(0, 20)}`}
        </p>
      </div>
      <span className="text-right font-mono tabular-nums text-[var(--color-text-body)]">
        NT${row.amount.toLocaleString()}
      </span>
      <span className="text-center text-[10px] text-[var(--color-text-muted)]">
        {row.paymentMethod === "CASH" ? "現金" : row.paymentMethod === "BANK_TRANSFER" ? "轉帳" : "—"}
      </span>
      {variant === "confirmed" ? (
        <MTag tone="success">✓ 已對</MTag>
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

function ExceptionButton({ icon, label, href }: { icon: string; label: string; href: string }) {
  return (
    <a
      href={href}
      className="flex flex-col items-center justify-center px-3 py-3 rounded-xl bg-[var(--color-surface)] hover:bg-[var(--color-text-muted)]/10 transition-colors text-[11px] font-medium text-[var(--color-text-body)] gap-1"
    >
      <span className="text-lg">{icon}</span>
      <span>{label}</span>
    </a>
  );
}

// ─── helpers ─────────────────────────────────────────────────────────────

function shiftDay(iso: string, delta: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + delta);
  return dt.toISOString().slice(0, 10);
}

function todayIso(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Taipei" });
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
