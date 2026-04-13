"use client";

import { IconArrowBack, IconClose } from "@/components/liff/icons";

interface BrandHeaderProps {
  title?: string;
  showBack?: boolean;
  onBack?: () => void;
  onClose?: () => void;
  rightContent?: React.ReactNode;
}

export function BrandHeader({
  title = "1008 Hair Studio",
  showBack = false,
  onBack,
  onClose,
  rightContent,
}: BrandHeaderProps) {
  return (
    <header className="glassmorphic fixed top-0 left-0 right-0 z-50 h-14 flex items-center px-4 border-b-[1.5px] border-[#003D2B]/10">
      <div className="flex items-center justify-between w-full max-w-lg mx-auto">
        <div className="flex items-center gap-2">
          {showBack && (
            <button
              onClick={onBack}
              className="flex items-center justify-center w-10 h-10 -ml-2 text-[#003D2B]"
              aria-label="返回"
            >
              <IconArrowBack className="w-5 h-5" />
            </button>
          )}
          <span className="font-bold tracking-widest uppercase text-sm text-[#003D2B]">
            {title}
          </span>
        </div>
        <div className="flex items-center">
          {rightContent
            ? rightContent
            : onClose && (
                <button
                  onClick={onClose}
                  className="flex items-center justify-center w-10 h-10 -mr-2 text-[#003D2B]"
                  aria-label="關閉"
                >
                  <IconClose className="w-5 h-5" />
                </button>
              )}
        </div>
      </div>
    </header>
  );
}
