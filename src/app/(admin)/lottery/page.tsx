"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { ChevronLeft, Gift, BellRing, Check } from "lucide-react";
import { usePageTitle } from "@/lib/hooks/use-page-title";
import { useToast } from "@/components/ui/toast";

interface Winner {
  id: string;
  displayName: string | null;
  realName: string | null;
  phone: string | null;
  notified: boolean;
  redeemed: boolean;
}

interface LotteryState {
  window: { start: string; end: string; closed: boolean };
  eligibleCount: number;
  eligibleSample: Array<{
    id: string;
    displayName: string | null;
    realName: string | null;
  }>;
  winners: Winner[];
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("zh-TW", {
    month: "numeric",
    day: "numeric",
  });
}

export default function LotteryPage() {
  usePageTitle("上線抽獎");
  const { toast } = useToast();
  const { data, mutate, isLoading } = useSWR<LotteryState>(
    "/api/admin/lottery",
    fetcher,
  );
  const [drawing, setDrawing] = useState(false);
  const [notifying, setNotifying] = useState(false);
  const [drawCount, setDrawCount] = useState(5);

  async function handleDraw() {
    if (!confirm(`確定要從 ${data?.eligibleCount ?? 0} 位中抽 ${drawCount} 名？`)) return;
    setDrawing(true);
    try {
      const res = await fetch("/api/admin/lottery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count: drawCount }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast({ type: "error", message: json?.error?.message || "抽獎失敗" });
      } else {
        toast({
          type: "success",
          message: `已抽出 ${json.winners?.length ?? 0} 位中獎人`,
        });
        mutate();
      }
    } catch {
      toast({ type: "error", message: "網路錯誤" });
    } finally {
      setDrawing(false);
    }
  }

  async function handleNotifyAll() {
    if (!confirm("確定要推播 LINE 通知給所有未通知的中獎人？")) return;
    setNotifying(true);
    try {
      const res = await fetch("/api/admin/lottery/notify", { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        toast({ type: "error", message: json?.error?.message || "通知失敗" });
      } else {
        const parts = [`已推送 ${json.sent}`];
        if (json.skipped) parts.push(`跳過 ${json.skipped}`);
        if (json.failed) parts.push(`失敗 ${json.failed}`);
        toast({ type: "success", message: parts.join(" / ") });
        mutate();
      }
    } catch {
      toast({ type: "error", message: "網路錯誤" });
    } finally {
      setNotifying(false);
    }
  }

  async function handleToggleRedeemed(winner: Winner) {
    try {
      const res = await fetch(`/api/admin/lottery/${winner.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ redeemed: !winner.redeemed }),
      });
      if (!res.ok) {
        toast({ type: "error", message: "更新失敗" });
      } else {
        mutate();
      }
    } catch {
      toast({ type: "error", message: "網路錯誤" });
    }
  }

  const winners = data?.winners ?? [];
  const unnotifiedCount = winners.filter((w) => !w.notified).length;

  return (
    <div className="max-w-lg mx-auto pb-12">
      <div className="flex items-center gap-2 mb-4">
        <Link href="/more" className="p-1.5 rounded-lg hover:bg-[var(--color-surface)]">
          <ChevronLeft size={20} className="text-[var(--color-text-body)]" />
        </Link>
        <h1 className="text-xl font-bold text-[var(--color-text-primary)] tracking-wide">
          上線抽獎
        </h1>
      </div>

      {isLoading || !data ? (
        <div className="flex justify-center py-20">
          <div className="w-6 h-6 border-2 border-[var(--color-brand)] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Window + Eligible */}
          <div className="bg-[var(--color-surface)] rounded-xl p-4 mb-3">
            <p className="text-[10px] text-[var(--color-text-muted)] tracking-wider mb-1">
              活動期間
            </p>
            <p className="text-sm text-[var(--color-text-body)]">
              {formatDate(data.window.start)} – {formatDate(data.window.end)}
              {data.window.closed && (
                <span className="ml-2 text-xs text-[var(--color-warning)]">已截止</span>
              )}
            </p>
            <div className="flex items-baseline gap-2 mt-3">
              <p className="text-2xl font-bold text-[var(--color-text-primary)]">
                {data.eligibleCount}
              </p>
              <p className="text-xs text-[var(--color-text-muted)]">位符合資格未抽中</p>
            </div>
            {data.eligibleSample.length > 0 && (
              <p className="text-xs text-[var(--color-text-muted)] mt-1">
                最近：
                {data.eligibleSample
                  .map((u) => u.realName || u.displayName || "—")
                  .join("、")}
              </p>
            )}
          </div>

          {/* Draw control */}
          <div className="bg-[var(--color-surface)] rounded-xl p-4 mb-3">
            <p className="text-[10px] text-[var(--color-text-muted)] tracking-wider mb-2">
              抽獎
            </p>
            <div className="flex items-center gap-2 mb-3">
              <label className="text-sm text-[var(--color-text-body)]">抽出</label>
              <input
                type="number"
                min={1}
                max={20}
                value={drawCount}
                onChange={(e) =>
                  setDrawCount(Math.max(1, Math.min(20, Number(e.target.value) || 1)))
                }
                className="w-16 bg-white border border-[var(--color-text-disabled)]/40 rounded-lg px-2 py-1.5 text-center text-sm"
              />
              <label className="text-sm text-[var(--color-text-body)]">名中獎人</label>
            </div>
            <button
              onClick={handleDraw}
              disabled={drawing || data.eligibleCount === 0}
              className="w-full py-3 bg-[var(--color-brand)] text-white rounded-xl font-medium disabled:opacity-40 flex items-center justify-center gap-2"
            >
              <Gift size={16} />
              {drawing ? "抽獎中…" : data.eligibleCount === 0 ? "暫無符合資格者" : "立即抽獎"}
            </button>
          </div>

          {/* Winners list */}
          <div className="bg-[var(--color-surface)] rounded-xl p-4 mb-3">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] text-[var(--color-text-muted)] tracking-wider">
                中獎名單（{winners.length}）
              </p>
              {unnotifiedCount > 0 && (
                <button
                  onClick={handleNotifyAll}
                  disabled={notifying}
                  className="flex items-center gap-1 text-xs text-[var(--color-brand)] font-medium disabled:opacity-40"
                >
                  <BellRing size={12} />
                  {notifying ? "推送中…" : `通知 ${unnotifiedCount} 位`}
                </button>
              )}
            </div>

            {winners.length === 0 ? (
              <p className="text-sm text-[var(--color-text-muted)] text-center py-6">
                尚未抽獎
              </p>
            ) : (
              <div className="space-y-1">
                {winners.map((w) => (
                  <div
                    key={w.id}
                    className="flex items-center justify-between gap-2 px-2 py-2 rounded-lg hover:bg-white/50"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-[var(--color-text-body)] truncate">
                        {w.realName || w.displayName || "—"}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {w.phone && (
                          <span className="text-[11px] text-[var(--color-text-muted)]">
                            {w.phone}
                          </span>
                        )}
                        <span
                          className={`text-[10px] ${
                            w.notified
                              ? "text-[var(--color-success)]"
                              : "text-[var(--color-warning)]"
                          }`}
                        >
                          {w.notified ? "✓ 已通知" : "⚠ 未通知"}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleToggleRedeemed(w)}
                      className={`shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium ${
                        w.redeemed
                          ? "bg-[var(--color-success)]/15 text-[var(--color-success)]"
                          : "bg-white border border-[var(--color-text-disabled)]/40 text-[var(--color-text-body)]"
                      }`}
                    >
                      {w.redeemed && <Check size={12} />}
                      {w.redeemed ? "已兌現" : "尚未兌現"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-[var(--color-brand)]/5 border border-[var(--color-brand)]/15 rounded-xl p-3 text-xs text-[var(--color-text-muted)] leading-relaxed">
            <p className="mb-1">📋 流程</p>
            <p>1. 群發上線通知（執行 broadcast-launch 腳本）</p>
            <p>2. 客人填表 → 自動進入候選池</p>
            <p>3. 截止後點「立即抽獎」抽出中獎人</p>
            <p>4. 點「通知中獎人」推 LINE 給他們</p>
            <p>5. 中獎人到店剪髮時，點「已兌現」結案</p>
          </div>
        </>
      )}
    </div>
  );
}
