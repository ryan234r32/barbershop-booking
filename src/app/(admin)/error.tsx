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
        <h2 className="text-lg font-semibold text-foreground mb-2">發生錯誤</h2>
        <p className="text-sm text-muted-foreground mb-4">{error.message || "系統錯誤，請稍後再試"}</p>
        <button
          onClick={reset}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          重新載入
        </button>
      </div>
    </div>
  );
}
