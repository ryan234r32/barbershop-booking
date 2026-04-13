"use client";

interface LoadingScreenProps {
  message?: string;
}

export function LoadingScreen({
  message = "正在為你準備預約資訊...",
}: LoadingScreenProps) {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-[#FFF8F1]">
      {/* Brand name */}
      <h1 className="font-bold text-2xl text-[#003D2B] tracking-[0.05em] mb-6">
        1008 Hair Studio
      </h1>

      {/* Spinning loader — clear visual feedback */}
      <div className="relative w-10 h-10 mb-8">
        <div className="absolute inset-0 rounded-full border-2 border-[#F3ECE4]" />
        <div className="absolute inset-0 rounded-full border-2 border-t-[#003D2B] border-r-transparent border-b-transparent border-l-transparent animate-spin" />
      </div>

      {/* Bottom message */}
      <p className="text-sm text-[#003D2B]/50">
        {message}
      </p>
    </div>
  );
}
