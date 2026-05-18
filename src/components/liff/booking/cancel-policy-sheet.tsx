"use client";

import { BottomSheet } from "@/components/liff/bottom-sheet";
import { IconCalendar, IconCheckCircle, IconPhone } from "@/components/liff/icons";

export function CancelPolicySheet({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} height="50%">
      <div>
        <h3 className="text-2xl font-bold text-[#003D2B] tracking-tight mb-5">
          取消政策
        </h3>

        {/* Hero: 改期優先（V3.7 audit — owner wants reschedule as default path） */}
        <div className="rounded-2xl bg-[#003D2B] text-[#FFF8F1] px-5 py-4 mb-3 flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-white/15 flex items-center justify-center shrink-0">
            <IconCalendar className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-[15px] leading-tight">改期免費，隨時可改</div>
            <p className="text-[13px] text-white/70 leading-relaxed mt-0.5">不確定能不能來？建議先改期，不必取消。</p>
          </div>
        </div>

        {/* Compact 2-row card */}
        <div className="rounded-2xl bg-white border border-[#003D2B]/[0.08] overflow-hidden shadow-[0_1px_3px_rgba(0,61,43,0.04)]">
          <div className="flex items-center gap-4 px-5 py-4">
            <div className="w-10 h-10 rounded-full bg-[#003D2B]/[0.06] flex items-center justify-center shrink-0">
              <IconCheckCircle className="w-5 h-5 text-[#003D2B]" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-[#003D2B] text-[15px] leading-tight">24 小時前取消</div>
              <p className="text-[13px] text-[#003D2B]/55 leading-relaxed mt-0.5">可線上免費取消</p>
            </div>
          </div>

          <div className="h-px bg-[#003D2B]/[0.06] ml-[68px] mr-5" />

          <div className="flex items-center gap-4 px-5 py-4">
            <div className="w-10 h-10 rounded-full bg-[#003D2B]/[0.06] flex items-center justify-center shrink-0">
              <IconPhone className="w-[18px] h-[18px] text-[#003D2B]" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-[#003D2B] text-[15px] leading-tight">24 小時內取消</div>
              <p className="text-[13px] text-[#003D2B]/55 leading-relaxed mt-0.5">請於營業時間致電店家</p>
            </div>
          </div>
        </div>

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
