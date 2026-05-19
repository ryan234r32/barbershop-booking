"use client";

import { useLiff } from "@/lib/liff/provider";

/** Build Google Calendar event URL */
function buildGoogleCalendarUrl(
  serviceName: string,
  date: string,
  startTime: string,
  endTime: string
): string {
  const startDT = `${date.replace(/-/g, "")}T${startTime.replace(":", "")}00`;
  const endDT = `${date.replace(/-/g, "")}T${endTime.replace(":", "")}00`;
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `${serviceName} — 1008 Hair Studio`,
    dates: `${startDT}/${endDT}`,
    location: "台北市中正區新生南路一段144-10號",
    details: "1008 Hair Studio 預約",
    ctz: "Asia/Taipei",
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

interface Service {
  name: string;
  slotsNeeded: number;
  price: number;
}

export function SuccessStep({
  service,
  services,
  date,
  time,
}: {
  bookingId: string;
  service: Service;
  /** V3.7 P3 — chip-list view when present (multi-service or variant). */
  services?: Array<{ name: string; variantName?: string; price: number }>;
  date: string;
  time: string;
}) {
  const useChipList =
    !!services && services.length > 0 && (services.length > 1 || services.some((s) => s.variantName));
  const { liff } = useLiff();
  const endHour = parseInt(time.split(":")[0]) + service.slotsNeeded;
  const endTime = `${endHour.toString().padStart(2, "0")}:00`;

  const dateObj = new Date(date + "T00:00:00+08:00");
  const weekdays = ["日", "一", "二", "三", "四", "五", "六"];
  const displayDate = `${dateObj.getMonth() + 1}/${dateObj.getDate()} (${weekdays[dateObj.getDay()]})`;

  const handleClose = () => {
    if (liff) {
      liff.closeWindow();
    }
  };

  return (
    <div className="flex flex-col items-center pt-48 pb-16 animate-fadeIn">
      {/* Botanical SVG with checkmark */}
      <svg
        className="w-24 h-24"
        viewBox="0 0 100 100"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
        stroke="#003D2B"
      >
        <path
          d="M50 90C50 90 20 65 20 40C20 25 35 15 50 35C65 15 80 25 80 40C80 65 50 90 50 90Z"
          fill="#003D2B"
          fillOpacity="0.05"
          opacity="0.1"
        />
        <path d="M50 90V40M50 40C50 40 70 30 85 45M50 55C50 55 30 45 15 60M50 70C50 70 65 65 75 75" />
        <circle cx="50" cy="50" r="18" strokeWidth="1.5" fill="#FFF8F1" stroke="#003D2B" />
        <path d="M44 50L48 54L56 46" strokeWidth="2" stroke="#003D2B" />
      </svg>

      {/* Title */}
      <h2 className="text-3xl font-bold text-[#003D2B] tracking-tight mt-6">
        預約成功
      </h2>
      <p className="text-[#003D2B]/50 font-medium text-sm mt-2">
        確認訊息已發送到你的 LINE
      </p>

      {/* Summary card */}
      <div className="bg-[#f4ede5] rounded-xl p-6 flex flex-col gap-4 w-full mt-8">
        {/* Top section: service(s) + total price */}
        {useChipList && services ? (
          <div className="pb-4 border-b border-[#003D2B]/10">
            <div className="flex items-start justify-between">
              <span className="text-xs font-bold tracking-widest text-[#003D2B]/40 uppercase block">
                SERVICE
              </span>
              <div className="text-right">
                <span className="text-xs font-bold tracking-widest text-[#003D2B]/40 uppercase mb-1 block">
                  PRICE
                </span>
                <span className="text-[#003D2B] font-semibold">
                  NT$ {service.price.toLocaleString()}
                </span>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
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
          </div>
        ) : (
          <div className="flex justify-between items-start pb-4 border-b border-[#003D2B]/10">
            <div>
              <span className="text-xs font-bold tracking-widest text-[#003D2B]/40 uppercase mb-1 block">
                SERVICE
              </span>
              <span className="text-[#003D2B] font-semibold">{service.name}</span>
            </div>
            <div className="text-right">
              <span className="text-xs font-bold tracking-widest text-[#003D2B]/40 uppercase mb-1 block">
                PRICE
              </span>
              <span className="text-[#003D2B] font-semibold">
                NT$ {service.price.toLocaleString()}
              </span>
            </div>
          </div>
        )}

        {/* Bottom row: date + time */}
        <div className="flex justify-between items-start">
          <div>
            <span className="text-xs font-bold tracking-widest text-[#003D2B]/40 uppercase mb-1 block">
              DATE
            </span>
            <span className="text-[#003D2B] font-medium">{displayDate}</span>
          </div>
          <div className="text-right">
            <span className="text-xs font-bold tracking-widest text-[#003D2B]/40 uppercase mb-1 block">
              TIME
            </span>
            <span className="text-[#003D2B] font-medium">
              {time} — {endTime}
            </span>
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex flex-col gap-3 w-full mt-8">
        <a
          href={buildGoogleCalendarUrl(service.name, date, time, endTime)}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full border-[1.5px] border-[#003D2B] text-[#003D2B] rounded-xl font-semibold text-sm py-4 text-center transition-colors hover:bg-[#003D2B]/5"
        >
          加入 Google 行事曆
        </a>
        <a
          href="/my-bookings"
          className="block w-full border-[1.5px] border-[#003D2B] text-[#003D2B] rounded-xl font-semibold text-sm py-4 text-center transition-colors hover:bg-[#003D2B]/5"
        >
          查看我的預約
        </a>
        <button
          onClick={handleClose}
          className="w-full bg-[#003D2B] text-[#FFF8F1] rounded-xl font-semibold text-sm py-4 shadow-lg shadow-[#003D2B]/20 transition-colors hover:bg-[#003D2B]/90"
        >
          關閉
        </button>
      </div>
    </div>
  );
}
