"use client";

/**
 * Compact zoom controls — minus / current label / plus.
 * Used in calendar top bar for desktop discoverability of the
 * Ctrl+wheel / pinch gesture (PRD-v3 D-1).
 */

import { Minus, Plus } from "lucide-react";
import { ZOOM_STOPS } from "./use-zoom";

interface Props {
  stopIndex: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
}

export function ZoomControls({ stopIndex, onZoomIn, onZoomOut }: Props) {
  const atMin = stopIndex <= 0;
  const atMax = stopIndex >= ZOOM_STOPS.length - 1;
  return (
    <div className="inline-flex items-center gap-0.5 border border-[var(--color-surface)] rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={onZoomOut}
        disabled={atMin}
        aria-label="縮小時間軸"
        className="p-1 text-[var(--color-text-body)] hover:bg-[var(--color-surface)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        <Minus size={14} />
      </button>
      <span
        className="text-[10px] font-mono text-[var(--color-text-muted)] w-7 text-center"
        title="提示：Ctrl+滾輪 或 雙指捏合"
      >
        {ZOOM_STOPS[stopIndex]}
      </span>
      <button
        type="button"
        onClick={onZoomIn}
        disabled={atMax}
        aria-label="放大時間軸"
        className="p-1 text-[var(--color-text-body)] hover:bg-[var(--color-surface)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        <Plus size={14} />
      </button>
    </div>
  );
}
