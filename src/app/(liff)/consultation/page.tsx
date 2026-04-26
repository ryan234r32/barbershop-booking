"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLiff } from "@/lib/liff/provider";
import { useToast } from "@/components/ui/toast";
import { LoadingScreen } from "@/components/liff/loading-screen";
import { IconArrowBack } from "@/components/liff/icons";

interface Service {
  id: string;
  name: string;
  description: string | null;
  price: number;
  slotsNeeded: number;
}

const FALLBACK_SERVICE_NAMES = ["漂髮", "染髮", "燙髮"];

export default function ConsultationPage() {
  const { liff, isReady, error } = useLiff();
  const { toast } = useToast();
  const [services, setServices] = useState<Service[]>([]);
  const [serviceId, setServiceId] = useState<string>("");
  const [lastServiceDate, setLastServiceDate] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isReady) return;
    fetch("/api/services")
      .then((r) => r.json())
      .then((data) => {
        const list: Service[] = data.services || [];
        setServices(list);
        const bleach = list.find((s) =>
          FALLBACK_SERVICE_NAMES.some((n) => s.name.includes(n.charAt(0)) && s.name.includes(n.slice(1))),
        );
        if (bleach) setServiceId(bleach.id);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [isReady]);

  const submit = async () => {
    if (!notes.trim()) {
      toast({ type: "error", message: "請描述您的需求" });
      return;
    }
    setSubmitting(true);
    try {
      const idToken = liff?.getIDToken?.() || "";
      const res = await fetch("/api/consultations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(idToken ? { "X-LIFF-ID-Token": idToken } : {}),
        },
        body: JSON.stringify({
          serviceId: serviceId || undefined,
          lastServiceDate: lastServiceDate || undefined,
          notes: notes.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ type: "error", message: data.error || "送出失敗，請稍後再試" });
        return;
      }
      setSubmitted(true);
    } catch {
      toast({ type: "error", message: "網路錯誤，請稍後再試" });
    } finally {
      setSubmitting(false);
    }
  };

  if (!isReady || loading) return <LoadingScreen />;
  if (error) {
    return (
      <main className="p-6 max-w-md mx-auto">
        <div className="bg-red-50 text-red-700 p-4 rounded-lg text-sm">
          LIFF 載入失敗：{error}
        </div>
      </main>
    );
  }

  if (submitted) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-sm w-full bg-white rounded-2xl shadow-sm p-6 text-center space-y-4">
          <div className="w-16 h-16 mx-auto rounded-full bg-[var(--color-brand)]/15 flex items-center justify-center">
            <svg className="w-8 h-8 text-[var(--color-brand)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-lg font-bold">已收到您的諮詢請求</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            老闆會盡快回覆您。<br />
            如需傳照片，請直接傳到 LINE 聊天室即可。
          </p>
          <Link
            href="/my-bookings"
            className="block w-full py-3 rounded-xl bg-[var(--color-brand)] text-white font-medium text-sm hover:opacity-90"
          >
            回到首頁
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen pb-32">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#FFF8F1]/95 backdrop-blur border-b border-black/5">
        <div className="flex items-center gap-3 px-4 py-3 max-w-xl mx-auto">
          <Link href="/my-bookings" className="text-foreground/70">
            <IconArrowBack />
          </Link>
          <h1 className="text-base font-semibold">諮詢請求</h1>
        </div>
      </div>

      <div className="max-w-xl mx-auto px-4 py-5 space-y-4">
        <div className="bg-[var(--color-brand)]/5 rounded-xl p-4 text-sm text-foreground/80">
          <p className="font-medium mb-1.5">為什麼需要諮詢？</p>
          <p className="text-xs leading-relaxed">
            漂髮、特殊造型、第一次染燙等項目，老闆需要先了解您的頭髮狀況、上次染燙時間、想要的造型，才能評估時間與藥水。
            <br />
            我們會在 24 小時內回覆您 🙏
          </p>
        </div>

        <div className="bg-white rounded-xl p-4 space-y-4">
          <div>
            <label className="block text-xs text-muted-foreground mb-1.5">想諮詢的服務</label>
            <select
              value={serviceId}
              onChange={(e) => setServiceId(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm"
            >
              <option value="">不確定 / 其他</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-muted-foreground mb-1.5">
              上次染燙日期（選填）
            </label>
            <input
              type="date"
              value={lastServiceDate}
              onChange={(e) => setLastServiceDate(e.target.value)}
              max={new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Taipei" })}
              className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm"
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              幫助老闆評估髮況。若沒做過可以不填。
            </p>
          </div>

          <div>
            <label className="block text-xs text-muted-foreground mb-1.5">
              請描述您的需求 <span className="text-red-500">*</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value.slice(0, 2000))}
              rows={6}
              placeholder="例如：想要漂到 9 度，染奶茶棕，預算 NT$3,500 內。頭髮目前是黑色尚未染過。"
              className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm resize-none"
            />
            <p className="text-[11px] text-muted-foreground mt-1 text-right">
              {notes.length}/2000
            </p>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
            📷 想傳照片？送出後請直接到 LINE 聊天室傳給我們，老闆會幫您整理在這次諮詢內。
          </div>
        </div>
      </div>

      {/* Sticky bottom action */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#FFF8F1]/95 backdrop-blur border-t border-black/5 px-4 py-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
        <div className="max-w-xl mx-auto">
          <button
            onClick={submit}
            disabled={submitting || !notes.trim()}
            className="w-full h-12 rounded-xl bg-[var(--color-brand)] text-white font-medium text-sm hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {submitting ? "送出中..." : "送出諮詢"}
          </button>
        </div>
      </div>
    </main>
  );
}
