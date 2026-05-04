"use client";

import { BottomSheet } from "@/components/liff/bottom-sheet";
import { IconCheckCircle, IconPhone, IconCalendar, IconWarning } from "@/components/liff/icons";

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
        <h3 className="text-2xl font-bold text-[#003D2B] tracking-tight mb-6">
          取消政策
        </h3>

        {/* Grouped policy list — Apple-style settings card */}
        <div className="rounded-2xl bg-white border border-[#003D2B]/[0.08] overflow-hidden shadow-[0_1px_3px_rgba(0,61,43,0.04)]">
          {/* Row 1 — 24h 前免費取消 */}
          <div className="flex items-center gap-4 px-5 py-4">
            <div className="w-10 h-10 rounded-full bg-[#003D2B]/[0.06] flex items-center justify-center shrink-0">
              <IconCheckCircle className="w-5 h-5 text-[#003D2B]" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-[#003D2B] text-[15px] leading-tight">24 小時前取消</div>
              <p className="text-[13px] text-[#003D2B]/55 leading-relaxed mt-0.5">可線上免費取消</p>
            </div>
            <span className="text-[11px] font-semibold text-[#003D2B]/55 tracking-[0.08em] shrink-0">免費</span>
          </div>

          <div className="h-px bg-[#003D2B]/[0.06] ml-[68px] mr-5" />

          {/* Row 2 — 24h 內致電 */}
          <div className="flex items-center gap-4 px-5 py-4">
            <div className="w-10 h-10 rounded-full bg-[#003D2B]/[0.06] flex items-center justify-center shrink-0">
              <IconPhone className="w-[18px] h-[18px] text-[#003D2B]" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-[#003D2B] text-[15px] leading-tight">24 小時內取消</div>
              <p className="text-[13px] text-[#003D2B]/55 leading-relaxed mt-0.5">請於營業時間致電店家</p>
            </div>
            <span className="text-[11px] font-semibold text-[#003D2B]/55 tracking-[0.08em] shrink-0">致電</span>
          </div>

          <div className="h-px bg-[#003D2B]/[0.06] ml-[68px] mr-5" />

          {/* Row 3 — 改期隨時 */}
          <div className="flex items-center gap-4 px-5 py-4">
            <div className="w-10 h-10 rounded-full bg-[#003D2B]/[0.06] flex items-center justify-center shrink-0">
              <IconCalendar className="w-[18px] h-[18px] text-[#003D2B]" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-[#003D2B] text-[15px] leading-tight">改期</div>
              <p className="text-[13px] text-[#003D2B]/55 leading-relaxed mt-0.5">隨時可線上更改，建議優先選擇</p>
            </div>
            <span className="text-[11px] font-semibold text-[#003D2B]/55 tracking-[0.08em] shrink-0">隨時</span>
          </div>

          <div className="h-px bg-[#003D2B]/[0.06] ml-[68px] mr-5" />

          {/* Row 4 — No-show（紅色 accent） */}
          <div className="flex items-center gap-4 px-5 py-4">
            <div className="w-10 h-10 rounded-full bg-[#A84A3B]/[0.08] flex items-center justify-center shrink-0">
              <IconWarning className="w-[18px] h-[18px] text-[#A84A3B]" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-[#003D2B] text-[15px] leading-tight">未到店 (No-show)</div>
              <p className="text-[13px] text-[#003D2B]/55 leading-relaxed mt-0.5">未事先通知，記違規一次</p>
            </div>
            <span className="text-[11px] font-semibold text-[#A84A3B] tracking-[0.08em] shrink-0">違規</span>
          </div>
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
