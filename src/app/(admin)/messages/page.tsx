"use client";

import Link from "next/link";
import useSWR from "swr";
import { usePageTitle } from "@/lib/hooks/use-page-title";
import { MessageCircle } from "lucide-react";

interface Conversation {
  lineUserId: string;
  userId: string | null;
  displayName: string | null;
  pictureUrl: string | null;
  lastContent: string | null;
  lastDirection: "INBOUND" | "OUTBOUND";
  lastCreatedAt: string;
  unreadCount: number;
}

const SEGMENT_LABELS: Record<string, string> = {
  VIP: "VIP",
  REGULAR: "常客",
  NEW: "新客",
  AT_RISK: "流失中",
  LAPSED: "已流失",
};

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function relativeTime(iso: string): string {
  const now = Date.now();
  const t = new Date(iso).getTime();
  const diff = now - t;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "剛剛";
  if (min < 60) return `${min} 分鐘前`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} 小時前`;
  const d = Math.floor(hr / 24);
  if (d < 7) return `${d} 天前`;
  return new Date(iso).toLocaleDateString("zh-TW", { month: "numeric", day: "numeric" });
}

function fallbackName(lineUserId: string): string {
  return `LINE User ${lineUserId.slice(-4)}`;
}

export default function MessagesPage() {
  usePageTitle("訊息");
  const { data, isLoading } = useSWR<{ conversations: Conversation[]; totalUnread: number }>(
    "/api/admin/messages",
    fetcher,
    { revalidateOnFocus: true, refreshInterval: 30000 },
  );

  const conversations = data?.conversations ?? [];

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-[var(--color-text-primary)] tracking-wide">
          訊息
        </h1>
        {data && data.totalUnread > 0 && (
          <span className="text-xs text-[var(--color-text-muted)]">
            {data.totalUnread} 則未讀
          </span>
        )}
      </div>

      {isLoading && (
        <div className="flex items-center justify-center h-40">
          <div className="w-6 h-6 border-2 border-[var(--color-brand)] border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {!isLoading && conversations.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <MessageCircle size={40} strokeWidth={1.2} className="text-[var(--color-text-disabled)] mb-3" />
          <p className="text-sm text-[var(--color-text-muted)]">尚無訊息</p>
          <p className="text-xs text-[var(--color-text-disabled)] mt-1">
            顧客透過 LINE 傳訊息後會出現在這裡
          </p>
        </div>
      )}

      <div className="space-y-1">
        {conversations.map((c) => {
          const name = c.displayName || fallbackName(c.lineUserId);
          const preview = c.lastContent || "[訊息]";
          const isUnread = c.unreadCount > 0;

          return (
            <Link
              key={c.lineUserId}
              href={`/messages/${encodeURIComponent(c.lineUserId)}`}
              className={`flex items-center gap-3 px-3 py-3 rounded-lg transition-colors ${
                isUnread
                  ? "bg-[var(--color-surface)]"
                  : "hover:bg-[var(--color-surface)]/50"
              }`}
            >
              <div className="w-10 h-10 rounded-full bg-[var(--color-brand)]/10 text-[var(--color-brand)] flex items-center justify-center font-semibold text-sm shrink-0 overflow-hidden">
                {c.pictureUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.pictureUrl} alt={name} className="w-full h-full object-cover" />
                ) : (
                  name.charAt(0)
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-2">
                  <p className={`text-[14px] truncate ${
                    isUnread
                      ? "font-semibold text-[var(--color-text-primary)]"
                      : "text-[var(--color-text-body)]"
                  }`}>
                    {name}
                  </p>
                  <span className="text-[10px] text-[var(--color-text-muted)] shrink-0">
                    {relativeTime(c.lastCreatedAt)}
                  </span>
                </div>
                <p className={`text-[12px] truncate mt-0.5 ${
                  isUnread
                    ? "text-[var(--color-text-body)]"
                    : "text-[var(--color-text-muted)]"
                }`}>
                  {c.lastDirection === "OUTBOUND" && (
                    <span className="text-[var(--color-text-disabled)]">你: </span>
                  )}
                  {preview}
                </p>
              </div>
              {isUnread && (
                <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-[var(--color-danger)] text-white text-[10px] font-bold leading-5 text-center shrink-0">
                  {c.unreadCount > 9 ? "9+" : c.unreadCount}
                </span>
              )}
              {!isUnread && SEGMENT_LABELS && null}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
