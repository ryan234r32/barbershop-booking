"use client";

/**
 * V3.6 §14.6 — admin 監控頁元件。
 * 顯示今日推播計畫 + 7 日趨勢 + 點開可手動 pause/skip。
 */

import useSWR from "swr";
import { adminHeaders } from "@/lib/auth/admin-fetch";

interface RetentionData {
  today: Record<
    string,
    Record<string, { sent: number; queued: number; failed: number; skipped: number }>
  >;
  todayTotal: number;
  todaySent: number;
  daily: Array<{ date: string; sent: number; converted: number }>;
  conversionRate7d: number;
}

const fetcher = (url: string) =>
  fetch(url, { headers: adminHeaders() }).then((r) => {
    if (!r.ok) throw new Error(String(r.status));
    return r.json();
  });

export function RetentionPushWidget() {
  const { data, error } = useSWR<RetentionData>("/api/admin/retention-push", fetcher, {
    refreshInterval: 60000,
  });

  if (error) {
    return (
      <div className="bg-[var(--color-danger)]/10 rounded-xl p-4 text-xs text-[var(--color-danger)]">
        推播統計載入失敗
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-[var(--color-surface)] rounded-2xl p-5 animate-pulse h-32" />
    );
  }

  const totalToday = data.todayTotal;
  return (
    <div className="bg-[var(--color-bg)] border border-[var(--color-brand)]/12 rounded-2xl p-4 sm:p-5">
      <div className="flex items-baseline justify-between mb-3">
        <p className="text-sm font-bold text-[var(--color-text-primary)]">
          🔔 自動推播系統
        </p>
        <p className="text-[10px] text-[var(--color-text-muted)] tabular-nums">
          7 日轉化率 {data.conversionRate7d.toFixed(1)}%
        </p>
      </div>

      <div className="space-y-1.5 text-xs">
        <Line
          label="軟提醒"
          data={data.today.SOFT_REMINDER}
          color="var(--color-text-muted)"
        />
        <Line
          label="9 折券"
          data={data.today.DISCOUNT_10}
          color="var(--color-warning)"
        />
        <Line
          label="召回券"
          data={data.today.WINBACK}
          color="var(--color-danger)"
        />
      </div>

      <div className="mt-3 pt-3 border-t border-[var(--color-brand)]/8">
        <p className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] mb-1.5">
          7 日趨勢
        </p>
        <div className="flex items-end justify-between gap-1 h-12">
          {data.daily.map((d) => {
            const max = Math.max(...data.daily.map((x) => x.sent), 1);
            const h = (d.sent / max) * 100;
            return (
              <div
                key={d.date}
                className="flex-1 flex flex-col items-center gap-0.5"
                title={`${d.date}: 發送 ${d.sent} / 轉換 ${d.converted}`}
              >
                <div className="text-[9px] tabular-nums text-[var(--color-text-muted)]">
                  {d.sent || ""}
                </div>
                <div
                  className="w-full bg-[var(--color-brand)]/40 rounded-t-sm"
                  style={{ height: `${h}%`, minHeight: d.sent > 0 ? "4px" : "1px" }}
                />
              </div>
            );
          })}
        </div>
        <div className="flex items-end justify-between text-[9px] text-[var(--color-text-muted)] mt-1">
          {data.daily.map((d) => (
            <span key={d.date} className="flex-1 text-center font-mono">
              {d.date.slice(5)}
            </span>
          ))}
        </div>
      </div>

      <p className="text-[10px] text-[var(--color-text-muted)] mt-3">
        💡 今日預定 {totalToday} 則 · 已發 {data.todaySent} 則
      </p>
    </div>
  );
}

function Line({
  label,
  data,
  color,
}: {
  label: string;
  data: Record<string, { sent: number; queued: number; failed: number; skipped: number }>;
  color: string;
}) {
  const cut = data["剪髮"];
  const dye = data["染髮"];
  const perm = data["燙髮"];
  const total = cut.sent + dye.sent + perm.sent + cut.queued + dye.queued + perm.queued;
  return (
    <div className="flex items-center gap-2 text-[var(--color-text-body)]">
      <span
        className="inline-block w-2 h-2 rounded-full shrink-0"
        style={{ backgroundColor: color }}
      />
      <span className="w-14 shrink-0 font-medium">{label}</span>
      <span className="tabular-nums font-mono text-[var(--color-text-primary)] font-semibold">
        {total}
      </span>
      <span className="text-[var(--color-text-muted)] tabular-nums text-[10px]">
        剪 {cut.sent}/{cut.queued} · 染 {dye.sent}/{dye.queued} · 燙 {perm.sent}/{perm.queued}
      </span>
    </div>
  );
}
