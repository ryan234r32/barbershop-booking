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

/** V3.7 (5/19) — 服務分類，用於 UI 色彩分組 + upsell 判定。
 *  Key 對應 CATEGORY_META 的 accent 色 / chip 樣式 / section header。 */
export type ServiceCategory = "cut" | "dye" | "perm" | "treatment" | "other";

export function categorizeService(service: { name: string }): ServiceCategory {
  const n = service.name;
  if (n.includes("護髮")) return "treatment";
  if (n.includes("染") || n.includes("漂")) return "dye";
  if (n.includes("燙") || n.includes("矯正")) return "perm";
  if (n.includes("剪") || n.includes("瀏海")) return "cut";
  return "other";
}

/** 分類的視覺中繼資料：accent 色（tile 上方細條 + section header）+ chip 樣式。 */
const CATEGORY_META: Record<
  ServiceCategory,
  { label: string; accent: string; chipBg: string; chipText: string; order: number }
> = {
  cut: {
    label: "剪髮類",
    accent: "#003D2B",
    chipBg: "rgba(0,61,43,0.10)",
    chipText: "#003D2B",
    order: 1,
  },
  dye: {
    label: "染髮類",
    accent: "#7C5BA8",
    chipBg: "rgba(124,91,168,0.12)",
    chipText: "#4F3578",
    order: 2,
  },
  perm: {
    label: "燙髮類",
    accent: "#D97D3A",
    chipBg: "rgba(217,125,58,0.12)",
    chipText: "#8A4416",
    order: 3,
  },
  treatment: {
    label: "護髮",
    accent: "#C9A961",
    chipBg: "rgba(201,169,97,0.14)",
    chipText: "#7A6420",
    order: 4,
  },
  other: {
    label: "其他",
    accent: "#73A891",
    chipBg: "rgba(115,168,145,0.14)",
    chipText: "#2F5E4B",
    order: 5,
  },
};

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
  /** V3.7 (5/19) — 護髮 upsell banner dismissed by user (resets on new selection). */
  const [upsellDismissed, setUpsellDismissed] = useState(false);

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

  /** V3.7 P3 (5/19) — push the photo-request Flex to the customer's LINE
   *  BEFORE closing the LIFF window. Customer lands back in LINE OA with the
   *  Flex waiting, so they immediately know which 3 photos to send. */
  const handleOpenLineChat = async () => {
    if (consultationService && liff) {
      const serviceType: "perm" | "color" | "bleach" = (() => {
        const name = consultationService.name;
        if (name.includes("漂")) return "bleach";
        if (name.includes("燙")) return "perm";
        return "color"; // 補染 / 全頭染 / 挑染刷染 都走 color flex
      })();
      try {
        const idToken = liff.getIDToken?.() || "";
        await fetch("/api/consultations/push-flex", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(idToken ? { "X-LIFF-ID-Token": idToken } : {}),
          },
          body: JSON.stringify({ serviceType }),
        });
      } catch {
        // Non-fatal — customer can still ask via keyword in LINE OA.
      }
    }
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

      {shouldShowTreatmentAddOn && treatmentAddOn && !upsellDismissed && (
        <div
          className="mt-4 rounded-xl p-4 relative"
          style={{
            background: "linear-gradient(135deg, rgba(201,169,97,0.18) 0%, rgba(212,165,71,0.10) 100%)",
            border: "1px solid rgba(201,169,97,0.45)",
            boxShadow: "0 10px 24px rgba(201,169,97,0.08)",
          }}
        >
          <button
            type="button"
            aria-label="關閉建議"
            onClick={() => setUpsellDismissed(true)}
            className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center text-[#7A6420]/70 hover:bg-[#C9A961]/10 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M6 6l12 12M6 18L18 6" />
            </svg>
          </button>
          <div className="flex items-start justify-between gap-3 pr-6">
            <div className="min-w-0">
              <div className="text-[11px] font-bold tracking-[0.14em] uppercase" style={{ color: "#7A6420" }}>
                💧 建議加購
              </div>
              <div className="mt-1 text-[15px] font-bold text-[#003D2B]">
                護髮（NT$ {treatmentAddOn.price.toLocaleString()}）效果更佳
              </div>
              <p className="mt-1 text-[12px] leading-relaxed text-[#003D2B]/65">
                染／燙／漂後加護髮，髮況更穩定、整理後質感更持久。
              </p>
            </div>
            <button
              onClick={() => onToggle(treatmentAddOn)}
              className="shrink-0 whitespace-nowrap rounded-lg px-4 py-2.5 text-[13px] font-bold text-[#FFF8F1] active:scale-[0.98] transition-transform"
              style={{ background: "#C9A961" }}
            >
              加入
            </button>
          </div>
        </div>
      )}

      {/* Service grid — grouped by category (V3.7 5/19) */}
      {(() => {
        // Group while preserving original sort order within each category.
        const groups = new Map<ServiceCategory, Service[]>();
        for (const svc of services) {
          const cat = categorizeService(svc);
          if (!groups.has(cat)) groups.set(cat, []);
          groups.get(cat)!.push(svc);
        }
        const orderedCats = Array.from(groups.keys()).sort(
          (a, b) => CATEGORY_META[a].order - CATEGORY_META[b].order,
        );
        return (
          <div className="mt-6 space-y-6">
            {orderedCats.map((cat) => {
              const meta = CATEGORY_META[cat];
              const list = groups.get(cat)!;
              return (
                <div key={cat}>
                  {/* Category section header — colored chip */}
                  <div className="flex items-center gap-2 mb-3">
                    <span
                      className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold tracking-[0.12em]"
                      style={{ background: meta.chipBg, color: meta.chipText }}
                    >
                      {meta.label}
                    </span>
                    <span
                      className="flex-1 h-px"
                      style={{ background: `${meta.accent}33` }}
                    />
                    <span className="text-[10px] text-[#003D2B]/40 tabular-nums">
                      {list.length} 項
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    {list.map((service) => {
                      const isConsultation = service.bookingMode === "CONSULTATION";
                      const hasVariants =
                        !!service.hasVariants && (service.variants?.length ?? 0) > 0;
                      const isSelected = isServiceSelected(service.id);
                      const isExpanded = expandedServiceId === service.id;

                      return (
                        <div
                          key={service.id}
                          className={hasVariants && isExpanded ? "col-span-2" : ""}
                        >
                          <button
                            onClick={() => handleServiceClick(service)}
                            className={`
                              w-full h-[180px] flex flex-col justify-between p-4 rounded-xl text-left
                              transition-all duration-300 relative overflow-hidden
                              ${
                                isSelected
                                  ? "bg-[#FFF8F1] border-2 border-[#003D2B] shadow-[0_20px_40px_rgba(0,37,25,0.04)]"
                                  : "bg-[#faf2ea] border-2 border-transparent hover:bg-[#eee7df]"
                              }
                            `}
                          >
                            {/* Category accent — thin color rail on top */}
                            <span
                              aria-hidden
                              className="absolute top-0 left-0 right-0 h-[3px]"
                              style={{ background: meta.accent }}
                            />

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
                            <div className="mt-1">
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
                                <span className="text-[13px] font-semibold text-[#003D2B]/70">
                                  需先諮詢
                                </span>
                              ) : hasVariants ? (
                                <>
                                  NT$ {service.price.toLocaleString()}
                                  <span className="text-[11px] font-normal text-[#003D2B]/50 ml-1">
                                    起
                                  </span>
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
                                      <span
                                        className={
                                          selected ? "opacity-80" : "text-[#003D2B]/50"
                                        }
                                      >
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
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* Consultation sheet — guide user back to LINE chat.
          V3.7 (5/19) fix: button always visible as sticky footer; content scrolls above. */}
      <BottomSheet
        isOpen={consultationSheetOpen}
        onClose={() => setConsultationSheetOpen(false)}
        height="85%"
      >
        <div className="relative min-h-full pb-[148px]">
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

          {/* Sticky footer — buttons pinned to bottom of scrollable BottomSheet body */}
          <div
            className="sticky bottom-0 -mx-6 px-6 pt-3 pb-3 bg-[#FFF8F1]"
            style={{ boxShadow: "0 -8px 16px -8px rgba(0,37,25,0.10)" }}
          >
            <button
              onClick={handleOpenLineChat}
              className="w-full h-14 rounded-xl bg-[#003D2B] text-[#FFF8F1] font-bold text-sm tracking-wide active:scale-[0.98] transition-transform"
            >
              打開 LINE 對話
            </button>
            <button
              onClick={() => setConsultationSheetOpen(false)}
              className="w-full mt-1.5 h-10 rounded-xl text-[#003D2B] font-medium text-[13px]"
            >
              稍後再說
            </button>
          </div>
        </div>
      </BottomSheet>
    </div>
  );
}
