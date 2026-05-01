"use client";

import { useState } from "react";
import Link from "next/link";
import { usePageTitle } from "@/lib/hooks/use-page-title";
import useSWR from "swr";
import { Search, ChevronLeft } from "lucide-react";
import { CustomerAnalyticsView } from "@/components/admin/customers/analytics-view";

interface Customer {
  id: string;
  displayName: string | null;
  realName: string | null;
  phone: string | null;
  segment: string;
  isVip: boolean;
  totalVisits: number;
  lastVisitAt: string | null;
  violationCount: number;
}

const SEGMENTS = [
  { key: "", label: "全部" },
  { key: "NEW", label: "新客" },
  { key: "REGULAR", label: "常客" },
  { key: "VIP", label: "VIP" },
  { key: "AT_RISK", label: "流失中" },
  { key: "LAPSED", label: "已流失" },
];

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

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function relativeTime(dateStr: string | null): string {
  if (!dateStr) return "—";
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return "今天";
  if (days === 1) return "昨天";
  if (days < 30) return `${days}天前`;
  if (days < 365) return `${Math.floor(days / 30)}個月前`;
  return `${Math.floor(days / 365)}年前`;
}

type View = "list" | "analytics";

export default function CustomersPage() {
  usePageTitle("顧客管理");
  const [view, setView] = useState<View>("list");
  const [search, setSearch] = useState("");
  const [segment, setSegment] = useState("");
  const [page, setPage] = useState(1);

  const params = new URLSearchParams();
  if (search) params.set("search", search);
  if (segment) params.set("segment", segment);
  params.set("page", page.toString());

  const { data, isLoading } = useSWR(view === "list" ? `/api/customers?${params}` : null, fetcher);
  const customers: Customer[] = data?.customers || [];
  const total: number = data?.total || 0;
  const totalPages = Math.ceil(total / 20);

  return (
    <div className="max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <Link href="/more" className="p-1.5 rounded-lg hover:bg-[var(--color-surface)] lg:hidden">
          <ChevronLeft size={20} className="text-[var(--color-text-body)]" />
        </Link>
        <h1 className="text-xl font-bold text-[var(--color-text-primary)] tracking-wide">
          顧客
        </h1>
      </div>

      {/* View tabs */}
      <div className="flex gap-1 bg-[var(--color-surface)] rounded-lg p-1 mb-4">
        {[
          { key: "list" as const, label: "清單" },
          { key: "analytics" as const, label: "分析" },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setView(t.key)}
            className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
              view === t.key
                ? "bg-[var(--color-bg)] text-[var(--color-brand)] shadow-sm"
                : "text-[var(--color-text-muted)]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {view === "analytics" ? (
        <CustomerAnalyticsView />
      ) : (
        <ListView
          search={search}
          setSearch={setSearch}
          segment={segment}
          setSegment={setSegment}
          page={page}
          setPage={setPage}
          customers={customers}
          isLoading={isLoading}
          totalPages={totalPages}
        />
      )}
    </div>
  );
}

interface ListViewProps {
  search: string;
  setSearch: (v: string) => void;
  segment: string;
  setSegment: (v: string) => void;
  page: number;
  setPage: (v: number) => void;
  customers: Customer[];
  isLoading: boolean;
  totalPages: number;
}

function ListView({ search, setSearch, segment, setSegment, page, setPage, customers, isLoading, totalPages }: ListViewProps) {
  return (
    <>
      {/* Search */}
      <div className="relative mb-3">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="搜尋姓名或電話"
          className="w-full pl-9 pr-3 py-2.5 bg-[var(--color-surface)] rounded-lg text-sm text-[var(--color-text-body)] placeholder:text-[var(--color-text-disabled)] outline-none"
        />
      </div>

      {/* Filter chips */}
      <div className="flex gap-2 overflow-x-auto pb-3 mb-3 scrollbar-hide">
        {SEGMENTS.map((s) => (
          <button
            key={s.key}
            onClick={() => { setSegment(s.key); setPage(1); }}
            className={`shrink-0 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              segment === s.key
                ? "bg-[var(--color-brand)] text-[var(--color-bg)]"
                : "bg-[var(--color-surface)] text-[var(--color-text-body)]"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="py-12 text-center">
          <div className="w-6 h-6 border-2 border-[var(--color-brand)] border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      ) : customers.length === 0 ? (
        <p className="py-12 text-center text-sm text-[var(--color-text-muted)]">沒有找到顧客</p>
      ) : (
        <div className="space-y-0.5">
          {customers.map((c) => (
            <Link
              key={c.id}
              href={`/customers/${c.id}`}
              className="flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-[var(--color-surface)] transition-colors"
            >
              {/* Avatar */}
              <div className="w-10 h-10 rounded-full bg-[var(--color-surface)] flex items-center justify-center text-sm font-semibold text-[var(--color-brand)] shrink-0">
                {(c.displayName || c.realName || "?")[0]}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-semibold text-[var(--color-text-primary)] truncate">
                  {c.displayName || c.realName || "未知"}
                </p>
                <p className="text-xs text-[var(--color-text-muted)]">
                  {c.totalVisits} 次 · 上次 {relativeTime(c.lastVisitAt)}
                </p>
              </div>

              {/* Segment badge */}
              <span className={`shrink-0 px-2 py-0.5 rounded text-[10px] font-medium tracking-wider ${SEGMENT_STYLE[c.segment] || SEGMENT_STYLE.NEW}`}>
                {SEGMENT_LABEL[c.segment] || c.segment}
              </span>
            </Link>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-1 mt-4 pt-4 border-t border-[var(--color-surface)]">
          {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => (
            <button
              key={i}
              onClick={() => setPage(i + 1)}
              className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors ${
                page === i + 1
                  ? "bg-[var(--color-brand)] text-[var(--color-bg)]"
                  : "text-[var(--color-text-muted)] hover:bg-[var(--color-surface)]"
              }`}
            >
              {i + 1}
            </button>
          ))}
        </div>
      )}
    </>
  );
}
