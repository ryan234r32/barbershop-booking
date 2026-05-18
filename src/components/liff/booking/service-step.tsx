"use client";

import { IconCheck } from "@/components/liff/icons";

interface Service {
  id: string;
  name: string;
  description: string | null;
  duration: number;
  slotsNeeded: number;
  price: number;
}

/**
 * V3.7 Tier 0.2 — 服務多選。客戶可一次選 剪+染+護 等組合；點 tile 切換選取。
 * 上方 sticky summary 顯示已選數量、總時數、總價，無選取時為 prompt。
 */
export function ServiceStep({
  services,
  selectedServices,
  onToggle,
}: {
  services: Service[];
  selectedServices: Service[];
  onToggle: (service: Service) => void;
}) {
  const totalDuration = selectedServices.reduce((sum, s) => sum + s.duration, 0);
  const totalPrice = selectedServices.reduce((sum, s) => sum + s.price, 0);
  const hasSelection = selectedServices.length > 0;

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

      {/* Summary band — sticky-feel, brand bg when selected, muted when empty */}
      <div
        className={`mt-5 rounded-xl px-4 py-3 transition-colors ${
          hasSelection ? "bg-[#003D2B] text-[#FFF8F1]" : "bg-[#003D2B]/[0.05] text-[#003D2B]/55"
        }`}
      >
        {hasSelection ? (
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[11px] tracking-wider uppercase opacity-70">已選 {selectedServices.length} 項</div>
              <div className="text-[13px] font-medium truncate">
                {selectedServices.map((s) => s.name).join(" + ")}
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

      {/* Service grid */}
      <div className="grid grid-cols-2 gap-4 mt-6">
        {services.map((service) => {
          const isSelected = selectedServices.some((s) => s.id === service.id);

          return (
            <button
              key={service.id}
              onClick={() => onToggle(service)}
              className={`
                h-[180px] flex flex-col justify-between p-4 rounded-xl text-left
                transition-all duration-300 relative
                ${
                  isSelected
                    ? "bg-[#FFF8F1] border-2 border-[#003D2B] shadow-[0_20px_40px_rgba(0,37,25,0.04)]"
                    : "bg-[#faf2ea] border-2 border-transparent hover:bg-[#eee7df]"
                }
              `}
            >
              {/* Selected checkmark */}
              {isSelected && (
                <div className="absolute top-3 right-3 w-5 h-5 bg-[#003D2B] rounded-full flex items-center justify-center">
                  <IconCheck className="w-3.5 h-3.5 text-white" />
                </div>
              )}

              {/* Top: name + duration */}
              <div>
                <span className="text-[#003D2B] font-semibold text-base block">
                  {service.name}
                </span>
                <span className="text-[#73A891] text-xs block mt-1">
                  約 {service.duration} 分鐘
                </span>
              </div>

              {/* Bottom: price */}
              <span className="text-[#003D2B] font-bold text-lg">
                NT$ {service.price.toLocaleString()}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
