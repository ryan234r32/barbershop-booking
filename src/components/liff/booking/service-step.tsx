"use client";

interface Service {
  id: string;
  name: string;
  description: string | null;
  duration: number;
  slotsNeeded: number;
  price: number;
}

export function ServiceStep({
  services,
  selectedService,
  onSelect,
}: {
  services: Service[];
  selectedService: Service | null;
  onSelect: (service: Service) => void;
}) {
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

      {/* Service grid */}
      <div className="grid grid-cols-2 gap-4 mt-8">
        {services.map((service) => {
          const isSelected = selectedService?.id === service.id;

          return (
            <button
              key={service.id}
              onClick={() => onSelect(service)}
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
                  <span
                    className="material-symbols-outlined text-[#FFF8F1]"
                    style={{ fontSize: 14, fontVariationSettings: "'wght' 700" }}
                  >
                    check
                  </span>
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
