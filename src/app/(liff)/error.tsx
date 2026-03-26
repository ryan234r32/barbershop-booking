"use client";

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
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-50">
          <svg className="h-8 w-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-gray-900 mb-2">發生錯誤</h2>
        <p className="text-sm text-gray-500 mb-6">很抱歉，系統發生了問題。請稍後再試。</p>
        <button
          onClick={reset}
          className="rounded-xl bg-emerald-500 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-600"
        >
          重新載入
        </button>
      </div>
    </div>
  );
}
