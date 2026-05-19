"use client";

import { useState } from "react";
import { IconCheckCircle, IconPhone, IconCalendar, IconChevronRight } from "@/components/liff/icons";

export function ConfirmStep({
  notes,
  onNotesChange,
  policyAgreed,
  onPolicyAgreedChange,
  serviceName,
  services,
  date,
  startTime,
  price,
}: {
  notes: string;
  onNotesChange: (v: string) => void;
  policyAgreed: boolean;
  onPolicyAgreedChange: (v: boolean) => void;
  serviceName?: string;
  /** V3.7 P3 — multi-service + variant chip display. Falls back to serviceName when absent. */
  services?: Array<{ name: string; variantName?: string; price: number }>;
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
      {(serviceName || (services && services.length > 0)) && (
        <div className="bg-[#E8F1EC] rounded-xl p-4 mb-6">
          {services && services.length > 0 && (services.length > 1 || services.some((s) => s.variantName)) ? (
            <div className="space-y-2.5">
              <div className="text-sm text-[#003D2B]/60">已選服務</div>
              <div className="flex flex-wrap gap-1.5">
                {services.map((s, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white text-[#003D2B] text-[12px] font-medium border border-[#003D2B]/10"
                  >
                    {s.variantName ? `${s.name}・${s.variantName}` : s.name}
                    <span className="text-[#003D2B]/50 text-[11px]">NT${s.price.toLocaleString()}</span>
                  </span>
                ))}
              </div>
              {date && (
                <div className="flex justify-between items-center pt-1.5">
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
                  <span className="text-sm text-[#003D2B]/60">合計</span>
                  <span className="text-sm font-bold text-[#003D2B]">NT${price.toLocaleString()}</span>
                </div>
              )}
            </div>
          ) : (
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
          )}
        </div>
      )}

      {/* Notes textarea — V3.7 audit: bigger field + concrete placeholder examples */}
      <label className="text-sm font-medium text-[#003D2B] mb-2 block">
        備註<span className="text-[#003D2B]/40 font-normal ml-1">（選填）</span>
      </label>
      <textarea
        value={notes}
        onChange={(e) => onNotesChange(e.target.value)}
        rows={3}
        placeholder="例：想剪短一點留耳上、瀏海要薄、不要染太深、有過敏…"
        className="w-full bg-white border border-[#003D2B]/15 rounded-xl px-4 py-3 text-[15px] text-[#003D2B] placeholder:text-[#003D2B]/35 focus:outline-none focus:border-[#003D2B] focus:ring-2 focus:ring-[#003D2B]/10 resize-none transition-colors"
      />
      <p className="text-[11px] text-[#003D2B]/45 mt-1.5 leading-relaxed">
        想跟老闆說的造型細節、過敏／頭皮狀況、上次染燙時間，都可以寫這裡。
      </p>

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
          <div className="mt-4 space-y-3 animate-fadeIn">
            {/* V3.7 audit: 改期優先，主訴 3 行（24h 免費 / 24h 內致電 / 改期隨時） */}
            <div className="rounded-2xl bg-[#003D2B] text-[#FFF8F1] px-4 py-3.5 flex items-center gap-3.5">
              <div className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center shrink-0">
                <IconCalendar className="w-[18px] h-[18px]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-[14px] leading-tight">改期免費，隨時可改</div>
                <p className="text-[12px] text-white/70 leading-relaxed mt-0.5">不確定能不能來？建議先改期。</p>
              </div>
            </div>

            <div className="rounded-2xl bg-white border border-[#003D2B]/[0.08] overflow-hidden shadow-[0_1px_3px_rgba(0,61,43,0.04)]">
              <div className="flex items-center gap-3.5 px-4 py-3.5">
                <div className="w-9 h-9 rounded-full bg-[#003D2B]/[0.06] flex items-center justify-center shrink-0">
                  <IconCheckCircle className="w-[18px] h-[18px] text-[#003D2B]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-[#003D2B] text-[14px] leading-tight">24 小時前取消</div>
                  <p className="text-[12px] text-[#003D2B]/55 leading-relaxed mt-0.5">可線上免費取消</p>
                </div>
              </div>

              <div className="h-px bg-[#003D2B]/[0.06] ml-[60px] mr-4" />

              <div className="flex items-center gap-3.5 px-4 py-3.5">
                <div className="w-9 h-9 rounded-full bg-[#003D2B]/[0.06] flex items-center justify-center shrink-0">
                  <IconPhone className="w-[16px] h-[16px] text-[#003D2B]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-[#003D2B] text-[14px] leading-tight">24 小時內取消</div>
                  <p className="text-[12px] text-[#003D2B]/55 leading-relaxed mt-0.5">請於營業時間致電店家</p>
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
