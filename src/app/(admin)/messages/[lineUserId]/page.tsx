"use client";

import { useEffect, useRef, useState, use } from "react";
import Link from "next/link";
import useSWR from "swr";
import { usePageTitle } from "@/lib/hooks/use-page-title";
import { useToast } from "@/components/ui/toast";
import { ChevronLeft, Send } from "lucide-react";

interface Message {
  id: string;
  direction: "INBOUND" | "OUTBOUND";
  type: string;
  content: string | null;
  isRead: boolean;
  createdAt: string;
}

interface UserSummary {
  id: string;
  displayName: string | null;
  pictureUrl: string | null;
  phone: string | null;
  segment: string;
}

// Built-in quick-reply templates (MVP — editable via settings in a later iteration)
const QUICK_REPLIES = [
  "收到，稍後回覆",
  "感謝預約！",
  "已為您保留時段",
  "請撥打電話 02-xxxx",
];

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("zh-TW", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function MessageDetailPage({
  params,
}: {
  params: Promise<{ lineUserId: string }>;
}) {
  const { lineUserId: raw } = use(params);
  const lineUserId = decodeURIComponent(raw);
  usePageTitle("對話");
  const { toast } = useToast();

  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data, mutate, isLoading } = useSWR<{
    messages: Message[];
    user: UserSummary | null;
  }>(`/api/admin/messages/${encodeURIComponent(lineUserId)}`, fetcher, {
    revalidateOnFocus: true,
    refreshInterval: 15000,
  });

  // Mark conversation as read when the page loads (and on each revalidation)
  useEffect(() => {
    if (data?.messages && data.messages.some((m) => m.direction === "INBOUND" && !m.isRead)) {
      fetch(`/api/admin/messages/${encodeURIComponent(lineUserId)}/read`, {
        method: "PATCH",
      }).catch(() => { /* ignore */ });
    }
  }, [data, lineUserId]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [data?.messages?.length]);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    const clientMessageId = crypto.randomUUID();

    try {
      const res = await fetch(
        `/api/admin/messages/${encodeURIComponent(lineUserId)}/reply`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: trimmed, clientMessageId }),
        },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast({ type: "error", message: err.error || "傳送失敗" });
        return;
      }
      setInput("");
      await mutate();
    } catch {
      toast({ type: "error", message: "網路錯誤，請重試" });
    } finally {
      setSending(false);
    }
  };

  const user = data?.user;
  const name = user?.displayName || `LINE User ${lineUserId.slice(-4)}`;

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] lg:h-screen max-w-2xl mx-auto -mx-4 lg:mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--color-surface)] bg-[var(--color-bg)] sticky top-0 z-10">
        <Link
          href="/messages"
          className="p-1 -ml-1 rounded hover:bg-[var(--color-surface)]"
        >
          <ChevronLeft size={22} />
        </Link>
        <div className="w-9 h-9 rounded-full bg-[var(--color-brand)]/10 text-[var(--color-brand)] flex items-center justify-center font-semibold text-sm overflow-hidden">
          {user?.pictureUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.pictureUrl} alt={name} className="w-full h-full object-cover" />
          ) : (
            name.charAt(0)
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-semibold text-[var(--color-text-primary)] truncate">
            {name}
          </p>
          {user?.phone && (
            <p className="text-[11px] text-[var(--color-text-muted)]">{user.phone}</p>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
        {isLoading && (
          <div className="flex items-center justify-center h-40">
            <div className="w-5 h-5 border-2 border-[var(--color-brand)] border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {data?.messages?.length === 0 && !isLoading && (
          <p className="text-center text-xs text-[var(--color-text-muted)] py-8">
            尚無訊息，輸入後即可開始對話
          </p>
        )}

        {data?.messages?.map((m) => {
          const isOutbound = m.direction === "OUTBOUND";
          return (
            <div
              key={m.id}
              className={`flex ${isOutbound ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[75%] px-3 py-2 rounded-2xl ${
                  isOutbound
                    ? "bg-[var(--color-brand)] text-white rounded-br-sm"
                    : "bg-[var(--color-surface)] text-[var(--color-text-primary)] rounded-bl-sm"
                }`}
              >
                <p className="text-[14px] whitespace-pre-wrap break-words">
                  {m.content || `[${m.type}]`}
                </p>
                <p
                  className={`text-[10px] mt-1 ${
                    isOutbound ? "text-white/60" : "text-[var(--color-text-muted)]"
                  }`}
                >
                  {formatTime(m.createdAt)}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Quick replies */}
      <div className="px-4 py-2 border-t border-[var(--color-surface)] flex gap-1.5 overflow-x-auto scrollbar-none">
        {QUICK_REPLIES.map((qr) => (
          <button
            key={qr}
            onClick={() => send(qr)}
            disabled={sending}
            className="shrink-0 px-3 py-1.5 rounded-full bg-[var(--color-surface)] text-[12px] text-[var(--color-text-body)] hover:bg-[var(--color-surface)]/80 disabled:opacity-40"
          >
            {qr}
          </button>
        ))}
      </div>

      {/* Input */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex items-end gap-2 px-4 py-3 border-t border-[var(--color-surface)] bg-[var(--color-bg)]"
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
          rows={1}
          placeholder="輸入訊息..."
          className="flex-1 resize-none px-3 py-2 rounded-2xl bg-[var(--color-surface)] text-[14px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]/30 max-h-32"
          disabled={sending}
        />
        <button
          type="submit"
          disabled={!input.trim() || sending}
          className="w-10 h-10 rounded-full bg-[var(--color-brand)] text-white flex items-center justify-center disabled:opacity-40 transition-opacity shrink-0"
        >
          <Send size={18} />
        </button>
      </form>
    </div>
  );
}
