"use client";

/**
 * V3.7 P1-3 — 公休管理：calendar-first UI.
 *
 * 設計原則（老闆 5/17 訪談）：進來就看到月曆，點日期可設時段；不要先看到店家資訊。
 * - 月曆 grid（週日起算），每格顯示日期 + 公休徽章（整天紅 / 半天橙）
 * - 點日期 → modal：選「全天公休」或「部分時段公休（HH:00 - HH:00）」
 * - 已有公休的日期 → modal 顯示現況 + 移除 button
 * - 每週固定公休（週四等）以淺底背景區分，但點下去仍可加當日特例
 */

import { useMemo, useState } from "react";
import useSWR from "swr";
import { ChevronLeft, ChevronRight, X, Trash2 } from "lucide-react";
import { adminHeaders } from "@/lib/auth/admin-fetch";
import { useToast } from "@/components/ui/toast";

interface Holiday {
  id: string;
  date: string; // ISO "YYYY-MM-DD..."
  startTime: string | null;
  endTime: string | null;
  reason: string | null;
}

interface ClosureConflict {
  id: string;
  startTime: string;
  endTime: string;
  customerName: string;
  customerPhone: string | null;
  customerLineUserId: string;
  serviceName: string;
}

interface BusinessConfig {
  closedWeekdays: number[];
}

const fetcher = (url: string) =>
  fetch(url, { headers: adminHeaders() }).then((r) => r.json());

const WEEKDAY_LABELS = ["日", "一", "二", "三", "四", "五", "六"];
// 11:00–20:00 整點選項（與營業時間一致）
const HOUR_OPTIONS = Array.from({ length: 10 }, (_, i) => 11 + i);

function ymd(date: Date): string {
  return date.toLocaleDateString("en-CA", { timeZone: "Asia/Taipei" });
}

function holidayDateKey(h: Holiday): string {
  return h.date.slice(0, 10);
}

export default function ClosuresPage() {
  const today = new Date();
  const [cursor, setCursor] = useState({
    year: today.getFullYear(),
    month: today.getMonth(),
  });
  const [activeDate, setActiveDate] = useState<string | null>(null);

  const { data: holidaysData, mutate: refreshHolidays } = useSWR<{ holidays: Holiday[] }>(
    "/api/admin/holidays",
    fetcher,
  );
  const { data: configData } = useSWR<BusinessConfig>("/api/business-config", fetcher);

  const holidaysByDate = useMemo(() => {
    const map = new Map<string, Holiday>();
    for (const h of holidaysData?.holidays ?? []) {
      map.set(holidayDateKey(h), h);
    }
    return map;
  }, [holidaysData]);

  const closedWeekdays = new Set(configData?.closedWeekdays ?? []);

  const monthDays = useMemo(() => buildMonthGrid(cursor.year, cursor.month), [cursor]);
  const monthLabel = `${cursor.year} 年 ${cursor.month + 1} 月`;

  const goPrev = () => {
    setCursor((c) => {
      const m = c.month - 1;
      return m < 0 ? { year: c.year - 1, month: 11 } : { year: c.year, month: m };
    });
  };
  const goNext = () => {
    setCursor((c) => {
      const m = c.month + 1;
      return m > 11 ? { year: c.year + 1, month: 0 } : { year: c.year, month: m };
    });
  };

  const activeHoliday = activeDate ? holidaysByDate.get(activeDate) ?? null : null;
  const todayKey = ymd(today);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <header className="flex items-center justify-between mb-5">
        <button onClick={goPrev} className="p-2 -ml-2 text-[var(--color-text-primary)]" aria-label="上個月">
          <ChevronLeft size={22} />
        </button>
        <h1 className="text-lg font-bold text-[var(--color-text-primary)]">{monthLabel}</h1>
        <button onClick={goNext} className="p-2 -mr-2 text-[var(--color-text-primary)]" aria-label="下個月">
          <ChevronRight size={22} />
        </button>
      </header>

      <div className="grid grid-cols-7 text-center text-[11px] text-[var(--color-text-muted)] mb-1">
        {WEEKDAY_LABELS.map((w) => (
          <div key={w} className="py-1">
            {w}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {monthDays.map((cell, idx) => {
          if (!cell) return <div key={idx} />;
          const key = ymd(cell);
          const holiday = holidaysByDate.get(key);
          const isPartial = !!(holiday?.startTime && holiday?.endTime);
          const isFull = !!holiday && !isPartial;
          const isWeeklyClosed = closedWeekdays.has(cell.getDay());
          const isToday = key === todayKey;
          const isPast = key < todayKey;

          return (
            <button
              key={idx}
              onClick={() => setActiveDate(key)}
              className={`
                aspect-square flex flex-col items-center justify-center rounded-lg
                text-sm relative
                ${isFull ? "bg-[var(--color-danger)]/15 text-[var(--color-danger)] font-bold" : ""}
                ${isPartial ? "bg-[var(--color-warning)]/15 text-[var(--color-warning)]" : ""}
                ${!holiday && isWeeklyClosed ? "bg-[var(--color-surface)] text-[var(--color-text-muted)]" : ""}
                ${!holiday && !isWeeklyClosed ? "bg-white hover:bg-[var(--color-surface)] text-[var(--color-text-primary)]" : ""}
                ${isPast ? "opacity-50" : ""}
                ${isToday ? "ring-2 ring-[var(--color-brand)]" : ""}
                border border-[var(--color-text-muted)]/10
              `}
            >
              <span>{cell.getDate()}</span>
              {isFull && <span className="text-[9px] mt-0.5">整天</span>}
              {isPartial && (
                <span className="text-[9px] mt-0.5">
                  {holiday!.startTime!.slice(0, 5)}–{holiday!.endTime!.slice(0, 5)}
                </span>
              )}
              {!holiday && isWeeklyClosed && <span className="text-[9px] mt-0.5">週休</span>}
            </button>
          );
        })}
      </div>

      <div className="mt-5 text-[12px] text-[var(--color-text-muted)] space-y-1">
        <div className="flex items-center gap-2">
          <span className="inline-block w-3 h-3 rounded bg-[var(--color-danger)]/30" />
          整天公休
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block w-3 h-3 rounded bg-[var(--color-warning)]/30" />
          部分時段公休（例：每週四 11–13 健身）
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block w-3 h-3 rounded bg-[var(--color-surface)] border border-[var(--color-text-muted)]/30" />
          每週固定公休（在「店鋪設定」改）
        </div>
      </div>

      {activeDate && (
        <ClosureModal
          date={activeDate}
          existing={activeHoliday}
          onClose={() => setActiveDate(null)}
          onSaved={async () => {
            await refreshHolidays();
            setActiveDate(null);
          }}
        />
      )}
    </div>
  );
}

function ClosureModal({
  date,
  existing,
  onClose,
  onSaved,
}: {
  date: string;
  existing: Holiday | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [mode, setMode] = useState<"full" | "partial">(
    existing?.startTime ? "partial" : "full",
  );
  const [startHour, setStartHour] = useState<number>(
    existing?.startTime ? parseInt(existing.startTime) : 11,
  );
  const [endHour, setEndHour] = useState<number>(
    existing?.endTime ? parseInt(existing.endTime) : 13,
  );
  const [reason, setReason] = useState(existing?.reason ?? "");
  const [submitting, setSubmitting] = useState(false);

  const headerDate = new Date(date + "T00:00:00+08:00");
  const dateLabel = `${headerDate.getMonth() + 1}/${headerDate.getDate()} (${WEEKDAY_LABELS[headerDate.getDay()]})`;

  /** V3.7 P2 (5/18 老闆反饋) — 衝突預約清單。第一次按儲存若 server 回 422
   *  + requiresConfirmation，先 show 衝突 modal；客戶確認後再帶 force=true. */
  const [conflicts, setConflicts] = useState<ClosureConflict[] | null>(null);

  const performSave = async (force: boolean) => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = { date };
      if (mode === "partial") {
        body.startTime = `${startHour.toString().padStart(2, "0")}:00`;
        body.endTime = `${endHour.toString().padStart(2, "0")}:00`;
      }
      if (reason.trim()) body.reason = reason.trim();
      if (force) body.force = true;
      const res = await fetch("/api/admin/holidays", {
        method: "POST",
        headers: adminHeaders(),
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 422 && data?.requiresConfirmation) {
        setConflicts(data.conflicts || []);
        return;
      }
      if (!res.ok) {
        throw new Error(data?.error || "儲存失敗");
      }
      toast({ type: "success", message: existing ? "已更新公休" : "已設為公休" });
      setConflicts(null);
      onSaved();
    } catch (err) {
      toast({ type: "error", message: err instanceof Error ? err.message : "儲存失敗" });
    } finally {
      setSubmitting(false);
    }
  };

  const save = async () => {
    if (mode === "partial" && startHour >= endHour) {
      toast({ type: "error", message: "結束時間必須晚於開始時間" });
      return;
    }
    await performSave(false);
  };

  const remove = async () => {
    if (!existing) return;
    if (!confirm(`移除 ${dateLabel} 的公休？`)) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/holidays?id=${existing.id}`, {
        method: "DELETE",
        headers: adminHeaders(),
      });
      if (!res.ok) throw new Error("移除失敗");
      toast({ type: "success", message: "已移除" });
      onSaved();
    } catch (err) {
      toast({ type: "error", message: err instanceof Error ? err.message : "移除失敗" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] bg-black/45 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        className="w-full max-w-md bg-[var(--color-bg)] rounded-t-2xl sm:rounded-2xl p-5 max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-[var(--color-text-primary)]">
            {dateLabel}
          </h3>
          <button onClick={onClose} className="text-[var(--color-text-muted)]" aria-label="關閉">
            <X size={20} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-4">
          <button
            onClick={() => setMode("full")}
            className={`py-3 rounded-lg text-sm font-medium border-2 ${
              mode === "full"
                ? "bg-[var(--color-danger)]/10 text-[var(--color-danger)] border-[var(--color-danger)]"
                : "bg-white text-[var(--color-text-body)] border-transparent"
            }`}
          >
            整天公休
          </button>
          <button
            onClick={() => setMode("partial")}
            className={`py-3 rounded-lg text-sm font-medium border-2 ${
              mode === "partial"
                ? "bg-[var(--color-warning)]/10 text-[var(--color-warning)] border-[var(--color-warning)]"
                : "bg-white text-[var(--color-text-body)] border-transparent"
            }`}
          >
            部分時段公休
          </button>
        </div>

        {mode === "partial" && (
          <div className="mb-4 grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] text-[var(--color-text-muted)] mb-1">
                開始
              </label>
              <select
                value={startHour}
                onChange={(e) => setStartHour(parseInt(e.target.value))}
                className="w-full px-3 py-2.5 rounded-lg border border-[var(--color-text-muted)]/20 bg-white text-sm"
              >
                {HOUR_OPTIONS.map((h) => (
                  <option key={h} value={h}>
                    {h.toString().padStart(2, "0")}:00
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] text-[var(--color-text-muted)] mb-1">
                結束
              </label>
              <select
                value={endHour}
                onChange={(e) => setEndHour(parseInt(e.target.value))}
                className="w-full px-3 py-2.5 rounded-lg border border-[var(--color-text-muted)]/20 bg-white text-sm"
              >
                {HOUR_OPTIONS.map((h) => (
                  <option key={h} value={h}>
                    {h.toString().padStart(2, "0")}:00
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        <div className="mb-5">
          <label className="block text-[11px] text-[var(--color-text-muted)] mb-1">
            原因（選填）
          </label>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value.slice(0, 60))}
            placeholder="例：健身、進修、家事"
            className="w-full px-3 py-2.5 rounded-lg border border-[var(--color-text-muted)]/20 bg-white text-sm"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={save}
            disabled={submitting}
            className="flex-1 h-12 rounded-lg bg-[var(--color-brand)] text-white font-bold text-sm disabled:opacity-50"
          >
            {submitting ? "儲存中…" : existing ? "更新" : "設為公休"}
          </button>
          {existing && (
            <button
              onClick={remove}
              disabled={submitting}
              className="h-12 px-4 rounded-lg bg-[var(--color-danger)]/10 text-[var(--color-danger)] font-medium text-sm disabled:opacity-50 inline-flex items-center gap-1.5"
              aria-label="移除公休"
            >
              <Trash2 size={16} aria-hidden />
              移除
            </button>
          )}
        </div>

        {/* V3.7 P2 conflict warning — server 偵測到該日期有現有預約，先讓
            老闆 review (改期 / 致電 / 強制設) 再儲存。 */}
        {conflicts && conflicts.length > 0 && (
          <div className="mt-5 rounded-xl bg-[var(--color-danger)]/8 border border-[var(--color-danger)]/40 p-3.5">
            <div className="flex items-start gap-2 mb-2">
              <span className="text-[var(--color-danger)] mt-px">⚠️</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-[var(--color-danger)]">
                  此日期已有 {conflicts.length} 筆預約衝突
                </p>
                <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
                  建議先通知客人改期或取消，再設定公休
                </p>
              </div>
            </div>
            <ul className="space-y-1.5 mb-3">
              {conflicts.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center justify-between bg-white rounded-lg px-2.5 py-2 text-[12px]"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-[var(--color-text-primary)] truncate">
                      {c.startTime.slice(0, 5)} {c.customerName}
                    </div>
                    <div className="text-[11px] text-[var(--color-text-muted)] truncate">
                      {c.serviceName}
                      {c.customerPhone ? ` · ${c.customerPhone}` : ""}
                    </div>
                  </div>
                  {c.customerLineUserId.startsWith("U") && (
                    <span className="text-[10px] text-[var(--color-brand)] bg-[var(--color-brand)]/10 px-1.5 py-0.5 rounded">
                      LINE
                    </span>
                  )}
                </li>
              ))}
            </ul>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setConflicts(null)}
                className="flex-1 h-10 rounded-lg bg-white border border-[var(--color-text-muted)]/20 text-sm font-medium text-[var(--color-text-body)]"
              >
                先處理客人
              </button>
              <button
                onClick={() => performSave(true)}
                disabled={submitting}
                className="flex-1 h-10 rounded-lg bg-[var(--color-danger)] text-white text-sm font-semibold disabled:opacity-50"
              >
                強制設定公休
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** Build a 6-row × 7-col month grid (Sun-first), padding empty cells at edges. */
function buildMonthGrid(year: number, month: number): Array<Date | null> {
  const first = new Date(year, month, 1);
  const startPad = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: Array<Date | null> = [];
  for (let i = 0; i < startPad; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}
