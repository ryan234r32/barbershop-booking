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
        className="text-sm text-gray-500 mb-4 flex items-center gap-1"
      >
        ← 返回選擇時段
      </button>

      <h2 className="text-lg font-semibold mb-4">確認預約</h2>

      <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
        <div className="flex justify-between">
          <span className="text-gray-500">服務項目</span>
          <span className="font-medium">{service.name}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">日期</span>
          <span className="font-medium">{displayDate}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">時間</span>
          <span className="font-medium">
            {time} - {endTime}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">預估時長</span>
          <span className="font-medium">{service.duration} 分鐘</span>
        </div>
        <hr className="border-gray-100" />
        <div className="flex justify-between">
          <span className="text-gray-500">費用</span>
          <span className="text-emerald-600 font-semibold text-lg">
            NT${service.price.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Notes */}
      <div className="mt-4">
        <label className="text-sm text-gray-500 block mb-1">備註（選填）</label>
        <textarea
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          placeholder="例如：想要修瀏海、有特殊需求..."
          className="w-full p-3 border border-gray-200 rounded-xl text-sm resize-none h-20 focus:outline-none focus:border-emerald-400"
        />
      </div>

      {/* Cancellation policy */}
      <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-3">
        <p className="text-xs text-amber-700">
          <strong>取消政策：</strong>前一天（含）可免費取消。當天營業時間內取消需致電店家，
          非營業時間可線上取消但會記錄為一次違規。累計 3 次違規將限制線上預約功能。
        </p>
      </div>

      {/* Confirm button */}
      <button
        onClick={onConfirm}
        disabled={submitting}
        className={`
          w-full mt-6 py-3.5 rounded-xl font-semibold text-white transition-all
          ${submitting
            ? "bg-gray-400 cursor-not-allowed"
            : "bg-emerald-500 hover:bg-emerald-600 active:scale-[0.98]"
          }
        `}
      >
        {submitting ? "預約中..." : "確認預約"}
      </button>
    </div>
  );
}
