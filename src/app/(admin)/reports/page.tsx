"use client";

/**
 * V3.6 Reports — three-view system (daily / monthly / annual).
 *
 * Replaces the V3.5 single-shape "散裝指標頁" with three mental models:
 *   - daily: 對帳場景（老闆每天 8pm）
 *   - monthly: 診斷+警報+行動（月度策略檢討）
 *   - annual: 回顧+目標+PDF 列印（年底回顧 / 年初設目標）
 *
 * URL state:
 *   /reports                                 → monthly, current month
 *   /reports?view=daily                      → daily, today
 *   /reports?view=daily&date=2026-04-26      → daily, specific
 *   /reports?view=monthly&period=2025-12     → monthly, specific
 *   /reports?view=annual&period=2025         → annual, specific
 *
 * Backwards-compat: /reports?range=year&offset=-1 → ?view=annual&period=2025
 */

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { preload } from "swr";
import dynamic from "next/dynamic";
import { usePageTitle } from "@/lib/hooks/use-page-title";
import { todayInTaipei } from "@/lib/utils/time";
import { adminHeaders } from "@/lib/auth/admin-fetch";
import { MToggle } from "@/components/admin/reports/v3.6/m-toggle";
import { PastDueBanner } from "@/components/admin/past-due-banner";

// V3.8 perf (Wave 2): code-split 3 個 view — 首次進 /reports 時老闆只看一個視圖，
// 不需要立刻載入另外 2 個（每個 view 帶其專屬的 widget cluster 和 useSWR hooks）。
// SSR 預設 true（Next 16 admin pages 走 client-component 但 dynamic 仍能 split bundle）。
const DailyView = dynamic(
  () => import("./views/daily").then((m) => ({ default: m.DailyView })),
  { loading: () => <ViewSkeleton /> },
);
const MonthlyView = dynamic(
  () => import("./views/monthly").then((m) => ({ default: m.MonthlyView })),
  { loading: () => <ViewSkeleton /> },
);
const AnnualView = dynamic(
  () => import("./views/annual").then((m) => ({ default: m.AnnualView })),
  { loading: () => <ViewSkeleton /> },
);

function ViewSkeleton() {
  return (
    <div className="space-y-3">
      <div className="h-12 bg-[var(--color-surface)] rounded-lg animate-pulse" />
      <div className="h-32 bg-[var(--color-surface)] rounded-lg animate-pulse" />
      <div className="h-48 bg-[var(--color-surface)] rounded-lg animate-pulse" />
    </div>
  );
}

const reportsFetcher = (url: string) =>
  fetch(url, { headers: adminHeaders() }).then((r) => {
    if (!r.ok) throw new Error(String(r.status));
    return r.json();
  });

type ViewKind = "daily" | "monthly" | "annual";

function ReportsPageInner() {
  usePageTitle("財務");
  const sp = useSearchParams();

  // Backwards-compat: V3.5 used ?range=year&offset=-1 — rewrite to V3.6 shape.
  const compat = useMemo(() => {
    const range = sp.get("range");
    const offset = sp.get("offset");
    if (!range || sp.get("view")) return null;
    const todayY = parseInt(todayInTaipei().slice(0, 4), 10);
    const todayM = parseInt(todayInTaipei().slice(5, 7), 10);
    const off = parseInt(offset ?? "0", 10) || 0;
    if (range === "year") return { view: "annual" as ViewKind, period: String(todayY + off) };
    if (range === "month") {
      const idx = todayY * 12 + (todayM - 1) + off;
      const y = Math.floor(idx / 12);
      const m = (idx % 12) + 1;
      return { view: "monthly" as ViewKind, period: `${y}-${String(m).padStart(2, "0")}` };
    }
    if (range === "week") return { view: "daily" as ViewKind, period: todayInTaipei() };
    return null;
  }, [sp]);

  // V3.8: 老闆指定預設進「每日對帳」（原本 default monthly，但日常使用是每天
  // 8pm 對帳，每日是更高頻的入口）。
  const initialView = (sp.get("view") ?? compat?.view ?? "daily") as ViewKind;
  const rawInitialPeriod = sp.get("period") ?? sp.get("date") ?? compat?.period ?? defaultPeriodFor(initialView);
  const initialPeriod = normalizePeriod(initialView, rawInitialPeriod);

  const [view, setView] = useState<ViewKind>(initialView);
  const [period, setPeriod] = useState<string>(initialPeriod);

  // Prefetch the other two views on mount so tab-switching is instant.
  // Boss's typical flow: open /reports → switch between daily/monthly/annual
  // multiple times. By firing all three in parallel here, the second + third
  // tab clicks hit SWR cache (memory if same session, localStorage if PWA
  // restart) instead of waiting on 15 parallel DB queries each.
  useEffect(() => {
    const today = todayInTaipei();
    preload(`/api/reports/v3.6?view=daily&date=${today}`, reportsFetcher);
    preload(`/api/reports/v3.6?view=monthly&period=${today.slice(0, 7)}`, reportsFetcher);
    preload(`/api/reports/v3.6?view=annual&period=${today.slice(0, 4)}`, reportsFetcher);
  }, []);

  // Mirror state to URL (without history pollution)
  useEffect(() => {
    const params = new URLSearchParams();
    params.set("view", view);
    params.set(view === "daily" ? "date" : "period", period);
    const url = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState(null, "", url);
  }, [view, period]);

  return (
    <main className="p-4 sm:p-6 max-w-5xl mx-auto space-y-4 print:p-0 print:max-w-none">
      <h1 className="text-2xl font-bold text-[var(--color-text-primary)] print:hidden">財務</h1>

      {/* V3.7 §C — 過期未對帳 banner（取代強制 modal）。零筆時自動隱藏。 */}
      <div className="print:hidden">
        <PastDueBanner />
      </div>

      <div className="print:hidden">
        <MToggle<ViewKind>
          options={[
            { value: "daily", label: "每日 · 對帳" },
            { value: "monthly", label: "每月 · 診斷" },
            { value: "annual", label: "每年 · 回顧" },
          ]}
          value={view}
          onChange={(v) => {
            setView(v);
            setPeriod(defaultPeriodFor(v));
          }}
        />
      </div>

      {view === "daily" && <DailyView date={period} onDateChange={setPeriod} />}
      {view === "monthly" && <MonthlyView period={period} onPeriodChange={setPeriod} />}
      {view === "annual" && <AnnualView period={period} onPeriodChange={setPeriod} />}
    </main>
  );
}

function defaultPeriodFor(v: ViewKind): string {
  const today = todayInTaipei();
  if (v === "daily") return today;
  if (v === "monthly") return today.slice(0, 7);
  return today.slice(0, 4);
}

function normalizePeriod(v: ViewKind, candidate: string): string {
  if (v === "daily" && /^\d{4}-\d{2}-\d{2}$/.test(candidate)) return candidate;
  if (v === "monthly" && /^\d{4}-\d{2}$/.test(candidate)) return candidate;
  if (v === "annual" && /^\d{4}$/.test(candidate)) return candidate;
  return defaultPeriodFor(v);
}

export default function ReportsPage() {
  return (
    <Suspense fallback={<div className="p-4">載入中...</div>}>
      <ReportsPageInner />
    </Suspense>
  );
}
