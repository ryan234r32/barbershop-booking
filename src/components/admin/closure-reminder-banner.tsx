/**
 * V3.7 Tier 1.3 minimal — 公休提醒 banner.
 *
 * 顯示在 /more 頁面頂部（dashboard-ish location）。
 * 如果未來 30-60 天內有月份 0 holidays → 顯示「{月} 還沒設特殊公休」+ link to /settings。
 *
 * Per autoplan consensus D-G: 「dashboard banner + monthly setup task」
 * 取代 hostile 強制 modal。可關閉但不阻塞。
 */
"use client";

import useSWR from "swr";
import Link from "next/link";
import { AlertTriangle, X } from "lucide-react";
import { useState } from "react";
import { adminHeaders } from "@/lib/auth/admin-fetch";

interface MonthStatus {
  year: number;
  month: number;
  label: string;
  holidayCount: number;
  daysUntilMonthStart: number;
}

interface ClosureStatus {
  months: MonthStatus[];
  needsAttention: MonthStatus[];
}

const fetcher = async (url: string): Promise<ClosureStatus> => {
  const r = await fetch(url, { headers: adminHeaders() });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
};

const DISMISS_KEY = "closure-banner-dismissed-v1";

function isDismissedToday(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const stored = sessionStorage.getItem(DISMISS_KEY);
    if (!stored) return false;
    const dismissedDate = new Date(stored).toDateString();
    return dismissedDate === new Date().toDateString();
  } catch {
    return false;
  }
}

export function ClosureReminderBanner() {
  const [dismissed, setDismissed] = useState(isDismissedToday);
  const { data } = useSWR<ClosureStatus>("/api/admin/closure-status", fetcher, {
    revalidateOnFocus: false,
    refreshInterval: 60 * 60 * 1000, // 1hr
  });

  if (dismissed) return null;
  if (!data || data.needsAttention.length === 0) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem(DISMISS_KEY, new Date().toISOString());
    } catch {
      /* ignore */
    }
  };

  // Show the earliest month that needs attention (highest urgency).
  const next = data.needsAttention[0];
  const urgency = next.daysUntilMonthStart <= 14 ? "high" : "medium";

  return (
    <div
      className={`mb-4 rounded-lg border p-3 ${
        urgency === "high"
          ? "bg-[var(--color-warning)]/10 border-[var(--color-warning)]/40"
          : "bg-[var(--color-brand)]/8 border-[var(--color-brand)]/30"
      }`}
      role="alert"
    >
      <div className="flex items-start gap-2">
        <AlertTriangle
          size={18}
          className={
            urgency === "high"
              ? "text-[var(--color-warning)] shrink-0 mt-0.5"
              : "text-[var(--color-brand)] shrink-0 mt-0.5"
          }
          aria-hidden
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[var(--color-text-primary)] leading-tight">
            {next.label} 還沒設特殊公休
          </p>
          <p className="text-xs text-[var(--color-text-muted)] mt-1 leading-relaxed">
            預約窗 45 天 + 緩衝 = 客人現在已可預約到 {next.label}。
            若該月有家庭聚餐 / 旅遊等請現在去設定，避免客人約到你不在的時段。
            {data.needsAttention.length > 1 && (
              <span className="block mt-1">
                共 {data.needsAttention.length} 個月份未設定。
              </span>
            )}
          </p>
          {/* 5/19 bug fix: 之前連到 /settings，但 V3.7 P1-3 把公休管理移到 /closures
              calendar-first 頁面。/settings 沒有月底公休的設定 UI。 */}
          <Link
            href="/closures"
            className="inline-flex items-center mt-2 px-3 py-1.5 rounded-md bg-[var(--color-brand)] text-[var(--color-bg)] text-xs font-semibold hover:opacity-90"
          >
            前往設定公休
          </Link>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="今天不再顯示"
          className="shrink-0 -mt-1 -mr-1 w-7 h-7 rounded-full flex items-center justify-center text-[var(--color-text-muted)] hover:bg-[var(--color-surface)]"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
