"use client";

export function LoadingSpinner({ message }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 gap-4">
      <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      {message && <p className="text-gray-500 text-sm">{message}</p>}
    </div>
  );
}
