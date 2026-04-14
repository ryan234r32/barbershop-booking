"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type ToastType = "success" | "error" | "info";

interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
  /** true while the slide-in animation is active */
  entering: boolean;
  /** true while the slide-out animation is active */
  leaving: boolean;
}

interface ToastInput {
  type: ToastType;
  message: string;
}

interface ToastContextValue {
  toast: (input: ToastInput) => void;
}

/* ------------------------------------------------------------------ */
/*  Context                                                            */
/* ------------------------------------------------------------------ */

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a <ToastProvider>");
  }
  return ctx;
}

/* ------------------------------------------------------------------ */
/*  Icons (inline SVG — zero dependencies)                             */
/* ------------------------------------------------------------------ */

const icons: Record<ToastType, ReactNode> = {
  success: (
    <svg
      className="w-5 h-5 shrink-0"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M5 13l4 4L19 7"
      />
    </svg>
  ),
  error: (
    <svg
      className="w-5 h-5 shrink-0"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6 18L18 6M6 6l12 12"
      />
    </svg>
  ),
  info: (
    <svg
      className="w-5 h-5 shrink-0"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M13 16h-1v-4h-1m1-4h.01"
      />
      <circle cx="12" cy="12" r="10" strokeWidth={2} />
    </svg>
  ),
};

const colorMap: Record<ToastType, string> = {
  success:
    "bg-[var(--color-success)] text-[var(--color-bg)] border-[var(--color-success)]",
  error: "bg-[var(--color-danger)] text-[var(--color-bg)] border-[var(--color-danger)]",
  info: "bg-[var(--color-brand)] text-[var(--color-bg)] border-[var(--color-brand)]",
};

/* ------------------------------------------------------------------ */
/*  Provider                                                           */
/* ------------------------------------------------------------------ */

let nextId = 0;
const AUTO_DISMISS_MS = 3500;
const LEAVE_ANIMATION_MS = 300;
const MAX_TOASTS = 3;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: number) => {
    // start leave animation
    setToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, leaving: true } : t))
    );
    // remove from DOM after animation
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, LEAVE_ANIMATION_MS);
  }, []);

  const toast = useCallback(
    (input: ToastInput) => {
      const id = ++nextId;
      const item: ToastItem = {
        id,
        type: input.type,
        message: input.message,
        entering: true,
        leaving: false,
      };
      setToasts((prev) => {
        // Dedup: skip if identical message already showing
        if (prev.some((t) => t.message === input.message && !t.leaving)) {
          return prev;
        }
        // Cap at MAX_TOASTS — drop oldest
        const capped = prev.length >= MAX_TOASTS ? prev.slice(prev.length - MAX_TOASTS + 1) : prev;
        return [...capped, item];
      });

      // end entering state after a tick so the animation class applies
      requestAnimationFrame(() => {
        setToasts((prev) =>
          prev.map((t) => (t.id === id ? { ...t, entering: false } : t))
        );
      });

      // auto dismiss
      setTimeout(() => removeToast(id), AUTO_DISMISS_MS);
    },
    [removeToast]
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}

      {/* Toast container — fixed at top center */}
      <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-2 w-[90vw] max-w-sm pointer-events-none">
        {toasts.map((t) => (
          <ToastItem key={t.id} item={t} onClose={() => removeToast(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/* ------------------------------------------------------------------ */
/*  Single toast                                                       */
/* ------------------------------------------------------------------ */

function ToastItem({
  item,
  onClose,
}: {
  item: ToastItem;
  onClose: () => void;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // trigger slide-in on next frame
    const raf = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div
      role="alert"
      className={`
        pointer-events-auto flex items-center gap-2 px-4 py-3 rounded-lg
        shadow-xl text-sm font-medium transition-all duration-300 ease-out
        ${colorMap[item.type]}
        ${visible && !item.leaving ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-3"}
      `}
      style={{ boxShadow: "0 10px 25px rgba(0, 61, 43, 0.25)" }}
    >
      {icons[item.type]}
      <span className="flex-1 leading-snug">{item.message}</span>
      <button
        onClick={onClose}
        className="shrink-0 opacity-50 hover:opacity-100 transition-opacity p-0.5"
        aria-label="關閉"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    </div>
  );
}
