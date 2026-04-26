"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLiff } from "@/lib/liff/provider";
import { LoadingScreen } from "@/components/liff/loading-screen";
import { IconArrowBack } from "@/components/liff/icons";

interface Coupon {
  id: string;
  code: string;
  type: string;
  discountPct: number;
  experimentArm: string | null;
  issuedAt: string;
  expiresAt: string;
  usedAt: string | null;
  usedForBookingId: string | null;
  issuedReason: string;
}

type Tab = "available" | "used" | "expired";

const TABS: { key: Tab; label: string }[] = [
  { key: "available", label: "可用" },
  { key: "used", label: "已使用" },
  { key: "expired", label: "已過期" },
];

export default function MyCouponsPage() {
  const { liff, isReady, error } = useLiff();
  const [tab, setTab] = useState<Tab>("available");
  const [items, setItems] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  // Frozen "now" for deterministic daysLeft display per render pass.
  const [now] = useState(() => Date.now());

  useEffect(() => {
    if (!isReady) return;
    let cancelled = false;
    const idToken = liff?.getIDToken?.() || "";
    fetch(`/api/coupons?status=${tab}`, {
      headers: idToken ? { "X-LIFF-ID-Token": idToken } : {},
    })
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((data) => {
        if (!cancelled) {
          setItems(data.items || []);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setItems([]);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [isReady, liff, tab]);

  if (!isReady || loading) return <LoadingScreen message="載入優惠券..." />;
  if (error) {
    return (
      <main className="p-6 max-w-md mx-auto">
        <div className="bg-red-50 text-red-700 p-4 rounded-lg text-sm">
          LIFF 載入失敗：{error}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen pb-12">
      <div className="sticky top-0 z-10 bg-[#FFF8F1]/95 backdrop-blur border-b border-black/5">
        <div className="flex items-center gap-3 px-4 py-3 max-w-xl mx-auto">
          <Link href="/my-bookings" className="text-foreground/70">
            <IconArrowBack />
          </Link>
          <h1 className="text-base font-semibold">我的優惠券</h1>
        </div>
      </div>

      <div className="max-w-xl mx-auto px-4 py-4 space-y-4">
        <div className="flex gap-1 p-1 bg-black/5 rounded-lg" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.key}
              role="tab"
              onClick={() => setTab(t.key)}
              aria-selected={tab === t.key}
              className={`flex-1 py-2 text-sm rounded-md transition-colors ${
                tab === t.key
                  ? "bg-white text-foreground font-medium shadow-sm"
                  : "text-muted-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {items.length === 0 ? (
          <EmptyState tab={tab} />
        ) : (
          <div className="space-y-3">
            {items.map((c) => (
              <CouponCard
                key={c.id}
                c={c}
                active={tab === "available"}
                now={now}
              />
            ))}
          </div>
        )}

        <div className="text-xs text-muted-foreground text-center pt-4 leading-relaxed">
          優惠券會在預約時自動帶入折抵。<br />
          也可以告訴老闆優惠碼。
        </div>
      </div>
    </main>
  );
}

function EmptyState({ tab }: { tab: Tab }) {
  const labels: Record<Tab, string> = {
    available: "目前沒有可用的優惠券",
    used: "尚未使用過優惠券",
    expired: "沒有過期的優惠券",
  };
  const tips: Record<Tab, string> = {
    available: "完成下次預約後，可能會收到 95 折券 🎁",
    used: "",
    expired: "",
  };
  return (
    <div className="bg-white rounded-2xl p-8 text-center text-sm text-muted-foreground space-y-2">
      <div className="text-3xl opacity-50">🎟️</div>
      <p>{labels[tab]}</p>
      {tips[tab] && <p className="text-xs">{tips[tab]}</p>}
    </div>
  );
}

function CouponCard({
  c,
  active,
  now,
}: {
  c: Coupon;
  active: boolean;
  now: number;
}) {
  const expireStr = new Date(c.expiresAt).toLocaleDateString("zh-TW", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const issuedStr = new Date(c.issuedAt).toLocaleDateString("zh-TW", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const daysLeft = Math.ceil(
    (new Date(c.expiresAt).getTime() - now) / (24 * 60 * 60 * 1000),
  );
  const dimmed = !active;

  return (
    <div
      className={`relative rounded-2xl border-2 border-dashed overflow-hidden ${
        dimmed
          ? "border-black/10 bg-white/60 opacity-60"
          : "border-[var(--color-brand)] bg-white shadow-sm"
      }`}
    >
      {/* Punch-hole notches */}
      <div className="absolute -left-2 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-[#FFF8F1]" />
      <div className="absolute -right-2 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-[#FFF8F1]" />

      <div className="flex items-stretch">
        <div
          className={`w-24 flex flex-col items-center justify-center p-4 ${
            dimmed
              ? "bg-black/5"
              : "bg-[var(--color-brand)] text-white"
          }`}
        >
          <span className="text-2xl font-bold leading-none">95</span>
          <span className="text-[10px] tracking-wider mt-0.5">折</span>
        </div>

        <div className="flex-1 p-4 space-y-1">
          <p className="text-base font-semibold text-foreground">
            理髮廳 95 折券
          </p>
          <p className="text-xs text-muted-foreground font-mono">
            優惠碼：{c.code}
          </p>
          <p className="text-xs text-muted-foreground">
            {c.usedAt ? (
              <>已於 {new Date(c.usedAt).toLocaleDateString("zh-TW", { month: "2-digit", day: "2-digit" })} 使用</>
            ) : daysLeft > 0 ? (
              <>
                有效期至 {expireStr}
                <span
                  className={`ml-1 text-[11px] font-medium ${
                    daysLeft <= 7 ? "text-amber-600" : "text-[var(--color-brand)]"
                  }`}
                >
                  （剩 {daysLeft} 天）
                </span>
              </>
            ) : (
              <span className="text-red-500">已於 {expireStr} 過期</span>
            )}
          </p>
          <p className="text-[10px] text-muted-foreground/70">
            獲得日：{issuedStr}
          </p>
        </div>
      </div>
    </div>
  );
}
