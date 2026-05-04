"use client";

/**
 * V3.8 §X — Plain fullscreen modal (replaces vaul Drawer for our full-page sheets).
 *
 * Why not vaul:
 *   ExpenseEntrySheet / DailyCloseSheet are not bottom-sheets — they're
 *   full-page modals. Vaul applies `transform: translate3d(...)` for slide
 *   animations + has known issues on iOS PWA where the transform isn't
 *   cleanly cleared, causing horizontal content shift (老闆 reported 5/3 + 5/4)
 *   and post-keyboard layout glitches ("一半白掉").
 *
 * What this gives us:
 *   - React portal into <body>
 *   - Backdrop overlay (click → close)
 *   - ESC key → close
 *   - Body scroll lock when open
 *   - Safe-area-aware height (100dvh)
 *   - No transform, no drag, no surprise
 */

import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";

interface Props {
  /** Called when user clicks the backdrop or presses ESC. */
  onClose: () => void;
  children: ReactNode;
  /**
   * If true, ignore backdrop click + ESC (caller is in a critical flow that
   * should only be closed via the X button — e.g. mid-form). Default false.
   */
  preventDismiss?: boolean;
}

export function FullscreenModal({
  onClose,
  children,
  preventDismiss = false,
}: Props) {
  // Body scroll lock + ESC handler.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !preventDismiss) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose, preventDismiss]);

  // Render into <body> via portal so the modal isn't subject to ancestor
  // CSS (overflow:hidden, transforms, z-index containers, etc).
  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex flex-col bg-[var(--color-bg)]"
      style={{
        // Use 100dvh so iOS keyboard pop reduces height naturally (vs 100vh
        // which is static and would let keyboard cover content).
        height: "100dvh",
        // Defensive against ancestor padding leakage.
        margin: 0,
      }}
      onClick={(e) => {
        // Click on the modal background (not children) → dismiss.
        // Children stop propagation by being inside the same div.
        if (e.target === e.currentTarget && !preventDismiss) onClose();
      }}
    >
      {children}
    </div>,
    document.body,
  );
}
