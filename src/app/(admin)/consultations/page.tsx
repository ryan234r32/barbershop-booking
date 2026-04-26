"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { usePageTitle } from "@/lib/hooks/use-page-title";
import { useToast } from "@/components/ui/toast";
import { adminHeaders } from "@/lib/auth/admin-fetch";
import { Modal } from "@/components/ui/modal";
import { MessageCircle, Image as ImageIcon, Phone, ArrowRight, Archive, CheckCircle2 } from "lucide-react";

type ConsultationStatus = "PENDING" | "REPLIED" | "CONVERTED" | "ARCHIVED";

interface Consultation {
  id: string;
  status: ConsultationStatus;
  priority: number;
  lineUserId: string;
  currentPhotoUrls: string[];
  targetPhotoUrls: string[];
  lastServiceDate: string | null;
  notes: string | null;
  respondedAt: string | null;
  convertedBookingId: string | null;
  createdAt: string;
  service: { id: string; name: string } | null;
  user: {
    id: string;
    displayName: string | null;
    phone: string | null;
    lineUserId: string;
    segment: string;
  } | null;
  convertedBooking: {
    id: string;
    date: string;
    startTime: string;
    status: string;
  } | null;
}

interface ListResponse {
  items: Consultation[];
  pendingCount: number;
}

const STATUS_LABEL: Record<ConsultationStatus, string> = {
  PENDING: "待回覆",
  REPLIED: "已回覆",
  CONVERTED: "已轉預約",
  ARCHIVED: "已封存",
};

const STATUS_BADGE: Record<ConsultationStatus, string> = {
  PENDING: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  REPLIED: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  CONVERTED: "bg-[var(--color-brand)]/15 text-[var(--color-brand)]",
  ARCHIVED: "bg-secondary text-muted-foreground",
};

const TABS: { key: ConsultationStatus | "all"; label: string }[] = [
  { key: "PENDING", label: "待回覆" },
  { key: "REPLIED", label: "已回覆" },
  { key: "CONVERTED", label: "已轉預約" },
  { key: "ARCHIVED", label: "已封存" },
  { key: "all", label: "全部" },
];

const fetcher = (url: string) =>
  fetch(url, { headers: adminHeaders() }).then((r) => {
    if (!r.ok) throw new Error(`${r.status}`);
    return r.json();
  });

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "剛剛";
  if (min < 60) return `${min} 分鐘前`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} 小時前`;
  const day = Math.floor(hr / 24);
  return `${day} 天前`;
}

export default function ConsultationsPage() {
  usePageTitle("諮詢請求");
  const { toast } = useToast();
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("PENDING");
  const [convertTarget, setConvertTarget] = useState<Consultation | null>(null);

  const { data, isLoading, mutate } = useSWR<ListResponse>(
    `/api/consultations?status=${tab}`,
    fetcher,
    { refreshInterval: 60_000 },
  );

  const items = data?.items ?? [];

  const handlePatch = useCallback(
    async (id: string, patch: { status?: ConsultationStatus; priority?: number }) => {
      try {
        const res = await fetch(`/api/consultations/${id}`, {
          method: "PATCH",
          headers: adminHeaders(),
          body: JSON.stringify(patch),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err?.error || `HTTP ${res.status}`);
        }
        toast({ type: "success", message: "已更新" });
        mutate();
      } catch (err) {
        toast({
          type: "error",
          message: err instanceof Error ? err.message : "更新失敗",
        });
      }
    },
    [toast, mutate],
  );

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-bold text-foreground">諮詢請求</h1>
        {data && data.pendingCount > 0 && (
          <span className="text-xs text-amber-600 dark:text-amber-300">
            🔴 {data.pendingCount} 筆待回覆
          </span>
        )}
      </div>

      <div className="flex gap-1 p-1 bg-secondary/50 rounded-lg overflow-x-auto" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 min-w-[64px] py-2 text-sm rounded-md transition-colors whitespace-nowrap ${
              tab === t.key
                ? "bg-card text-foreground font-medium shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState tab={tab} />
      ) : (
        <div className="space-y-3">
          {items.map((c) => (
            <ConsultationCard
              key={c.id}
              c={c}
              onMarkReplied={() => handlePatch(c.id, { status: "REPLIED" })}
              onArchive={() => handlePatch(c.id, { status: "ARCHIVED" })}
              onConvert={() => setConvertTarget(c)}
            />
          ))}
        </div>
      )}

      {convertTarget && (
        <ConvertModal
          consultation={convertTarget}
          onClose={() => setConvertTarget(null)}
          onSuccess={() => {
            setConvertTarget(null);
            mutate();
            toast({ type: "success", message: "已轉為預約" });
          }}
          onError={(msg) => toast({ type: "error", message: msg })}
        />
      )}
    </div>
  );
}

function EmptyState({ tab }: { tab: (typeof TABS)[number]["key"] }) {
  const labels: Record<(typeof TABS)[number]["key"], string> = {
    PENDING: "目前沒有待回覆的諮詢請求 🎉",
    REPLIED: "尚無已回覆紀錄",
    CONVERTED: "尚無已轉預約紀錄",
    ARCHIVED: "封存區是空的",
    all: "尚無諮詢請求",
  };
  return (
    <div className="bg-card rounded-xl border border-border py-12 text-center text-muted-foreground text-sm">
      <MessageCircle className="w-8 h-8 mx-auto mb-3 opacity-40" />
      {labels[tab]}
    </div>
  );
}

function ConsultationCard({
  c,
  onMarkReplied,
  onArchive,
  onConvert,
}: {
  c: Consultation;
  onMarkReplied: () => void;
  onArchive: () => void;
  onConvert: () => void;
}) {
  const customerName = c.user?.displayName || "未命名客戶";
  const photoCount = c.currentPhotoUrls.length + c.targetPhotoUrls.length;
  const lineUrl = c.lineUserId.startsWith("manual-")
    ? null
    : `https://line.me/R/ti/p/~${c.lineUserId}`;

  const allPhotos = [
    ...c.currentPhotoUrls.map((url) => ({ url, label: "現況" })),
    ...c.targetPhotoUrls.map((url) => ({ url, label: "目標" })),
  ];

  return (
    <div className="bg-card rounded-xl border border-border p-4">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-foreground truncate">
            {customerName}
            {c.priority > 0 && (
              <span className="ml-2 text-[10px] text-amber-600 dark:text-amber-300">
                ⚡ 優先
              </span>
            )}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {c.service?.name || "諮詢"} · {relativeTime(c.createdAt)}
            {c.user?.segment && ` · ${c.user.segment}`}
          </p>
        </div>
        <span
          className={`shrink-0 text-xs px-2 py-1 rounded-full ${STATUS_BADGE[c.status]}`}
        >
          {STATUS_LABEL[c.status]}
        </span>
      </div>

      {c.notes && (
        <p className="text-sm text-foreground/80 whitespace-pre-wrap bg-background rounded-lg p-3 mt-2">
          {c.notes}
        </p>
      )}

      {c.lastServiceDate && (
        <p className="text-xs text-muted-foreground mt-2">
          上次服務：{c.lastServiceDate.slice(0, 10)}
        </p>
      )}

      {photoCount > 0 && (
        <div className="mt-3 flex items-center gap-2 overflow-x-auto pb-1">
          {allPhotos.map((p, idx) => (
            <a
              key={idx}
              href={p.url}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 relative"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.url}
                alt={p.label}
                className="w-20 h-20 object-cover rounded-lg border border-border"
              />
              <span className="absolute bottom-0.5 left-0.5 text-[9px] bg-foreground/70 text-background px-1 py-0.5 rounded">
                {p.label}
              </span>
            </a>
          ))}
        </div>
      )}

      {photoCount === 0 && c.status === "PENDING" && (
        <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
          <ImageIcon className="w-3 h-3" /> 客戶未上傳照片
        </p>
      )}

      {c.convertedBooking && (
        <div className="mt-3 p-2 bg-[var(--color-brand)]/5 rounded text-xs text-[var(--color-brand)]">
          ✅ 已轉預約：{c.convertedBooking.date.slice(0, 10)} {c.convertedBooking.startTime}
        </div>
      )}

      <div className="flex items-center justify-end gap-2 mt-3 flex-wrap">
        {lineUrl && (
          <a
            href={lineUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs px-3 py-1.5 rounded-lg border border-border text-foreground/80 hover:bg-background transition-colors flex items-center gap-1"
          >
            <MessageCircle className="w-3 h-3" /> 回覆 LINE
          </a>
        )}
        {c.user?.phone && (
          <a
            href={`tel:${c.user.phone}`}
            className="text-xs px-3 py-1.5 rounded-lg border border-border text-foreground/80 hover:bg-background transition-colors flex items-center gap-1"
          >
            <Phone className="w-3 h-3" /> {c.user.phone}
          </a>
        )}
        {c.status === "PENDING" && (
          <button
            onClick={onMarkReplied}
            className="text-xs px-3 py-1.5 rounded-lg border border-border text-foreground/80 hover:bg-background transition-colors flex items-center gap-1"
          >
            <CheckCircle2 className="w-3 h-3" /> 標記已回覆
          </button>
        )}
        {(c.status === "PENDING" || c.status === "REPLIED") && (
          <>
            <button
              onClick={onArchive}
              className="text-xs px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:bg-background transition-colors flex items-center gap-1"
            >
              <Archive className="w-3 h-3" /> 封存
            </button>
            <button
              onClick={onConvert}
              className="text-xs px-3 py-1.5 rounded-lg bg-[var(--color-brand)] text-white hover:opacity-90 transition-opacity font-medium flex items-center gap-1"
            >
              轉預約 <ArrowRight className="w-3 h-3" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function ConvertModal({
  consultation,
  onClose,
  onSuccess,
  onError,
}: {
  consultation: Consultation;
  onClose: () => void;
  onSuccess: () => void;
  onError: (msg: string) => void;
}) {
  interface ServiceOption {
    id: string;
    name: string;
    price: number;
    slotsNeeded: number;
  }
  const { data: servicesData } = useSWR<{ services: ServiceOption[] }>(
    "/api/services",
    fetcher,
  );
  const services = useMemo(() => servicesData?.services ?? [], [servicesData]);

  const [serviceId, setServiceId] = useState(consultation.service?.id || "");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("11:00");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!serviceId && services.length > 0) {
      setServiceId(consultation.service?.id || services[0].id);
    }
  }, [serviceId, services, consultation.service?.id]);

  const submit = async () => {
    if (!serviceId || !date || !startTime) {
      onError("請填寫服務 / 日期 / 時段");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(
        `/api/consultations/${consultation.id}/convert-to-booking`,
        {
          method: "POST",
          headers: adminHeaders(),
          body: JSON.stringify({ serviceId, date, startTime }),
        },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || `HTTP ${res.status}`);
      }
      onSuccess();
    } catch (err) {
      onError(err instanceof Error ? err.message : "轉預約失敗");
    } finally {
      setSubmitting(false);
    }
  };

  const todayIso = new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Taipei",
  });

  return (
    <Modal isOpen onClose={onClose} title="轉為預約">
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {consultation.user?.displayName || "客戶"}
        </p>

        <div>
          <label className="block text-xs text-muted-foreground mb-1.5">服務</label>
          <select
            value={serviceId}
            onChange={(e) => setServiceId(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
          >
            <option value="">請選擇</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} · NT${s.price} · {s.slotsNeeded}h
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-muted-foreground mb-1.5">日期</label>
            <input
              type="date"
              value={date}
              min={todayIso}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1.5">時段</label>
            <select
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
            >
              {Array.from({ length: 9 }, (_, i) => 11 + i).map((h) => (
                <option key={h} value={`${String(h).padStart(2, "0")}:00`}>
                  {String(h).padStart(2, "0")}:00
                </option>
              ))}
            </select>
          </div>
        </div>

        <p className="text-[11px] text-muted-foreground">
          系統會自動檢查時段衝突。轉換成功後，諮詢狀態變更為「已轉預約」並自動推播 LINE 給客戶。
        </p>

        <div className="flex gap-2 justify-end pt-2">
          <button
            onClick={onClose}
            disabled={submitting}
            className="text-sm px-4 py-2 rounded-lg border border-border text-foreground/80 hover:bg-background transition-colors disabled:opacity-50"
          >
            取消
          </button>
          <button
            onClick={submit}
            disabled={submitting || !serviceId || !date}
            className="text-sm px-4 py-2 rounded-lg bg-[var(--color-brand)] text-white hover:opacity-90 transition-opacity font-medium disabled:opacity-50"
          >
            {submitting ? "建立中..." : "確認轉預約"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
