"use client";

import { useSyncExternalStore, useState, useCallback } from "react";
import { createPortal } from "react-dom";

// SSR-safe: only render portal after hydration
const subscribe = () => () => {};
const getSnapshot = () => true;
const getServerSnapshot = () => false;

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  height?: "50%" | "60%" | "85%";
  children: React.ReactNode;
}

export function BottomSheet({
  isOpen,
  onClose,
  height = "60%",
  children,
}: BottomSheetProps) {
  const mounted = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [closing, setClosing] = useState(false);

  const handleClose = useCallback(() => {
    setClosing(true);
    setTimeout(() => {
      setClosing(false);
      onClose();
    }, 250);
  }, [onClose]);

  if (!mounted || (!isOpen && !closing)) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-60 flex flex-col justify-end"
      aria-modal="true"
      role="dialog"
    >
      {/* Backdrop */}
      <div
        className={`absolute inset-0 backdrop-blur-sm ${
          closing ? "animate-fadeOutOverlay" : "animate-fadeInOverlay"
        }`}
        style={{ backgroundColor: "rgba(45,58,48,0.5)" }}
        onClick={handleClose}
      />

      {/* Sheet */}
      <div
        className={`relative ${
          closing ? "animate-slideDown" : "animate-slideUp"
        }`}
        style={{
          height,
          backgroundColor: "#FFF8F1",
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          paddingLeft: 24,
          paddingRight: 24,
          paddingBottom: 10,
        }}
      >
        {/* Drag Handle */}
        <div className="flex justify-center pt-3 pb-4">
          <div
            className="rounded-full"
            style={{
              width: 40,
              height: 4,
              backgroundColor: "#F3ECE4",
            }}
          />
        </div>

        {/* Content */}
        <div className="overflow-y-auto h-[calc(100%-28px)]">{children}</div>
      </div>
    </div>,
    document.body
  );
}
