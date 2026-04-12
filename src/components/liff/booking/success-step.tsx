"use client";

import { useLiff } from "@/lib/liff/provider";

/** Build Google Calendar event URL */
function buildGoogleCalendarUrl(
  serviceName: string,
  date: string,
  startTime: string,
  endTime: string
): string {
  // date format: "YYYY-MM-DD", time format: "HH:00"
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
}

export function SuccessStep({
  bookingId,
  service,
  date,
  time,
}: {
  bookingId: string;
  service: Service;
  date: string;
  time: string;
}) {
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
    <div className="text-center py-8">
      <div className="w-16 h-16 bg-[var(--color-success)]/15 rounded-full flex items-center justify-center mx-auto mb-4">
        <svg
          className="w-8 h-8 text-[var(--color-success)]"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>

      <h2 className="text-xl font-semibold text-[var(--color-brand)] mb-1">預約成功！</h2>
      <p className="text-muted-foreground text-sm mb-6">我們已發送確認訊息到您的 LINE</p>

      <div className="bg-[var(--color-surface)] rounded-lg p-4 text-left space-y-2 mb-6">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">服務</span>
          <span className="font-medium">{service.name}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">日期</span>
          <span className="font-medium">{displayDate}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">時間</span>
          <span className="font-medium">
            {time} - {endTime}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">預約編號</span>
          <span className="font-mono text-xs text-muted-foreground">
            {bookingId.slice(0, 8)}
          </span>
        </div>
      </div>

      <div className="space-y-3">
        <a
          href={buildGoogleCalendarUrl(service.name, date, time, endTime)}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full py-3 border border-[var(--color-brand)] text-[var(--color-brand)] rounded-lg font-medium hover:bg-secondary transition-colors text-center"
        >
          加入行事曆
        </a>
        <a
          href="/my-bookings"
          className="block w-full py-3 bg-[var(--color-brand)] text-[var(--color-bg)] rounded-lg font-medium hover:opacity-90 transition-colors text-center"
        >
          查看我的預約
        </a>
        <button
          onClick={handleClose}
          className="block w-full py-3 bg-secondary text-foreground rounded-lg font-medium hover:bg-[var(--color-surface)] transition-colors"
        >
          關閉
        </button>
      </div>
    </div>
  );
}
