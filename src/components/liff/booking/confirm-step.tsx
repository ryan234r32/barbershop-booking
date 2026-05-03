"use client";

import { useState } from "react";
import { IconEventAvailable, IconPhone, IconWarning } from "@/components/liff/icons";

export function ConfirmStep({
  notes,
  onNotesChange,
  policyAgreed,
  onPolicyAgreedChange,
  serviceName,
  date,
  startTime,
  price,
}: {
  notes: string;
  onNotesChange: (v: string) => void;
  policyAgreed: boolean;
  onPolicyAgreedChange: (v: boolean) => void;
  serviceName?: string;
  date?: string;
  startTime?: string;
  price?: number;
}) {
  const [policyExpanded, setPolicyExpanded] = useState(true);

  return (
    <div>
      {/* Step label */}
      <span className="text-[10px] tracking-[0.15em] font-semibold text-[#003D2B]/60 uppercase">
        STEP 03
      </span>
      <h2 className="font-bold text-2xl text-[#003D2B] mt-1 mb-6">
        備註與確認
      </h2>

      {/* Booking summary card */}
      {serviceName && (
        <div className="bg-[#E8F1EC] rounded-xl p-4 mb-6">
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <span className="text-sm text-[#003D2B]/60">服務</span>
              <span className="text-sm font-medium text-[#003D2B]">{serviceName}</span>
            </div>
            {date && (
              <div className="flex justify-between items-center">
                <span className="text-sm text-[#003D2B]/60">日期</span>
                <span className="text-sm font-medium text-[#003D2B]">{date}</span>
              </div>
            )}
            {startTime && (
              <div className="flex justify-between items-center">
                <span className="text-sm text-[#003D2B]/60">時間</span>
                <span className="text-sm font-medium text-[#003D2B]">{startTime}</span>
              </div>
            )}
            {price != null && (
              <div className="flex justify-between items-center pt-1.5 border-t border-[#003D2B]/10">
                <span className="text-sm text-[#003D2B]/60">預估金額</span>
                <span className="text-sm font-bold text-[#003D2B]">NT${price.toLocaleString()}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Notes textarea */}
      <label className="text-xs font-medium text-[#003D2B]/50 mb-1 block">備註（選填）</label>
      <textarea
        value={notes}
        onChange={(e) => onNotesChange(e.target.value)}
        placeholder="想告訴設計師什麼嗎？"
        className="w-full bg-transparent border-0 border-b-[1.5px] border-[#003D2B]/20 focus:ring-0 focus:outline-none focus:border-[#003D2B] px-0 py-2 text-sm text-[#003D2B] placeholder:text-[#003D2B]/30 min-h-[60px] resize-none"
      />

      {/* Cancel policy — inline */}
      <div className="mt-8">
        <button
          onClick={() => setPolicyExpanded(!policyExpanded)}
          className="flex items-center justify-between w-full text-left"
        >
          <h3 className="font-bold text-base text-[#003D2B]">取消政策</h3>
          <span className={`text-[#003D2B]/40 text-sm transition-transform ${policyExpanded ? 'rotate-0' : '-rotate-90'}`}>
            ▼
          </span>
        </button>

        {policyExpanded && (
          <div className="mt-4 space-y-3 animate-fadeIn">
            {/* Block 1 — Cancel ≥ 24h free */}
            <div className="rounded-xl bg-[#E8F1EC] p-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-[#003D2B] rounded-full flex items-center justify-center shrink-0">
                  <IconEventAvailable className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="font-bold text-[#003D2B] text-sm">24 小時前取消</span>
                    <span className="bg-[#003D2B] text-white rounded-full text-[10px] px-2 py-0.5 font-medium">
                      免費
                    </span>
                  </div>
                  <p className="text-xs text-[#404944] leading-relaxed">
                    預約 24 小時前可線上免費取消。
                  </p>
                </div>
              </div>
            </div>

            {/* Block 2 — Cancel < 24h must call */}
            <div className="rounded-xl bg-[#FBF1E6] p-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-[#8A6A4D] rounded-full flex items-center justify-center shrink-0">
                  <IconPhone className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="font-bold text-[#5C4633] text-sm">24 小時內取消</span>
                    <span className="bg-[#8A6A4D] text-white rounded-full text-[10px] px-2 py-0.5 font-medium">
                      電話聯繫
                    </span>
                  </div>
                  <p className="text-xs text-[#404944] leading-relaxed">
                    請於營業時間致電店家。
                  </p>
                </div>
              </div>
            </div>

            {/* Block 3 — Reschedule anytime online */}
            <div className="rounded-xl bg-[#E8F1EC] p-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-[#003D2B] rounded-full flex items-center justify-center shrink-0">
                  <IconEventAvailable className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="font-bold text-[#003D2B] text-sm">改期</span>
                    <span className="bg-[#003D2B] text-white rounded-full text-[10px] px-2 py-0.5 font-medium">
                      隨時可線上改
                    </span>
                  </div>
                  <p className="text-xs text-[#404944] leading-relaxed">
                    想換時間優先選改期，不用取消重訂。
                  </p>
                </div>
              </div>
            </div>

            {/* Block 4 — No-show = violation */}
            <div className="rounded-xl bg-[#FDEEEF] p-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-[#A84A3B] rounded-full flex items-center justify-center shrink-0">
                  <IconWarning className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="font-bold text-[#93000A] text-sm">未到店 (No-show)</span>
                    <span className="bg-[#A84A3B] text-white rounded-full text-[10px] px-2 py-0.5 font-medium">
                      記違規一次
                    </span>
                  </div>
                  <p className="text-xs text-[#404944] leading-relaxed">
                    未到店且未事先通知取消，將記錄為違規一次。
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Checkbox — agree to policy */}
      <label className="mt-6 flex items-start gap-3 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={policyAgreed}
          onChange={(e) => onPolicyAgreedChange(e.target.checked)}
          className="mt-0.5 w-5 h-5 rounded border-[#003D2B]/30 text-[#003D2B] focus:ring-[#003D2B] focus:ring-offset-0"
        />
        <span className="text-sm text-[#003D2B]">
          我已閱讀並同意取消政策
        </span>
      </label>

      {/* Phone number */}
      <div className="mt-8 text-center text-xs text-[#003D2B]/40">
        需要協助？致電{" "}
        <a href="tel:02-2396-2306" className="text-[#003D2B] font-medium underline underline-offset-2">
          02-2396-2306
        </a>
      </div>
    </div>
  );
}
