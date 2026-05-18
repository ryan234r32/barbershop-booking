/**
 * V3.7 P2-2 — 諮詢待回紅點 banner (one-way mirror dashboard widget).
 *
 * 訪談 §10 老闆 design：PWA 不做訊息對話，只顯示「N 件諮詢待回」+ 客戶名 + 時間，
 * 老闆全在 LINE OA 回。回完點「標記已回」清紅點。
 *
 * 此 banner 顯示在 /more 頁頂部：
 *   - 0 件 pending → 不顯示
 *   - 有 pending → 列出最舊 N 件（客戶名 + 多久前），可 inline 標記已回
 *   - 點全部展開（>3 件時）→ 跳到 ConsultationsList route（暫無，留 placeholder）
 */
"use client";

import useSWR from "swr";
import { useState } from "react";
import { MessageCircle, Check } from "lucide-react";
import { adminHeaders } from "@/lib/auth/admin-fetch";
import { useToast } from "@/components/ui/toast";

interface ConsultationItem {
  id: string;
  status: string;
  createdAt: string;
  notes: string | null;
  serviceId: string | null;
  service: { id: string; name: string } | null;
  user: { id: string; displayName: string | null; phone: string | null; segment: string } | null;
  lineUserId: string;
}

interface ListResponse {
  items: ConsultationItem[];
  pendingCount: number;
}

const fetcher = async (url: string): Promise<ListResponse> => {
  const r = await fetch(url, { headers: adminHeaders() });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
};

/// 「6 小時前」 / 「3 天前」 — concise relative time. <1min shows 「剛剛」.
function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return "剛剛";
  if (m < 60) return `${m} 分鐘前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} 小時前`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} 天前`;
  return `${Math.floor(d / 30)} 個月前`;
}

export function ConsultationPendingBanner() {
  const { toast } = useToast();
  const { data, mutate } = useSWR<ListResponse>(
    "/api/consultations?status=PENDING&limit=10",
    fetcher,
    {
      revalidateOnFocus: true,
      refreshInterval: 5 * 60 * 1000, // 5min
    },
  );
  const [markingId, setMarkingId] = useState<string | null>(null);

  if (!data || data.items.length === 0) return null;

  const items = data.items.slice(0, 3);
  const more = data.items.length - items.length;

  const markReplied = async (id: string) => {
    if (markingId) return;
    setMarkingId(id);
    try {
      const res = await fetch(`/api/consultations/${id}`, {
        method: "PATCH",
        headers: { ...adminHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ status: "REPLIED" }),
      });
      if (!res.ok) throw new Error("操作失敗");
      await mutate();
      toast({ type: "success", message: "已標記為已回" });
    } catch (err) {
      toast({ type: "error", message: err instanceof Error ? err.message : "操作失敗" });
    } finally {
      setMarkingId(null);
    }
  };

  return (
    <div className="mb-4 rounded-xl bg-[var(--color-warning)]/10 border border-[var(--color-warning)]/40 p-3">
      <div className="flex items-center gap-2 mb-2">
        <MessageCircle size={16} className="text-[var(--color-warning)]" aria-hidden />
        <span className="text-sm font-bold text-[var(--color-warning)]">
          {data.items.length} 件諮詢待回
        </span>
        <span className="text-[11px] text-[var(--color-text-muted)] ml-auto">
          老闆在 LINE OA 回完後點「已回」
        </span>
      </div>

      <ul className="space-y-1.5">
        {items.map((c) => (
          <li
            key={c.id}
            className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-white border border-[var(--color-text-muted)]/10"
          >
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-semibold text-[var(--color-text-primary)] truncate">
                {c.user?.displayName || "未綁定 LINE 顧客"}
                {c.service && (
                  <span className="ml-1.5 text-[11px] text-[var(--color-text-muted)] font-normal">
                    · {c.service.name}
                  </span>
                )}
              </div>
              <div className="text-[11px] text-[var(--color-text-muted)]">
                {relativeTime(c.createdAt)}
                {c.notes ? ` · ${c.notes.slice(0, 30)}${c.notes.length > 30 ? "…" : ""}` : ""}
              </div>
            </div>
            <button
              onClick={() => markReplied(c.id)}
              disabled={markingId === c.id}
              className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-[var(--color-success)]/15 text-[var(--color-success)] text-[11px] font-medium disabled:opacity-50"
            >
              <Check size={11} aria-hidden />
              已回
            </button>
          </li>
        ))}
      </ul>

      {more > 0 && (
        <p className="text-[11px] text-[var(--color-text-muted)] text-center mt-2">
          還有 {more} 件未顯示
        </p>
      )}
    </div>
  );
}
