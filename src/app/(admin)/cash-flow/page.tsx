"use client";

/**
 * V3.5 §1.1.5 Daily Cash Flow page — owner's 8pm 對帳 view.
 *
 * Answers 「今天收了多少錢，怎麼來的」 in one page:
 *   - Header: today (or selected date) + total received
 *   - Split: from-checkout vs from-deposit (Tier S 預付/虛擬帳號)
 *   - Per-method breakdown (現金 / 匯款 / 綠界虛擬帳號 …)
 *
 * Reads /api/admin/cash-flow?date=YYYY-MM-DD. Date picker + week strip let
 * the owner sweep the past week without leaving the page.
 *
 * Phase 4 will likely fold this into the dashboard's 今日對帳 panel; for now
 * keep a dedicated page so it can be deep-linked / favorited.
 */

import { useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { adminHeaders } from "@/lib/auth/admin-fetch";
import { usePageTitle } from "@/lib/hooks/use-page-title";

interface MethodBucket {
  fromCheckout: number;
  fromDeposit: number;
  total: number;
}
interface CashFlowResponse {
  date: string;
  totalReceived: number;
  fromCheckout: number;
  fromDeposit: number;
  byMethod: Record<string, MethodBucket>;
  count: number;
}

const METHOD_LABELS: Record<string, { label: string; description: string; icon: string }> = {
  CASH: { label: "現金", description: "客人現場付現", icon: "💵" },
  BANK_TRANSFER: { label: "匯款 / 轉帳", description: "ATM 或網銀轉入", icon: "🏦" },
  ECPAY_ATM: { label: "綠界虛擬帳號", description: "Tier S 自動對帳", icon: "🟢" },
};

const fetcher = (url: string) => fetch(url, { headers: adminHeaders() }).then((r) => r.json());

function formatTaipeiToday(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Taipei" });
}

function shiftDate(yyyymmdd: string, days: number): string {
  const [y, m, d] = yyyymmdd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

export default function CashFlowPage() {
  usePageTitle("每日現金流");
  const router = useRouter();
  const today = formatTaipeiToday();
  const [date, setDate] = useState<string>(today);

  const { data, isLoading } = useSWR<CashFlowResponse>(
    `/api/admin/cash-flow?date=${date}`,
    fetcher,
    { revalidateOnFocus: true },
  );

  // 7-day strip ending today — quick sweep navigation.
  const weekStrip = useMemo(() => {
    const days: Array<{ date: string; label: string; weekday: string }> = [];
    for (let i = 6; i >= 0; i--) {
      const ds = shiftDate(today, -i);
      const dt = new Date(ds + "T00:00:00+08:00");
      days.push({
        date: ds,
        label: `${dt.getMonth() + 1}/${dt.getDate()}`,
        weekday: ["日", "一", "二", "三", "四", "五", "六"][dt.getDay()],
      });
    }
    return days;
  }, [today]);

  const dateLabel = useMemo(() => {
    const dt = new Date(date + "T00:00:00+08:00");
    return `${dt.getFullYear()} 年 ${dt.getMonth() + 1} 月 ${dt.getDate()} 日`;
  }, [date]);

  const isEmpty = data && data.count === 0;
  const methodKeys = data ? Object.keys(data.byMethod) : ["CASH", "BANK_TRANSFER", "ECPAY_ATM"];

  return (
    <div className="pb-24">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => router.back()}
          aria-label="返回"
          className="w-9 h-9 -ml-2 rounded-full flex items-center justify-center text-foreground hover:bg-card transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-base font-semibold text-foreground">每日現金流</h1>
        <button
          onClick={() => setDate(today)}
          className={`text-xs px-3 py-1.5 rounded-full transition-colors ${
            date === today
              ? "bg-[var(--color-brand)] text-[var(--color-bg)]"
              : "text-muted-foreground hover:bg-card"
          }`}
        >
          今天
        </button>
      </div>

      {/* Date picker + readable label */}
      <div className="mb-3 flex items-center gap-3">
        <input
          type="date"
          value={date}
          max={today}
          onChange={(e) => setDate(e.target.value)}
          className="bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none"
        />
        <span className="text-sm text-muted-foreground">{dateLabel}</span>
      </div>

      {/* Week strip */}
      <div className="flex gap-1.5 overflow-x-auto -mx-4 px-4 pb-2 mb-4 scrollbar-thin">
        {weekStrip.map((d) => {
          const selected = d.date === date;
          return (
            <button
              key={d.date}
              onClick={() => setDate(d.date)}
              className={`flex flex-col items-center justify-center min-w-[56px] py-2 px-2 rounded-lg border transition-colors ${
                selected
                  ? "bg-[var(--color-brand)] border-[var(--color-brand)] text-[var(--color-bg)]"
                  : "bg-card border-border text-foreground hover:bg-background"
              }`}
            >
              <span className="text-[10px] opacity-80">週{d.weekday}</span>
              <span className="text-sm font-medium tabular-nums mt-0.5">{d.label}</span>
            </button>
          );
        })}
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 border-[var(--color-brand)] border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {!isLoading && data && (
        <>
          {/* Total */}
          <div className="bg-card rounded-xl border border-border p-5 mb-4">
            <p className="text-xs text-muted-foreground mb-1">當日總收款</p>
            <p className="text-3xl font-bold text-foreground tabular-nums">
              NT${data.totalReceived.toLocaleString()}
            </p>
            <div className="grid grid-cols-2 gap-2 mt-4">
              <div className="rounded-lg bg-background border border-border/50 p-3">
                <p className="text-[10px] text-muted-foreground tracking-wider">來自結帳</p>
                <p className="text-base font-semibold text-foreground tabular-nums mt-0.5">
                  NT${data.fromCheckout.toLocaleString()}
                </p>
              </div>
              <div className="rounded-lg bg-background border border-border/50 p-3">
                <p className="text-[10px] text-muted-foreground tracking-wider">預收定金</p>
                <p className="text-base font-semibold text-foreground tabular-nums mt-0.5">
                  NT${data.fromDeposit.toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          {/* Per-method breakdown */}
          {isEmpty ? (
            <div className="bg-card rounded-xl border border-border py-16 text-center">
              <p className="text-sm text-muted-foreground">這天沒有任何收款記錄</p>
            </div>
          ) : (
            <div className="space-y-3">
              {methodKeys.map((m) => {
                const bucket = data.byMethod[m];
                if (!bucket) return null;
                const meta = METHOD_LABELS[m] || { label: m, description: "", icon: "💰" };
                const isEmptyMethod = bucket.total === 0;
                return (
                  <div
                    key={m}
                    className={`bg-card rounded-xl border border-border p-4 ${
                      isEmptyMethod ? "opacity-60" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xl" aria-hidden>
                          {meta.icon}
                        </span>
                        <div>
                          <p className="text-sm font-semibold text-foreground">{meta.label}</p>
                          <p className="text-[11px] text-muted-foreground">{meta.description}</p>
                        </div>
                      </div>
                      <p className="text-base font-bold text-foreground tabular-nums">
                        NT${bucket.total.toLocaleString()}
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-lg bg-background/60 px-3 py-2">
                        <p className="text-[10px] text-muted-foreground tracking-wider">
                          結帳收款
                        </p>
                        <p className="text-sm font-medium text-foreground tabular-nums mt-0.5">
                          NT${bucket.fromCheckout.toLocaleString()}
                        </p>
                      </div>
                      <div className="rounded-lg bg-background/60 px-3 py-2">
                        <p className="text-[10px] text-muted-foreground tracking-wider">
                          預收定金
                        </p>
                        <p className="text-sm font-medium text-foreground tabular-nums mt-0.5">
                          NT${bucket.fromDeposit.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
