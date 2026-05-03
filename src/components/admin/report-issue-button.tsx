"use client";

/**
 * V3.8 incident response — 老闆覺得系統怪怪的時候點這顆，dev 立刻收到 LINE。
 *
 * 設計：
 *   - 預設縮在右下角小 icon（不擾人）
 *   - 點開展成 modal，預填當前 URL + 提示 placeholder
 *   - 送出後 toast「已通知技術人員」(LINE 推播失敗也顯示成功，
 *     避免老闆覺得連報問題都失敗)
 *   - 按 Esc / 點背景 / 點「取消」關閉
 */

import { useState } from "react";
import { adminHeaders } from "@/lib/auth/admin-fetch";
import { useToast } from "@/components/ui/toast";

export function ReportIssueButton() {
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async () => {
    if (!description.trim()) {
      toast({ type: "error", message: "請描述遇到的問題" });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/report-issue", {
        method: "POST",
        headers: { ...adminHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          description: description.trim(),
          url: window.location.href,
          userAgent: navigator.userAgent,
        }),
      });
      // V3.8: 即使 LINE push 失敗（dev 沒設 LINE）也回 200，老闆視角永遠成功
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast({ type: "success", message: "已通知技術人員，會盡快處理 🙏" });
      setOpen(false);
      setDescription("");
    } catch (err) {
      console.error("[report-issue] failed", err);
      toast({
        type: "error",
        message: "送出失敗，請打店家電話 02-2396-2306",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {/* 浮動小按鈕：右下角，避開 calendar FAB 位置（FAB 在右下偏上）*/}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-20 left-4 z-30 lg:left-auto lg:right-4 lg:bottom-4
          w-10 h-10 rounded-full bg-[var(--color-surface)] shadow-md
          flex items-center justify-center text-base
          hover:bg-[var(--color-warning)]/15 hover:scale-110 transition-all
          border border-[var(--color-border)]"
        aria-label="報告系統問題"
        title="系統怪怪的？點這裡通知技術人員"
      >
        ⚠️
      </button>

      {/* Modal */}
      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          onClick={() => !submitting && setOpen(false)}
        >
          <div
            className="w-full max-w-md bg-[var(--color-bg)] rounded-2xl p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-[var(--color-text-primary)] mb-1">
              ⚠️ 報告系統問題
            </h2>
            <p className="text-xs text-[var(--color-text-muted)] mb-4">
              發現系統怪怪的？簡短描述一下，技術人員會收到 LINE 通知。
            </p>

            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="例：點預約後一直轉圈圈／剛剛某一筆收款金額不對／LINE 客戶說沒收到提醒"
              rows={5}
              className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)]
                bg-[var(--color-surface)] text-sm placeholder:text-[var(--color-text-muted)]
                focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]/40
                resize-none"
              disabled={submitting}
              maxLength={500}
              autoFocus
            />
            <p className="text-[10px] text-[var(--color-text-muted)] mt-1 text-right">
              {description.length} / 500
            </p>

            <div className="flex gap-2 mt-4">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={submitting}
                className="flex-1 py-2.5 rounded-lg border border-[var(--color-border)]
                  text-sm font-medium text-[var(--color-text-body)]
                  hover:bg-[var(--color-surface)] transition-colors disabled:opacity-50"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting || !description.trim()}
                className="flex-2 px-4 py-2.5 rounded-lg bg-[var(--color-brand)]
                  text-[var(--color-bg)] text-sm font-bold
                  hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {submitting ? "送出中..." : "送出通知"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
