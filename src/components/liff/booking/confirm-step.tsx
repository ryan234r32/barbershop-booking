"use client";

import { useState } from "react";
import { IconCheckCircle, IconPhone, IconCalendar, IconWarning, IconChevronRight } from "@/components/liff/icons";

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
          type="button"
          onClick={() => setPolicyExpanded(!policyExpanded)}
          className="flex items-center justify-between w-full text-left"
        >
          <h3 className="font-bold text-base text-[#003D2B] tracking-tight">取消政策</h3>
          <IconChevronRight
            className={`w-4 h-4 text-[#003D2B]/40 transition-transform duration-200 ${policyExpanded ? 'rotate-90' : 'rotate-0'}`}
          />
        </button>

        {policyExpanded && (
          <div className="mt-4 rounded-2xl bg-white border border-[#003D2B]/[0.08] overflow-hidden animate-fadeIn shadow-[0_1px_3px_rgba(0,61,43,0.04)]">
            {/* Row 1 — 24h 前免費取消 */}
            <div className="flex items-center gap-3.5 px-4 py-3.5">
              <div className="w-9 h-9 rounded-full bg-[#003D2B]/[0.06] flex items-center justify-center shrink-0">
                <IconCheckCircle className="w-[18px] h-[18px] text-[#003D2B]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-[#003D2B] text-[14px] leading-tight">24 小時前取消</div>
                <p className="text-[12px] text-[#003D2B]/55 leading-relaxed mt-0.5">可線上免費取消</p>
              </div>
              <span className="text-[11px] font-semibold text-[#003D2B]/55 tracking-[0.08em] shrink-0">免費</span>
            </div>

            <div className="h-px bg-[#003D2B]/[0.06] ml-[60px] mr-4" />

            {/* Row 2 — 24h 內致電 */}
            <div className="flex items-center gap-3.5 px-4 py-3.5">
              <div className="w-9 h-9 rounded-full bg-[#003D2B]/[0.06] flex items-center justify-center shrink-0">
                <IconPhone className="w-[16px] h-[16px] text-[#003D2B]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-[#003D2B] text-[14px] leading-tight">24 小時內取消</div>
                <p className="text-[12px] text-[#003D2B]/55 leading-relaxed mt-0.5">請於營業時間致電店家</p>
              </div>
              <span className="text-[11px] font-semibold text-[#003D2B]/55 tracking-[0.08em] shrink-0">致電</span>
            </div>

            <div className="h-px bg-[#003D2B]/[0.06] ml-[60px] mr-4" />

            {/* Row 3 — 改期隨時 */}
            <div className="flex items-center gap-3.5 px-4 py-3.5">
              <div className="w-9 h-9 rounded-full bg-[#003D2B]/[0.06] flex items-center justify-center shrink-0">
                <IconCalendar className="w-[16px] h-[16px] text-[#003D2B]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-[#003D2B] text-[14px] leading-tight">改期</div>
                <p className="text-[12px] text-[#003D2B]/55 leading-relaxed mt-0.5">隨時可線上更改，建議優先選擇</p>
              </div>
              <span className="text-[11px] font-semibold text-[#003D2B]/55 tracking-[0.08em] shrink-0">隨時</span>
            </div>

            <div className="h-px bg-[#003D2B]/[0.06] ml-[60px] mr-4" />

            {/* Row 4 — No-show（紅色 accent，克制使用） */}
            <div className="flex items-center gap-3.5 px-4 py-3.5">
              <div className="w-9 h-9 rounded-full bg-[#A84A3B]/[0.08] flex items-center justify-center shrink-0">
                <IconWarning className="w-[16px] h-[16px] text-[#A84A3B]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-[#003D2B] text-[14px] leading-tight">未到店 (No-show)</div>
                <p className="text-[12px] text-[#003D2B]/55 leading-relaxed mt-0.5">未事先通知，記違規一次</p>
              </div>
              <span className="text-[11px] font-semibold text-[#A84A3B] tracking-[0.08em] shrink-0">違規</span>
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
