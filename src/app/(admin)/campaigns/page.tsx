"use client";

import { useState, useEffect, useCallback } from "react";
import { usePageTitle } from "@/lib/hooks/use-page-title";

const SEGMENT_OPTIONS = [
  { value: "ALL", label: "全部客戶" },
  { value: "NEW", label: "新客" },
  { value: "REGULAR", label: "常客" },
  { value: "VIP", label: "VIP" },
  { value: "AT_RISK", label: "流失風險" },
  { value: "LAPSED", label: "已流失" },
] as const;

type SegmentValue = (typeof SEGMENT_OPTIONS)[number]["value"];

interface SegmentCounts {
  [key: string]: number;
}

interface SendResult {
  success: boolean;
  sent: number;
  failed: number;
  total: number;
  message?: string;
}

export default function CampaignsPage() {
  usePageTitle("行銷推播");

  const [segment, setSegment] = useState<SegmentValue>("ALL");
  const [message, setMessage] = useState("");
  const [includeBookingButton, setIncludeBookingButton] = useState(true);
  const [counts, setCounts] = useState<SegmentCounts>({});
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<SendResult | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  // Fetch segment counts on mount
  useEffect(() => {
    async function fetchCounts() {
      try {
        const res = await fetch("/api/admin/campaigns");
        if (res.ok) {
          const data = await res.json();
          setCounts(data.counts || {});
        }
      } catch (err) {
        console.error("Failed to fetch segment counts", err);
      } finally {
        setLoading(false);
      }
    }
    fetchCounts();
  }, []);

  const selectedCount = counts[segment] || 0;

  const handleSend = useCallback(async () => {
    setShowConfirm(false);
    setSending(true);
    setResult(null);

    try {
      const res = await fetch("/api/admin/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          segment,
          message: message.trim(),
          includeBookingButton,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setResult(data);
      } else {
        setResult({
          success: false,
          sent: 0,
          failed: 0,
          total: 0,
          message: data.error || "發送失敗",
        });
      }
    } catch (err) {
      console.error(err);
      setResult({
        success: false,
        sent: 0,
        failed: 0,
        total: 0,
        message: "網路錯誤，請稍後再試",
      });
    } finally {
      setSending(false);
    }
  }, [segment, message, includeBookingButton]);

  const canSend = message.trim().length > 0 && message.length <= 500 && selectedCount > 0;

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-6">行銷推播</h1>

      <div className="max-w-2xl space-y-6">
        {/* Segment selector */}
        <div className="bg-card rounded-xl border border-border p-6">
          <label className="block text-sm font-medium text-foreground/80 mb-2">
            目標客群
          </label>
          <select
            value={segment}
            onChange={(e) => {
              setSegment(e.target.value as SegmentValue);
              setResult(null);
            }}
            className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary"
          >
            {SEGMENT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <div className="mt-3 flex items-center gap-2">
            {loading ? (
              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            ) : (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/15 text-primary">
                {selectedCount} 位用戶
              </span>
            )}
            {selectedCount > 200 && (
              <span className="text-xs text-[var(--color-warning)]">
                (單次最多推播 200 人)
              </span>
            )}
          </div>
        </div>

        {/* Message input */}
        <div className="bg-card rounded-xl border border-border p-6">
          <label className="block text-sm font-medium text-foreground/80 mb-2">
            推播訊息
          </label>
          <textarea
            value={message}
            onChange={(e) => {
              setMessage(e.target.value);
              setResult(null);
            }}
            placeholder="例：好久沒來了！本月預約享 9 折優惠"
            maxLength={500}
            rows={4}
            className="w-full px-3 py-2 border border-border rounded-lg text-sm resize-none focus:ring-2 focus:ring-primary focus:border-primary"
          />
          <div className="flex items-center justify-between mt-2">
            <span
              className={`text-xs ${
                message.length > 450 ? "text-[var(--color-warning)]" : "text-muted-foreground"
              }`}
            >
              {message.length}/500
            </span>
          </div>

          {/* Booking button toggle */}
          <label className="flex items-center gap-2 mt-4 cursor-pointer">
            <input
              type="checkbox"
              checked={includeBookingButton}
              onChange={(e) => setIncludeBookingButton(e.target.checked)}
              className="w-4 h-4 text-primary border-border rounded focus:ring-primary"
            />
            <span className="text-sm text-foreground/80">附加預約按鈕</span>
          </label>
        </div>

        {/* Send button */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => setShowConfirm(true)}
            disabled={!canSend || sending}
            className="px-6 py-2.5 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {sending ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                發送中...
              </span>
            ) : (
              "發送推播"
            )}
          </button>

          {!canSend && message.trim().length > 0 && selectedCount === 0 && (
            <span className="text-sm text-muted-foreground">
              該客群目前沒有可推播的用戶
            </span>
          )}
        </div>

        {/* Confirmation dialog */}
        {showConfirm && (
          <div className="fixed inset-0 bg-foreground/40 flex items-center justify-center z-50">
            <div className="bg-card rounded-xl p-6 max-w-sm mx-4 shadow-xl">
              <h3 className="text-lg font-semibold text-foreground mb-2">
                確認發送
              </h3>
              <p className="text-sm text-muted-foreground mb-1">
                將向{" "}
                <span className="font-medium text-primary">
                  {Math.min(selectedCount, 200)} 位
                </span>{" "}
                {SEGMENT_OPTIONS.find((o) => o.value === segment)?.label}
                用戶發送推播訊息。
              </p>
              <div className="bg-background rounded-lg p-3 my-3 text-sm text-foreground/80 whitespace-pre-wrap">
                {message.trim()}
              </div>
              {includeBookingButton && (
                <p className="text-xs text-muted-foreground mb-4">
                  含「立即預約」按鈕
                </p>
              )}
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowConfirm(false)}
                  className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleSend}
                  className="px-4 py-2 bg-primary text-white text-sm rounded-lg hover:bg-primary transition-colors"
                >
                  確認發送
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Result display */}
        {result && (
          <div
            className={`rounded-xl border p-4 ${
              result.success && result.sent > 0
                ? "bg-primary/10 border-primary/30"
                : result.success && result.sent === 0
                  ? "bg-[var(--color-warning)]/10 border-[var(--color-warning)]/30"
                  : "bg-destructive/10 border-destructive/30"
            }`}
          >
            {result.success && result.sent > 0 ? (
              <div>
                <p className="text-sm font-medium text-primary">
                  推播完成
                </p>
                <p className="text-sm text-primary mt-1">
                  成功送出 {result.sent} 則
                  {result.failed > 0 && (
                    <span className="text-[var(--color-warning)]">
                      ，{result.failed} 則失敗
                    </span>
                  )}
                </p>
              </div>
            ) : result.success && result.sent === 0 ? (
              <p className="text-sm text-[var(--color-warning)]">
                {result.message || "該客群目前沒有可推播的用戶"}
              </p>
            ) : (
              <p className="text-sm text-destructive">
                {result.message || "發送失敗，請稍後再試"}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
