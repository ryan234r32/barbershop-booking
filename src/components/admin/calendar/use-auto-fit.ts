"use client";

/**
 * Auto-fit hook (PRD-v3 §4 + designer review B1).
 *
 * Measures the container's available height and divides by hourCount, clamped
 * by [min, max] per-row. The result feeds drag-to-create pixel math + the
 * absolute-positioned current-time line + the drag preview overlay.
 *
 * Designer floor/cap:
 *  - Day view: 44px (Apple touch target) min, 72px max
 *  - Week view: 44px min, 64px max (above 64 columns get too narrow)
 *
 * When the container height isn't enough for hourCount × min, the layout
 * overflows and scroll re-engages — this is intentional (small landscape +
 * keyboard scenario).
 */

import { useEffect, useState } from "react";

export function useAutoFit(
  ref: React.RefObject<HTMLDivElement | null>,
  hourCount: number,
  minPx: number,
  maxPx: number,
): number {
  // Mid-range default avoids a flash on first paint before observer fires.
  const [slotHeight, setSlotHeight] = useState(Math.round((minPx + maxPx) / 2));

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const h = el.clientHeight;
      if (h <= 0) return;
      const computed = h / hourCount;
      setSlotHeight(Math.max(minPx, Math.min(maxPx, computed)));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, hourCount, minPx, maxPx]);

  return slotHeight;
}
