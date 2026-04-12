"use client";

interface Service {
  name: string;
  duration: number;
  price: number;
  slotsNeeded: number;
}

export function ConfirmStep({
  service,
  date,
  time,
  notes,
  onNotesChange,
  onConfirm,
  onBack,
  submitting,
}: {
  service: Service;
  date: string;
  time: string;
  notes: string;
  onNotesChange: (v: string) => void;
  onConfirm: () => void;
  onBack: () => void;
  submitting: boolean;
}) {
  const endHour = parseInt(time.split(":")[0]) + service.slotsNeeded;
  const endTime = `${endHour.toString().padStart(2, "0")}:00`;

  // Format date for display
  const dateObj = new Date(date + "T00:00:00+08:00");
  const weekdays = ["日", "一", "二", "三", "四", "五", "六"];
  const displayDate = `${dateObj.getMonth() + 1}/${dateObj.getDate()} (${weekdays[dateObj.getDay()]})`;

  return (
    <div>
      <button
        onClick={onBack}
        className="text-sm text-muted-foreground mb-4 flex items-center gap-1"
      >
        ← 返回選擇時段
      </button>

      <h2 className="text-lg font-semibold mb-4">確認預約</h2>

      <div className="bg-[var(--color-surface)] rounded-lg p-4 space-y-3">
        <div className="flex justify-between">
          <span className="text-muted-foreground">服務項目</span>
          <span className="font-medium">{service.name}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">日期</span>
          <span className="font-medium">{displayDate}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">時間</span>
          <span className="font-medium">
            {time} - {endTime}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">預估時長</span>
          <span className="font-medium">{service.duration} 分鐘</span>
        </div>
        <hr className="border-[var(--color-brand)]/10" />
        <div className="flex justify-between">
          <span className="text-muted-foreground">費用</span>
          <span className="text-[var(--color-brand)] font-semibold text-lg">
            NT${service.price.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Notes */}
      <div className="mt-4">
        <label className="text-sm text-muted-foreground block mb-1">備註（選填）</label>
        <textarea
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          placeholder="例如：想要修瀏海、有特殊需求..."
          className="w-full p-3 border-b-2 border-[var(--color-brand)]/20 bg-transparent text-sm resize-none h-20 focus:outline-none focus:border-[var(--color-brand)]"
        />
      </div>

      {/* Cancellation policy */}
      <div className="mt-4 bg-[var(--color-warning)]/10 border-l-4 border-[var(--color-warning)] rounded-r-lg p-3">
        <p className="text-xs text-[var(--color-warning)]">
          <strong>取消政策：</strong>前一天（含）可免費取消。當天營業時間內取消需致電店家，
          非營業時間可線上取消但會記錄為一次違規。累計 3 次違規將限制線上預約功能。
        </p>
      </div>

      {/* Confirm button */}
      <button
        onClick={onConfirm}
        disabled={submitting}
        className={`
          w-full mt-6 py-3.5 rounded-lg font-semibold transition-all
          ${submitting
            ? "bg-[var(--color-surface)] text-muted-foreground cursor-not-allowed"
            : "bg-[var(--color-brand)] text-[var(--color-bg)] hover:opacity-90 active:scale-[0.98]"
          }
        `}
      >
        {submitting ? "預約中..." : "確認預約"}
      </button>
    </div>
  );
}
