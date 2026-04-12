"use client";

interface LoadingScreenProps {
  message?: string;
}

export function LoadingScreen({
  message = "正在為你準備預約資訊...",
}: LoadingScreenProps) {
  return (
    <div
      className="fixed inset-0 flex flex-col items-center"
      style={{ backgroundColor: "#FFF8F1" }}
    >
      {/* Top spacer */}
      <div className="h-48" />

      {/* Brand name */}
      <h1
        className="font-headline font-bold text-2xl"
        style={{ color: "#003D2B", letterSpacing: "0.05em" }}
      >
        1008 Hair Studio
      </h1>

      {/* Botanical illustration */}
      <div className="mt-6">
        <svg
          width="40"
          height="40"
          viewBox="0 0 24 24"
          className="botanical-line"
        >
          <path
            d="M12 22C12 22 12 14 19 7C20 6 20.5 4.5 20.5 4.5"
            stroke="#003D2B"
            strokeWidth="1.5"
            fill="none"
          />
          <path
            d="M12 22C12 22 12 13 4 8C3 7.5 2.5 6 2.5 6"
            stroke="#003D2B"
            strokeWidth="1.5"
            fill="none"
          />
          <path d="M12 22V2" stroke="#003D2B" strokeWidth="1.5" fill="none" />
          <path
            d="M12 12C12 12 15 10 17 11"
            stroke="#003D2B"
            strokeWidth="1.5"
            fill="none"
          />
          <path
            d="M12 15C12 15 8 13 6 14"
            stroke="#003D2B"
            strokeWidth="1.5"
            fill="none"
          />
        </svg>
      </div>

      {/* Skeleton loading cards */}
      <div className="mt-10 w-full max-w-sm px-6 flex flex-col gap-6">
        <div
          className="rounded-lg animate-skeletonPulse"
          style={{
            height: 128,
            backgroundColor: "#F3ECE4",
            opacity: 0.6,
          }}
        />
        <div
          className="rounded-lg animate-skeletonPulse"
          style={{
            height: 96,
            backgroundColor: "#F3ECE4",
            opacity: 0.6,
          }}
        />
        <div
          className="rounded-lg animate-skeletonPulse"
          style={{
            height: 160,
            backgroundColor: "#F3ECE4",
            opacity: 0.6,
          }}
        />
      </div>

      {/* Spacer to push bottom text down */}
      <div className="flex-grow" />

      {/* Bottom message */}
      <p
        className="font-body text-sm text-center pb-8"
        style={{ color: "rgba(0,61,43,0.5)" }}
      >
        {message}
      </p>
    </div>
  );
}
