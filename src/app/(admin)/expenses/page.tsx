/**
 * V3.7 Tier 1.5 §0a + 訪談 §七 — 集中支出頁
 *
 * 老闆痛點：「月中/月底要查月初某筆支出，現有頁面只能逐日點開」
 *
 * 此頁解決方式：
 *   - 整月所有支出一次列出（從 1 號到 N 號條列）
 *   - 月份切換 (← →)
 *   - 關鍵字搜尋（filter notes + category 中文）
 *   - 分類 chip filter（全部 / 房租 / 髮品耗材 / 水電瓦斯 / 其他）
 *   - 月小計顯示
 *
 * 後續 (Tier 2):
 *   - 照片上傳收據（需 Vercel Blob env setup）
 *   - 跨月搜尋（API 支援 from/to 任意範圍）
 */
"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { ChevronLeft, ChevronRight, Search, Plus, Trash2 } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { usePageTitle } from "@/lib/hooks/use-page-title";
import { adminHeaders } from "@/lib/auth/admin-fetch";
import {
  CATEGORY_LABELS,
  ALL_CATEGORIES,
  getCategoryLabel,
  isPredefinedCategory,
} from "@/lib/expenses/categories";
import { ExpenseEntrySheet } from "@/components/admin/expense-entry-sheet";

interface Expense {
  id: string;
  date: string;
  amount: number;
  /** V3.7 P1-4 — free-text. Predefined enum gets Chinese label, custom shows raw. */
  category: string;
  type: "FIXED" | "VARIABLE";
  paidMethod: "CASH" | "BANK_TRANSFER";
  notes: string | null;
  receiptUrl: string | null;
  recurringRuleId: string | null;
}

const fetcher = async (url: string): Promise<{ expenses: Expense[] }> => {
  const r = await fetch(url, { headers: adminHeaders() });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
};

function monthBounds(year: number, month: number): { from: string; to: string } {
  // month is 1-indexed (1=Jan, 12=Dec). Returns YYYY-MM-DD inclusive bounds.
  const pad = (n: number) => n.toString().padStart(2, "0");
  const from = `${year}-${pad(month)}-01`;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const to = `${year}-${pad(month)}-${pad(lastDay)}`;
  return { from, to };
}

function todayMonth(): { year: number; month: number } {
  // Use Taipei timezone date.
  const d = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Taipei" }));
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

export default function ExpensesPage() {
  usePageTitle("支出總覽");
  const { toast } = useToast();
  const [{ year, month }, setYM] = useState(todayMonth);
  const [search, setSearch] = useState("");
  // V3.7 P1-4 — free-text category filter (enum + custom strings 共存).
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [entrySheetOpen, setEntrySheetOpen] = useState(false);

  const { from, to } = useMemo(() => monthBounds(year, month), [year, month]);
  const { data, isLoading, mutate } = useSWR(
    `/api/expenses?from=${from}&to=${to}`,
    fetcher,
    { keepPreviousData: true },
  );

  // Client-side filter by search + category. Search matches notes OR Chinese
  // category label OR raw category key (老闆可能輸入「房租」也可能輸入英文也可能輸入自訂 label).
  const filtered = useMemo(() => {
    let rows = data?.expenses ?? [];
    if (categoryFilter) rows = rows.filter((e) => e.category === categoryFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter((e) => {
        const label = getCategoryLabel(e.category).toLowerCase();
        const notes = (e.notes ?? "").toLowerCase();
        return label.includes(q) || notes.includes(q) || e.category.toLowerCase().includes(q);
      });
    }
    return rows;
  }, [data, search, categoryFilter]);

  // V3.7 P1-4 — distinct custom categories accumulated from the rendered month,
  // so the owner can chip-filter their own labels (e.g. 「保時捷保養」).
  const customCategories = useMemo(() => {
    const set = new Set<string>();
    for (const e of data?.expenses ?? []) {
      if (!isPredefinedCategory(e.category)) set.add(e.category);
    }
    return [...set].sort();
  }, [data]);

  const monthTotal = filtered.reduce((s, e) => s + e.amount, 0);
  const monthLabel = `${year} 年 ${month} 月`;

  // V3.7 5/19 reflect — owner asked for a delete button on this page (was only
  // on /reports daily view). DELETE /api/expenses/[id] already exists; recurring
  // rows are skipped (they'd regenerate from the cron rule anyway).
  const handleDelete = async (e: Expense) => {
    if (e.recurringRuleId) return;
    if (!confirm(`確定刪除這筆支出 NT$${e.amount.toLocaleString()}？`)) return;
    try {
      const res = await fetch(`/api/expenses/${e.id}`, {
        method: "DELETE",
        headers: adminHeaders(),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast({ type: "success", message: "已刪除" });
      mutate();
    } catch (err) {
      toast({
        type: "error",
        message:
          "刪除失敗：" + (err instanceof Error ? err.message : String(err)),
      });
    }
  };

  const prevMonth = () => {
    setYM(({ year, month }) =>
      month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 },
    );
  };
  const nextMonth = () => {
    setYM(({ year, month }) =>
      month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 },
    );
  };

  return (
    <div className="px-4 py-3 pb-24 max-w-2xl mx-auto">
      {/* Month nav */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={prevMonth}
          className="p-2 -ml-2 rounded-md hover:bg-[var(--color-surface)] min-h-[44px] min-w-[44px] flex items-center justify-center"
          aria-label="上個月"
        >
          <ChevronLeft size={20} />
        </button>
        <h1 className="text-lg font-bold text-[var(--color-text-primary)] tabular-nums">
          {monthLabel}
        </h1>
        <button
          onClick={nextMonth}
          className="p-2 -mr-2 rounded-md hover:bg-[var(--color-surface)] min-h-[44px] min-w-[44px] flex items-center justify-center"
          aria-label="下個月"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-3">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
        />
        <input
          type="search"
          placeholder="搜尋 (例：房租、髮油、12/15)"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-3 rounded-lg bg-[var(--color-surface)] text-sm text-[var(--color-text-body)] placeholder:text-[var(--color-text-muted)] outline-none focus:ring-2 focus:ring-[var(--color-brand)]/40"
        />
      </div>

      {/* Category filter chips */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        <CategoryChip
          active={categoryFilter === ""}
          label="全部"
          onClick={() => setCategoryFilter("")}
        />
        {ALL_CATEGORIES.map((c) => (
          <CategoryChip
            key={c}
            active={categoryFilter === c}
            label={CATEGORY_LABELS[c]}
            onClick={() => setCategoryFilter(c)}
          />
        ))}
        {/* V3.7 P1-4 — owner-typed custom categories appear here. */}
        {customCategories.map((c) => (
          <CategoryChip
            key={c}
            active={categoryFilter === c}
            label={c}
            onClick={() => setCategoryFilter(c)}
          />
        ))}
      </div>

      {/* Total summary */}
      <div className="flex items-baseline justify-between mb-3 px-1">
        <span className="text-xs text-[var(--color-text-muted)]">
          {filtered.length} 筆{search || categoryFilter ? "（已篩選）" : ""}
        </span>
        <span className="text-base font-bold text-[var(--color-text-primary)] tabular-nums">
          NT${monthTotal.toLocaleString()}
        </span>
      </div>

      {/* Expense list */}
      {isLoading ? (
        <p className="text-center text-sm text-[var(--color-text-muted)] py-12">載入中...</p>
      ) : filtered.length === 0 ? (
        <p className="text-center text-sm text-[var(--color-text-muted)] py-12">
          {search || categoryFilter ? "符合條件的支出 0 筆" : "本月尚無支出紀錄"}
        </p>
      ) : (
        <div className="space-y-1.5">
          {filtered.map((e) => (
            <ExpenseRow key={e.id} expense={e} onDelete={() => handleDelete(e)} />
          ))}
        </div>
      )}

      {/* FAB — add expense */}
      <button
        onClick={() => setEntrySheetOpen(true)}
        className="fixed bottom-20 right-4 z-30 inline-flex items-center gap-1.5 h-14 px-5 rounded-full bg-[var(--color-brand)] text-[var(--color-bg)] font-semibold shadow-lg hover:opacity-90 active:opacity-80 transition-opacity"
        aria-label="新增支出"
      >
        <Plus size={20} />
        <span>新增支出</span>
      </button>

      <ExpenseEntrySheet
        open={entrySheetOpen}
        onOpenChange={setEntrySheetOpen}
        defaultDate={`${year}-${month.toString().padStart(2, "0")}-${new Date().getDate().toString().padStart(2, "0")}`}
        onCreated={() => {
          setEntrySheetOpen(false);
          mutate();
        }}
      />
    </div>
  );
}

function CategoryChip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs font-medium min-h-[36px] transition-colors ${
        active
          ? "bg-[var(--color-brand)] text-[var(--color-bg)]"
          : "bg-[var(--color-surface)] text-[var(--color-text-body)] hover:bg-[var(--color-brand)]/15"
      }`}
    >
      {label}
    </button>
  );
}

function ExpenseRow({
  expense,
  onDelete,
}: {
  expense: Expense;
  onDelete: () => void;
}) {
  const dateLabel = expense.date.slice(5).replace("-", "/"); // MM/DD
  const isRecurring = !!expense.recurringRuleId;
  return (
    <div className="grid grid-cols-[3rem_1fr_auto_auto] items-center gap-3 px-3 py-3 rounded-lg bg-[var(--color-bg)] border border-[var(--color-surface)]">
      <span className="font-mono tabular-nums text-sm text-[var(--color-text-muted)]">
        {dateLabel}
      </span>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="text-xs font-semibold text-[var(--color-brand)] bg-[var(--color-brand)]/10 px-1.5 py-0.5 rounded">
            {getCategoryLabel(expense.category)}
          </span>
          {isRecurring && (
            <span className="text-[10px] text-[var(--color-text-muted)] bg-[var(--color-surface)] px-1.5 py-0.5 rounded">
              週期
            </span>
          )}
          <span className="text-[10px] text-[var(--color-text-muted)]">
            {expense.paidMethod === "CASH" ? "現金" : "匯款"}
          </span>
        </div>
        {expense.notes && (
          <p className="text-sm text-[var(--color-text-body)] truncate" title={expense.notes}>
            {expense.notes}
          </p>
        )}
      </div>
      <span className="font-mono tabular-nums text-base font-bold text-[var(--color-text-primary)] whitespace-nowrap">
        NT${expense.amount.toLocaleString()}
      </span>
      {isRecurring ? (
        <button
          type="button"
          disabled
          aria-label="週期支出無法在此刪除"
          title="週期支出請從 設定→週期規則 移除"
          className="w-8 h-8 flex items-center justify-center text-[var(--color-text-disabled)] cursor-not-allowed"
        >
          <Trash2 size={14} aria-hidden />
        </button>
      ) : (
        <button
          type="button"
          onClick={onDelete}
          aria-label="刪除這筆支出"
          className="w-8 h-8 flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-danger)] active:text-[var(--color-danger)] rounded-md hover:bg-[var(--color-surface)] transition-colors"
        >
          <Trash2 size={16} aria-hidden />
        </button>
      )}
    </div>
  );
}
