"use client";

import { BottomSheet } from "@/components/liff/bottom-sheet";
import { IconEventAvailable, IconWarning } from "@/components/liff/icons";

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
          {/* Block 1 — Cancel ≥24h free (green) */}
          <div className="rounded-2xl bg-[#E8F1EC] p-5">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-[#003D2B] rounded-full flex items-center justify-center shrink-0 overflow-hidden">
                <IconEventAvailable className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-[#003D2B] text-sm">取消</span>
                  <span className="bg-[#003D2B] text-white rounded-full text-xs px-3 py-1 font-medium">
                    24 小時前免費
                  </span>
                </div>
                <p className="text-sm text-[#404944] leading-relaxed">
                  預約 24 小時前可線上免費取消。24 小時內的取消請於營業時間致電店家。
                </p>
              </div>
            </div>
          </div>

          {/* Block 2 — Reschedule anytime online, with guardrails (green) */}
          <div className="rounded-2xl bg-[#E8F1EC] p-5">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-[#003D2B] rounded-full flex items-center justify-center shrink-0 overflow-hidden">
                <IconEventAvailable className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-[#003D2B] text-sm">改期</span>
                  <span className="bg-[#003D2B] text-white rounded-full text-xs px-3 py-1 font-medium">
                    隨時可線上改
                  </span>
                </div>
                <p className="text-sm text-[#404944] leading-relaxed">
                  想換時間優先選改期，不用取消重訂。
                </p>
              </div>
            </div>
          </div>

          {/* Block 3 — No-show = violation (red) */}
          <div className="rounded-2xl bg-[#FDEEEF] p-5">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-[#A84A3B] rounded-full flex items-center justify-center shrink-0 overflow-hidden">
                <IconWarning className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-[#003D2B] text-sm">未到店 (No-show)</span>
                  <span className="bg-[#A84A3B] text-white rounded-full text-xs px-3 py-1 font-medium">
                    計違規一次
                  </span>
                </div>
                <p className="text-sm text-[#404944] leading-relaxed">
                  未到店且未事先通知取消，將記錄為違規一次。
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Close button */}
        <button
          onClick={onClose}
          className="w-full bg-[#003D2B] text-[#FFF8F1] py-4 rounded-xl font-bold mt-8 transition-colors hover:bg-[#003D2B]/90"
        >
          我知道了
        </button>
      </div>
    </BottomSheet>
  );
}
