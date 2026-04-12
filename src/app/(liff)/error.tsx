"use client";

import Link from "next/link";

export default function LiffError({
  error: _error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  void _error; // Required by Next.js error boundary signature
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="text-center max-w-xs mx-auto">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-lg bg-[var(--color-warning)]/15">
          <svg className="h-8 w-8 text-[var(--color-warning)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-[var(--color-brand)] mb-2">請在 LINE App 中開啟此頁面</h2>
        <p className="text-sm text-muted-foreground mb-6">此預約系統需要透過 LINE 開啟才能使用</p>
        <div className="space-y-3">
          <Link
            href="/"
            className="block rounded-lg bg-[var(--color-brand)] px-6 py-2.5 text-sm font-medium text-[var(--color-bg)] transition hover:opacity-90"
          >
            回到首頁
          </Link>
          <button
            onClick={reset}
            className="block w-full rounded-lg border border-[var(--color-brand)]/20 px-6 py-2.5 text-sm font-medium text-foreground transition hover:bg-secondary"
          >
            重新載入
          </button>
        </div>
        <p className="mt-6 text-sm text-muted-foreground">
          或致電預約：<a href="tel:02-2396-2306" className="text-[var(--color-brand)] underline">02-2396-2306</a>
        </p>
      </div>
    </div>
  );
}
