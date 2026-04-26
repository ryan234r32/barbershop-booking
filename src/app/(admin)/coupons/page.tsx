"use client";

import { useCallback, useState } from "react";
import useSWR from "swr";
import { usePageTitle } from "@/lib/hooks/use-page-title";
import { useToast } from "@/components/ui/toast";
import { adminHeaders } from "@/lib/auth/admin-fetch";

interface ArmStats {
  arm: "A" | "B";
  expiryDays: number;
  issued: number;
  used: number;
  expired: number;
  available: number;
  redemptionRate: number;
}

interface StatsResponse {
  arms: ArmStats[];
  flags: {
    couponAbTest: boolean;
    couponStrategyAOnly: boolean;
    couponStrategyBOnly: boolean;
  };
}

interface CouponItem {
  id: string;
  code: string;
  type: string;
  experimentArm: "A" | "B" | null;
  issuedAt: string;
  expiresAt: string;
  usedAt: string | null;
  issuedReason: string;
  user: {
    id: string;
    displayName: string | null;
    lineUserId: string;
    segment: string;
  } | null;
}

const fetcher = (url: string) =>
  fetch(url, { headers: adminHeaders() }).then((r) => {
    if (!r.ok) throw new Error(`${r.status}`);
    return r.json();
  });

type ListTab = "available" | "used" | "expired" | "all";

export default function CouponsPage() {
  usePageTitle("優惠券");
  const { toast } = useToast();

  const { data: stats, mutate: refreshStats } = useSWR<StatsResponse>(
    "/api/coupons/stats",
    fetcher,
    { refreshInterval: 60_000 },
  );

  const [tab, setTab] = useState<ListTab>("available");
  const [armFilter, setArmFilter] = useState<"" | "A" | "B">("");

  const listUrl = `/api/coupons?status=${tab}&limit=100${armFilter ? `&arm=${armFilter}` : ""}`;
  const { data: listData, isLoading: listLoading } = useSWR<{ items: CouponItem[] }>(
    listUrl,
    fetcher,
  );
  const items = listData?.items ?? [];

  const updateFlag = useCallback(
    async (patch: { couponAbTest?: boolean; couponStrategyAOnly?: boolean; couponStrategyBOnly?: boolean }) => {
      try {
        const res = await fetch("/api/coupons/flags", {
          method: "PATCH",
          headers: adminHeaders(),
          body: JSON.stringify(patch),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err?.error || `HTTP ${res.status}`);
        }
        toast({ type: "success", message: "已更新" });
        refreshStats();
      } catch (err) {
        toast({
          type: "error",
          message: err instanceof Error ? err.message : "更新失敗",
        });
      }
    },
    [toast, refreshStats],
  );

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-foreground">優惠券 A/B Test</h1>
        <p className="text-xs text-muted-foreground mt-1">
          客人完成預約後自動發送 95 折券。比較 A 組（30 天到期）vs B 組（45 天到期）的回購率。
        </p>
      </div>

      {/* Feature flag controls */}
      <div className="bg-card rounded-xl border border-border p-4 space-y-3">
        <h2 className="text-sm font-bold text-foreground">控制開關</h2>
        <div className="space-y-2">
          <FlagToggle
            label="啟用 A/B 自動發券"
            description="客人完成預約後，依 userId hash 自動分到 A 或 B 組"
            checked={stats?.flags.couponAbTest ?? false}
            onChange={(v) => updateFlag({ couponAbTest: v })}
          />
          <FlagToggle
            label="緊急：強制全部用 A 組（30 天）"
            description="覆蓋 A/B 機制。適合 B 組明顯落後想加速收斂時"
            checked={stats?.flags.couponStrategyAOnly ?? false}
            onChange={(v) => updateFlag({ couponStrategyAOnly: v, couponStrategyBOnly: v ? false : undefined })}
            tone="warn"
          />
          <FlagToggle
            label="緊急：強制全部用 B 組（45 天）"
            description="覆蓋 A/B 機制。適合 A 組明顯落後想加速收斂時"
            checked={stats?.flags.couponStrategyBOnly ?? false}
            onChange={(v) => updateFlag({ couponStrategyBOnly: v, couponStrategyAOnly: v ? false : undefined })}
            tone="warn"
          />
        </div>
      </div>

      {/* Arm comparison */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {stats.arms.map((a) => (
            <ArmCard key={a.arm} a={a} />
          ))}
        </div>
      )}

      {/* List */}
      <div className="bg-card rounded-xl border border-border p-4 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h2 className="text-sm font-bold text-foreground">優惠券列表</h2>
          <div className="flex gap-1 p-1 bg-secondary/50 rounded-lg">
            {(["", "A", "B"] as const).map((arm) => (
              <button
                key={arm || "all"}
                onClick={() => setArmFilter(arm)}
                className={`px-3 py-1 text-xs rounded ${
                  armFilter === arm
                    ? "bg-card text-foreground font-medium shadow-sm"
                    : "text-muted-foreground"
                }`}
              >
                {arm ? `${arm} 組` : "全部"}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-1 p-1 bg-secondary/50 rounded-lg">
          {(["available", "used", "expired", "all"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2 text-xs rounded-md transition-colors ${
                tab === t
                  ? "bg-card text-foreground font-medium shadow-sm"
                  : "text-muted-foreground"
              }`}
            >
              {t === "available" ? "可用" : t === "used" ? "已使用" : t === "expired" ? "已過期" : "全部"}
            </button>
          ))}
        </div>

        {listLoading ? (
          <div className="py-8 flex items-center justify-center">
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            沒有符合條件的優惠券
          </div>
        ) : (
          <div className="overflow-x-auto -mx-4 px-4">
            <table className="w-full text-xs">
              <thead className="text-[10px] tracking-wider text-muted-foreground uppercase border-b border-border">
                <tr>
                  <th className="text-left py-2">客戶</th>
                  <th className="text-left py-2">優惠碼</th>
                  <th className="text-center py-2">組別</th>
                  <th className="text-center py-2">發放日</th>
                  <th className="text-center py-2">到期日</th>
                  <th className="text-center py-2">狀態</th>
                  <th className="text-right py-2">動作</th>
                </tr>
              </thead>
              <tbody>
                {items.map((c) => (
                  <CouponRow key={c.id} c={c} onChanged={() => refreshStats()} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function FlagToggle({
  label,
  description,
  checked,
  onChange,
  tone = "normal",
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  tone?: "normal" | "warn";
}) {
  return (
    <label className="flex items-start gap-3 p-2 -mx-2 rounded-lg hover:bg-background/50 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 w-4 h-4 accent-[var(--color-brand)]"
      />
      <div className="flex-1 min-w-0">
        <p
          className={`text-sm font-medium ${
            tone === "warn" ? "text-amber-700 dark:text-amber-300" : "text-foreground"
          }`}
        >
          {label}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
    </label>
  );
}

function ArmCard({ a }: { a: ArmStats }) {
  const isLeading = a.redemptionRate > 0;
  return (
    <div className="bg-card rounded-xl border border-border p-4">
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="text-base font-bold text-foreground">
          {a.arm} 組
          <span className="text-xs text-muted-foreground ml-2 font-normal">
            （{a.expiryDays} 天到期）
          </span>
        </h3>
        <span
          className={`text-xs px-2 py-0.5 rounded-full ${
            isLeading
              ? "bg-[var(--color-brand)]/15 text-[var(--color-brand)]"
              : "bg-secondary text-muted-foreground"
          }`}
        >
          回購率 {a.redemptionRate}%
        </span>
      </div>
      <div className="grid grid-cols-4 gap-2 text-center">
        <Stat label="發放" value={a.issued} />
        <Stat label="已用" value={a.used} tone="brand" />
        <Stat label="可用" value={a.available} />
        <Stat label="過期" value={a.expired} tone="muted" />
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number;
  tone?: "default" | "brand" | "muted";
}) {
  const c =
    tone === "brand"
      ? "text-[var(--color-brand)]"
      : tone === "muted"
        ? "text-muted-foreground"
        : "text-foreground";
  return (
    <div>
      <p className={`text-lg font-bold ${c}`}>{value}</p>
      <p className="text-[10px] tracking-wider text-muted-foreground uppercase">{label}</p>
    </div>
  );
}

function CouponRow({
  c,
  onChanged,
}: {
  c: CouponItem;
  onChanged: () => void;
}) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const status = c.usedAt
    ? "used"
    : new Date(c.expiresAt) < new Date()
      ? "expired"
      : "available";
  const statusColor =
    status === "used"
      ? "text-[var(--color-brand)]"
      : status === "expired"
        ? "text-muted-foreground"
        : "text-amber-600 dark:text-amber-300";
  const statusLabel = status === "used" ? "已使用" : status === "expired" ? "已過期" : "可用";

  const markUsed = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/coupons/${c.id}`, {
        method: "PATCH",
        headers: adminHeaders(),
        body: JSON.stringify({ action: "mark-used" }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || `HTTP ${res.status}`);
      }
      toast({ type: "success", message: "已標記為使用" });
      onChanged();
    } catch (err) {
      toast({
        type: "error",
        message: err instanceof Error ? err.message : "標記失敗",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <tr className="border-b border-border/50">
      <td className="py-2 text-foreground">
        {c.user?.displayName || "—"}
        {c.user?.segment && (
          <span className="ml-1 text-[9px] text-muted-foreground">{c.user.segment}</span>
        )}
      </td>
      <td className="py-2 font-mono text-foreground">{c.code}</td>
      <td className="py-2 text-center text-foreground">{c.experimentArm || "—"}</td>
      <td className="py-2 text-center text-muted-foreground">
        {new Date(c.issuedAt).toLocaleDateString("zh-TW", { month: "2-digit", day: "2-digit" })}
      </td>
      <td className="py-2 text-center text-muted-foreground">
        {new Date(c.expiresAt).toLocaleDateString("zh-TW", { month: "2-digit", day: "2-digit" })}
      </td>
      <td className={`py-2 text-center font-medium ${statusColor}`}>{statusLabel}</td>
      <td className="py-2 text-right">
        {status === "available" && (
          <button
            onClick={markUsed}
            disabled={busy}
            className="text-[11px] px-2 py-1 rounded bg-[var(--color-brand)] text-white hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "..." : "標記已用"}
          </button>
        )}
      </td>
    </tr>
  );
}
