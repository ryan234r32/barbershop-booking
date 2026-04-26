"use client";

/**
 * Calendar timeline zoom (PRD-v3 D-1).
 * Four stops: 32 / 48 / 56 / 96 px slot height. Default = 56.
 *
 * Inputs accepted:
 *  - Ctrl + wheel (or pinch on a trackpad → wheel with ctrlKey)
 *  - Pinch on touch (two-pointer distance)
 *  - Direct setStop / zoomIn / zoomOut from buttons
 *
 * Persists across sessions via localStorage `admin.calendar.zoom` (cross-tab
 * sync via the native `storage` event).
 */

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";

export const ZOOM_STOPS = [32, 48, 56, 96] as const;
export type ZoomStop = (typeof ZOOM_STOPS)[number];
export const DEFAULT_STOP_INDEX = 2; // 56 px
const STORAGE_KEY = "admin.calendar.zoom";

function readStoredIndex(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const n = raw === null ? NaN : Number(raw);
    if (Number.isInteger(n) && n >= 0 && n < ZOOM_STOPS.length) return n;
  } catch {
    // unavailable
  }
  return DEFAULT_STOP_INDEX;
}

function getSnapshot(): number {
  return readStoredIndex();
}

function getServerSnapshot(): number {
  return DEFAULT_STOP_INDEX;
}

function subscribe(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

function writeIndex(idx: number) {
  try {
    localStorage.setItem(STORAGE_KEY, String(idx));
  } catch {
    // ignore
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY, newValue: String(idx) }));
  }
}

export interface UseZoom {
  slotHeight: ZoomStop;
  stopIndex: number;
  zoomIn: () => void;
  zoomOut: () => void;
  setStop: (idx: number) => void;
  /** Attach to the zoomable container element. */
  containerRef: React.RefObject<HTMLDivElement | null>;
  onWheel: (e: React.WheelEvent<HTMLDivElement>) => void;
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerUp: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerCancel: (e: React.PointerEvent<HTMLDivElement>) => void;
}

export function useZoom(): UseZoom {
  const stopIndex = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const slotHeight = ZOOM_STOPS[stopIndex];

  const setStop = useCallback((idx: number) => {
    const clamped = Math.max(0, Math.min(ZOOM_STOPS.length - 1, idx));
    writeIndex(clamped);
  }, []);

  const zoomIn = useCallback(() => setStop(readStoredIndex() + 1), [setStop]);
  const zoomOut = useCallback(() => setStop(readStoredIndex() - 1), [setStop]);

  // ─── Pinch + ctrl-wheel handlers ───
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchStartDistRef = useRef<number | null>(null);
  const pinchStartIndexRef = useRef<number>(DEFAULT_STOP_INDEX);

  const onWheel = useCallback(
    (e: React.WheelEvent<HTMLDivElement>) => {
      // Ctrl/⌘ + wheel = zoom (Mac trackpad pinch also surfaces as ctrlKey wheel)
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      if (e.deltaY < 0) zoomIn();
      else if (e.deltaY > 0) zoomOut();
    },
    [zoomIn, zoomOut],
  );

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "touch") return;
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointersRef.current.size === 2) {
      const pts = Array.from(pointersRef.current.values());
      const dx = pts[0].x - pts[1].x;
      const dy = pts[0].y - pts[1].y;
      pinchStartDistRef.current = Math.sqrt(dx * dx + dy * dy);
      pinchStartIndexRef.current = readStoredIndex();
    }
  }, []);

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.pointerType !== "touch") return;
      if (!pointersRef.current.has(e.pointerId)) return;
      pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointersRef.current.size !== 2 || pinchStartDistRef.current === null) return;
      const pts = Array.from(pointersRef.current.values());
      const dx = pts[0].x - pts[1].x;
      const dy = pts[0].y - pts[1].y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const ratio = dist / pinchStartDistRef.current;
      // Map ratio → stop delta. >1.25 → +1, >1.6 → +2, etc. (logarithmic feel)
      let delta = 0;
      if (ratio > 1.6) delta = 2;
      else if (ratio > 1.25) delta = 1;
      else if (ratio < 0.625) delta = -2;
      else if (ratio < 0.8) delta = -1;
      const target = pinchStartIndexRef.current + delta;
      if (target !== readStoredIndex()) {
        setStop(target);
      }
    },
    [setStop],
  );

  const endPointer = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size < 2) {
      pinchStartDistRef.current = null;
    }
  }, []);

  // Native wheel listener with passive:false so we can preventDefault
  // (React's onWheel is passive in React 17+).
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      if (e.deltaY < 0) zoomIn();
      else if (e.deltaY > 0) zoomOut();
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, [zoomIn, zoomOut]);

  return {
    slotHeight,
    stopIndex,
    zoomIn,
    zoomOut,
    setStop,
    containerRef,
    onWheel,
    onPointerDown,
    onPointerMove,
    onPointerUp: endPointer,
    onPointerCancel: endPointer,
  };
}
