"use client";

import { useState } from "react";
import { IconCheck } from "@/components/liff/icons";
import { BottomSheet } from "@/components/liff/bottom-sheet";
import { useLiff } from "@/lib/liff/provider";

interface ServiceVariant {
  id: string;
  name: string;
  price: number;
  durationMin: number;
  slotsNeeded: number;
  sortOrder: number;
}

interface Service {
  id: string;
  name: string;
  description: string | null;
  duration: number;
  slotsNeeded: number;
  price: number;
  hasVariants?: boolean;
  bookingMode?: "NORMAL" | "CONSULTATION";
  variants?: ServiceVariant[];
}

/** A selected item in cart — service + optional variant. */
export interface Selection {
  service: Service;
  variant?: ServiceVariant;
}

const treatmentTriggerTerms = ["染", "燙", "漂", "矯正"];

function isTreatmentSelection(selection: Selection) {
  const name = `${selection.service.name} ${selection.variant?.name ?? ""}`;
  return name.includes("護髮");
}

function shouldRecommendTreatment(name: string) {
  return !name.includes("護髮") && treatmentTriggerTerms.some((term) => name.includes(term));
}

function isDirectTreatmentAddOn(service: Service) {
  const hasVariantChoices = !!service.hasVariants && (service.variants?.length ?? 0) > 0;
  return (
    service.bookingMode !== "CONSULTATION" &&
    service.name.includes("護髮") &&
    !service.name.includes("獨立") &&
    !hasVariantChoices
  );
}

/**
 * V3.7 P3 — 服務多選 + 諮詢服務 + 服務變體。
 * - NORMAL + !hasVariants: 點 tile toggle 加入/移除。
 * - NORMAL + hasVariants: 點 tile 展開變體 chip，點 chip 選/換變體。
 * - CONSULTATION: 點 tile 開 sheet 引導去 LINE 對話。
 */
export function ServiceStep({
  services,
  selectedSelections,
  onToggle,
  onPickVariant,
}: {
  services: Service[];
  selectedSelections: Selection[];
  onToggle: (service: Service) => void;
  onPickVariant: (service: Service, variant: ServiceVariant) => void;
}) {
  const { liff } = useLiff();
  const [consultationSheetOpen, setConsultationSheetOpen] = useState(false);
  const [consultationService, setConsultationService] = useState<Service | null>(null);
  const [expandedServiceId, setExpandedServiceId] = useState<string | null>(null);

  // Aggregated totals across selections.
  const totalDuration = selectedSelections.reduce(
    (sum, s) => sum + (s.variant?.durationMin ?? s.service.duration),
    0
  );
  const totalPrice = selectedSelections.reduce(
    (sum, s) => sum + (s.variant?.price ?? s.service.price),
    0
  );
  const hasSelection = selectedSelections.length > 0;
  const treatmentAddOn = services.find(isDirectTreatmentAddOn);
  const shouldShowTreatmentAddOn =
    !!treatmentAddOn &&
    !selectedSelections.some(isTreatmentSelection) &&
    selectedSelections.some((selection) =>
      shouldRecommendTreatment(`${selection.service.name} ${selection.variant?.name ?? ""}`)
    );
  const consultationSuggestsTreatment =
    !!consultationService && shouldRecommendTreatment(consultationService.name);

  const handleServiceClick = (service: Service) => {
    if (service.bookingMode === "CONSULTATION") {
      setConsultationService(service);
      setConsultationSheetOpen(true);
      return;
    }
    if (service.hasVariants && service.variants && service.variants.length > 0) {
      // Toggle expand / collapse
      setExpandedServiceId((prev) => (prev === service.id ? null : service.id));
      return;
    }
    onToggle(service);
  };

  const handleVariantClick = (service: Service, variant: ServiceVariant) => {
    onPickVariant(service, variant);
  };

  const isVariantSelected = (serviceId: string, variantId: string) =>
    selectedSelections.some((s) => s.service.id === serviceId && s.variant?.id === variantId);

  const isServiceSelected = (serviceId: string) =>
    selectedSelections.some((s) => s.service.id === serviceId);

  const handleOpenLineChat = () => {
    setConsultationSheetOpen(false);
    if (liff) {
      liff.closeWindow();
    }
  };

  return (
    <div>
      {/* Step label */}
      <span className="font-headline text-[10px] tracking-[0.15em] font-semibold text-[#003D2B]/60 uppercase">
        STEP 01
      </span>

      {/* Title */}
      <h2 className="font-headline font-bold text-[2rem] text-[#003D2B] mt-2">
        選擇服務
      </h2>
      <p className="text-[13px] text-[#003D2B]/55 mt-1.5">
        可同時選多項（例：剪 + 染 + 護髮）
      </p>

      {/* Summary band */}
      <div
        className={`mt-5 rounded-xl px-4 py-3 transition-colors ${
          hasSelection ? "bg-[#003D2B] text-[#FFF8F1]" : "bg-[#003D2B]/[0.05] text-[#003D2B]/55"
        }`}
      >
        {hasSelection ? (
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[11px] tracking-wider uppercase opacity-70">
                已選 {selectedSelections.length} 項
              </div>
              <div className="text-[13px] font-medium truncate">
                {selectedSelections
                  .map((s) => (s.variant ? `${s.service.name}・${s.variant.name}` : s.service.name))
                  .join(" + ")}
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-[11px] tracking-wider uppercase opacity-70">合計</div>
              <div className="text-base font-bold">
                NT$ {totalPrice.toLocaleString()}
              </div>
              <div className="text-[11px] opacity-70">約 {totalDuration} 分鐘</div>
            </div>
          </div>
        ) : (
          <div className="text-[13px]">點選下方服務開始（可複選）</div>
        )}
      </div>

      {shouldShowTreatmentAddOn && treatmentAddOn && (
        <div className="mt-4 rounded-xl border border-[#D8B46A]/35 bg-[#FFF8F1] p-4 shadow-[0_12px_28px_rgba(0,37,25,0.05)]">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[11px] font-bold tracking-[0.14em] text-[#9C6B1D] uppercase">
                推薦加選
              </div>
              <div className="mt-1 text-[15px] font-bold text-[#003D2B]">
                {treatmentAddOn.name}
              </div>
              <p className="mt-1 text-[12px] leading-relaxed text-[#003D2B]/60">
                搭配染燙時一起護髮，髮況會更穩定，也比較能維持整理後的質感。
              </p>
            </div>
            <button
              onClick={() => onToggle(treatmentAddOn)}
              className="shrink-0 whitespace-nowrap rounded-lg bg-[#003D2B] px-3 py-2 text-[12px] font-bold text-[#FFF8F1] active:scale-[0.98] transition-transform"
            >
              加選 NT$ {treatmentAddOn.price.toLocaleString()}
            </button>
          </div>
        </div>
      )}

      {/* Service grid */}
      <div className="grid grid-cols-2 gap-4 mt-6">
        {services.map((service) => {
          const isConsultation = service.bookingMode === "CONSULTATION";
          const hasVariants = !!service.hasVariants && (service.variants?.length ?? 0) > 0;
          const isSelected = isServiceSelected(service.id);
          const isExpanded = expandedServiceId === service.id;

          return (
            <div key={service.id} className={hasVariants && isExpanded ? "col-span-2" : ""}>
              <button
                onClick={() => handleServiceClick(service)}
                className={`
                  w-full h-[180px] flex flex-col justify-between p-4 rounded-xl text-left
                  transition-all duration-300 relative
                  ${
                    isSelected
                      ? "bg-[#FFF8F1] border-2 border-[#003D2B] shadow-[0_20px_40px_rgba(0,37,25,0.04)]"
                      : "bg-[#faf2ea] border-2 border-transparent hover:bg-[#eee7df]"
                  }
                `}
              >
                {isSelected && !hasVariants && (
                  <div className="absolute top-3 right-3 w-5 h-5 bg-[#003D2B] rounded-full flex items-center justify-center">
                    <IconCheck className="w-3.5 h-3.5 text-white" />
                  </div>
                )}

                {isConsultation && (
                  <div className="absolute top-3 right-3 px-2 py-0.5 rounded-full bg-[#003D2B]/10 text-[#003D2B] text-[10px] font-bold tracking-wider">
                    諮詢
                  </div>
                )}

                {hasVariants && !isConsultation && (
                  <div className="absolute top-3 right-3 px-2 py-0.5 rounded-full bg-[#003D2B]/10 text-[#003D2B] text-[10px] font-bold tracking-wider">
                    {isExpanded ? "收合" : "選項"}
                  </div>
                )}

                {/* Top: name + duration */}
                <div>
                  <span className="text-[#003D2B] font-semibold text-base block">
                    {service.name}
                  </span>
                  {isConsultation ? (
                    <span className="text-[#73A891] text-xs block mt-1">
                      請傳照片至 LINE 對話
                    </span>
                  ) : (
                    <span className="text-[#73A891] text-xs block mt-1">
                      約 {service.duration} 分鐘
                    </span>
                  )}
                </div>

                {/* Bottom: price */}
                <span className="text-[#003D2B] font-bold text-lg">
                  {isConsultation ? (
                    <span className="text-[13px] font-semibold text-[#003D2B]/70">需先諮詢</span>
                  ) : hasVariants ? (
                    <>
                      NT$ {service.price.toLocaleString()}
                      <span className="text-[11px] font-normal text-[#003D2B]/50 ml-1">起</span>
                    </>
                  ) : (
                    <>NT$ {service.price.toLocaleString()}</>
                  )}
                </span>
              </button>

              {/* Variant chips — inline expansion */}
              {hasVariants && isExpanded && service.variants && (
                <div className="mt-3 p-3 rounded-xl bg-[#003D2B]/[0.04] animate-fadeIn">
                  <div className="text-[11px] tracking-wider uppercase text-[#003D2B]/55 mb-2 font-semibold">
                    選擇方案
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {service.variants.map((variant) => {
                      const selected = isVariantSelected(service.id, variant.id);
                      return (
                        <button
                          key={variant.id}
                          onClick={() => handleVariantClick(service, variant)}
                          className={`
                            inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[13px] font-medium
                            transition-all
                            ${
                              selected
                                ? "bg-[#003D2B] text-[#FFF8F1] shadow-[0_4px_12px_rgba(0,61,43,0.2)]"
                                : "bg-white text-[#003D2B] border border-[#003D2B]/15 hover:border-[#003D2B]/40"
                            }
                          `}
                        >
                          {selected && <IconCheck className="w-3.5 h-3.5" />}
                          <span>{variant.name}</span>
                          <span className={selected ? "opacity-80" : "text-[#003D2B]/50"}>
                            NT$ {variant.price.toLocaleString()}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Consultation sheet — guide user back to LINE chat */}
      <BottomSheet
        isOpen={consultationSheetOpen}
        onClose={() => setConsultationSheetOpen(false)}
        height="60%"
      >
        <div className="pb-6">
          <h3 className="font-bold text-xl text-[#003D2B]">
            {consultationService?.name ?? "諮詢服務"}
          </h3>
          <p className="text-[13px] text-[#003D2B]/60 mt-2 leading-relaxed">
            這項服務需要老闆先評估您的髮況。請回到 LINE 對話傳以下三張照片，老闆確認後會幫您安排時段。
          </p>

          {consultationSuggestsTreatment && (
            <div className="mt-4 rounded-xl bg-[#FFF8F1] border border-[#D8B46A]/35 p-3.5">
              <div className="text-[13px] font-bold text-[#003D2B]">
                染燙通常會建議搭配護髮
              </div>
              <p className="mt-1 text-[12px] leading-relaxed text-[#003D2B]/60">
                傳照片時可以一起告訴老闆是否想加護髮，老闆會連同時間與費用一起確認。
              </p>
            </div>
          )}

          <div className="mt-5 space-y-3">
            {[
              { tag: "A", label: "現況照", desc: "目前的髮色與狀態" },
              { tag: "B", label: "目標色照", desc: "想做的顏色／樣式參考" },
              { tag: "C", label: "呈現方式照", desc: "整體想呈現的感覺" },
            ].map((item) => (
              <div
                key={item.tag}
                className="flex items-start gap-3 p-3.5 rounded-xl bg-[#003D2B]/[0.04]"
              >
                <div className="w-8 h-8 rounded-full bg-[#003D2B] text-[#FFF8F1] flex items-center justify-center text-sm font-bold shrink-0">
                  {item.tag}
                </div>
                <div className="min-w-0">
                  <div className="font-semibold text-[14px] text-[#003D2B]">{item.label}</div>
                  <div className="text-[12px] text-[#003D2B]/55 mt-0.5">{item.desc}</div>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={handleOpenLineChat}
            className="w-full mt-6 h-14 rounded-xl bg-[#003D2B] text-[#FFF8F1] font-bold text-sm tracking-wide active:scale-[0.98] transition-transform"
          >
            打開 LINE 對話
          </button>
          <button
            onClick={() => setConsultationSheetOpen(false)}
            className="w-full mt-2 h-12 rounded-xl text-[#003D2B] font-medium text-sm"
          >
            稍後再說
          </button>
        </div>
      </BottomSheet>
    </div>
  );
}
