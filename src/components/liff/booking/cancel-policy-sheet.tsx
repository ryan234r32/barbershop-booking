"use client";

import { BottomSheet } from "@/components/liff/bottom-sheet";
import { IconEventAvailable, IconPhone, IconWarning, IconInfo } from "@/components/liff/icons";

export function CancelPolicySheet({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} height="60%">
      <div>
        {/* Title */}
        <h3 className="text-2xl font-bold text-[#003D2B] tracking-tight mb-8">
          取消政策
        </h3>

        {/* Policy blocks */}
        <div className="space-y-4">
          {/* Block 1 — Free cancellation (green) */}
          <div className="rounded-2xl bg-[#E8F1EC] p-5">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-[#003D2B] rounded-full flex items-center justify-center shrink-0 overflow-hidden">
                <IconEventAvailable className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-[#003D2B] text-sm">前一天取消</span>
                  <span className="bg-[#003D2B] text-white rounded-full text-xs px-3 py-1 font-medium">
                    免費
                  </span>
                </div>
                <p className="text-sm text-[#404944] leading-relaxed">
                  預約前一日 23:59 前取消，不收任何費用，感謝您的提早通知。
                </p>
              </div>
            </div>
          </div>

          {/* Block 2 — Phone only (amber) */}
          <div className="rounded-2xl bg-[#FBF1E6] p-5">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-[#8A6A4D] rounded-full flex items-center justify-center shrink-0 overflow-hidden">
                <IconPhone className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-[#003D2B] text-sm">當天營業時間內</span>
                  <span className="bg-[#8A6A4D] text-white rounded-full text-xs px-3 py-1 font-medium">
                    電話聯繫
                  </span>
                </div>
                <p className="text-sm text-[#404944] leading-relaxed">
                  預約當日如需變更，系統已關閉取消功能，請務必直接撥打電話與店家聯繫。
                </p>
              </div>
            </div>
          </div>

          {/* Block 3 — Violation (red) */}
          <div className="rounded-2xl bg-[#FDEEEF] p-5">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-[#A84A3B] rounded-full flex items-center justify-center shrink-0 overflow-hidden">
                <IconWarning className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-[#003D2B] text-sm">當天非營業時間</span>
                  <span className="bg-[#A84A3B] text-white rounded-full text-xs px-3 py-1 font-medium">
                    記違規一次
                  </span>
                </div>
                <p className="text-sm text-[#404944] leading-relaxed">
                  非營業時間內於線上取消預約，系統將自動記錄違規一次。請謹慎操作。
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer warning */}
        <div className="mt-8 flex items-center gap-3 p-4 bg-[#f4ede5] rounded-xl">
          <IconInfo className="w-5 h-5 text-[#003D2B]/60 shrink-0" />
          <p className="text-xs text-[#003D2B]/70 leading-relaxed">
            累積 <span className="font-bold text-[#003D2B]">3 次</span>違規 → 系統將暫停線上預約權限 30 天
          </p>
        </div>

        {/* Close button */}
        <button
          onClick={onClose}
          className="w-full bg-[#003D2B] text-[#FFF8F1] py-4 rounded-xl font-bold mt-6 transition-colors hover:bg-[#003D2B]/90"
        >
          我知道了
        </button>
      </div>
    </BottomSheet>
  );
}
