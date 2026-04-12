"use client";

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
    <header
      className="glassmorphic fixed top-0 left-0 right-0 z-50 h-16 flex items-center px-4"
      style={{
        borderBottom: "1.5px solid rgba(0,61,43,0.1)",
      }}
    >
      <div className="flex items-center justify-between w-full max-w-lg mx-auto">
        {/* Left side */}
        <div className="flex items-center gap-2">
          {showBack && (
            <button
              onClick={onBack}
              className="flex items-center justify-center w-10 h-10 -ml-2 rounded-full transition-colors active:bg-[#003D2B]/5"
              aria-label="返回"
            >
              <span
                className="material-symbols-outlined"
                style={{ color: "#003D2B", fontSize: 24 }}
              >
                arrow_back
              </span>
            </button>
          )}
          <span
            className="font-headline font-bold tracking-widest uppercase text-sm"
            style={{ color: "#003D2B" }}
          >
            {title}
          </span>
        </div>

        {/* Right side */}
        <div className="flex items-center">
          {rightContent
            ? rightContent
            : onClose && (
                <button
                  onClick={onClose}
                  className="flex items-center justify-center w-10 h-10 -mr-2 rounded-full transition-colors active:bg-[#003D2B]/5"
                  aria-label="關閉"
                >
                  <span
                    className="material-symbols-outlined"
                    style={{ color: "#003D2B", fontSize: 24 }}
                  >
                    close
                  </span>
                </button>
              )}
        </div>
      </div>
    </header>
  );
}
