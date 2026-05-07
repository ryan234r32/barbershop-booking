"use client";

import { useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import {
  IconCalendar,
  IconCheckCircle,
  IconInfo,
  IconClose,
} from "./icons";

const STORAGE_KEY = "liff-intro-seen-v1";

const subscribe = () => () => {};
const getSnapshot = () => true;
const getServerSnapshot = () => false;

interface Step {
  Icon: (props: { className?: string }) => React.ReactElement;
  label: string;
  title: string;
  body: string;
}

const STEPS: Step[] = [
  {
    Icon: IconInfo,
    label: "WELCOME",
    title: "歡迎使用新版預約系統",
    body: "30 秒帶你逛一圈。手機線上預約、取消、改期，都比以前方便。",
  },
  {
    Icon: IconCalendar,
    label: "STEP 01",
    title: "想取消或改期？",
    body: "點下方選單的「我的預約」，找到該筆預約後就能取消或改期。前一天以前免費喔。",
  },
  {
    Icon: IconCheckCircle,
    label: "STEP 02",
    title: "找不到功能？",
    body: "任何頁面的右下角都有「？」按鈕，常見問題都整理在那邊，隨時可以查。",
  },
];

// Read from localStorage during lazy state init — avoids setState-in-effect.
// Safe because component is "use client" and the modal only renders after
// `mounted` is true (post-hydration via useSyncExternalStore), so SSR returns null.
function shouldShowOnMount(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return !window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return false; // localStorage blocked (private mode) → don't show
  }
}

export function IntroModal() {
  const mounted = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [open, setOpen] = useState<boolean>(shouldShowOnMount);
  const [stepIdx, setStepIdx] = useState(0);
  const [closing, setClosing] = useState(false);

  const dismiss = () => {
    setClosing(true);
    try {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // ignore
    }
    setTimeout(() => {
      setOpen(false);
      setClosing(false);
      setStepIdx(0);
    }, 200);
  };

  const next = () => {
    if (stepIdx < STEPS.length - 1) {
      setStepIdx((i) => i + 1);
    } else {
      dismiss();
    }
  };

  if (!mounted || !open) return null;

  const step = STEPS[stepIdx];
  const isLast = stepIdx === STEPS.length - 1;

  return createPortal(
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center px-6 transition-opacity duration-200 ${
        closing ? "opacity-0" : "opacity-100"
      }`}
      style={{ backgroundColor: "rgba(45, 58, 48, 0.5)" }}
      aria-modal="true"
      role="dialog"
    >
      <div className="w-full max-w-sm rounded-xl bg-[#FFF8F1] p-6 relative">
        {/* Skip button */}
        <button
          type="button"
          onClick={dismiss}
          className="absolute top-3 right-3 w-9 h-9 flex items-center justify-center text-[#003D2B]/50 hover:text-[#003D2B] transition-colors"
          aria-label="略過介紹"
        >
          <IconClose className="w-5 h-5" />
        </button>

        {/* Icon */}
        <div className="mt-2 flex items-center justify-center">
          <div className="w-16 h-16 flex items-center justify-center rounded-lg bg-[#F3ECE4]">
            <step.Icon className="w-8 h-8" />
          </div>
        </div>

        {/* Label (magazine-style uppercase) */}
        <p className="mt-5 text-center text-[0.7rem] font-medium tracking-[0.15em] uppercase text-[#003D2B]/50">
          {step.label}
        </p>

        {/* Title */}
        <h2 className="mt-2 text-center text-xl font-bold tracking-[0.03em] text-[#003D2B] leading-tight">
          {step.title}
        </h2>

        {/* Body */}
        <p className="mt-3 text-center text-sm leading-relaxed text-[#2D3A30]">
          {step.body}
        </p>

        {/* Progress dots */}
        <div className="mt-6 flex items-center justify-center gap-2">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all duration-200 ${
                i === stepIdx ? "w-6 bg-[#003D2B]" : "w-1.5 bg-[#003D2B]/20"
              }`}
            />
          ))}
        </div>

        {/* CTA */}
        <button
          type="button"
          onClick={next}
          className="mt-5 w-full h-12 rounded-md bg-[#003D2B] text-[#FFF8F1] font-semibold text-sm tracking-[0.05em] active:scale-[0.98] transition-transform"
        >
          {isLast ? "開始使用" : "下一步"}
        </button>
      </div>
    </div>,
    document.body
  );
}
