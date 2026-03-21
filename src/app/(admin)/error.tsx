"use client";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">發生錯誤</h2>
        <p className="text-sm text-gray-500 mb-4">{error.message || "系統錯誤，請稍後再試"}</p>
        <button
          onClick={reset}
          className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-600"
        >
          重新載入
        </button>
      </div>
    </div>
  );
}
