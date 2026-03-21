"use client";

interface AvailableSlot {
  time: string;
  available: boolean;
  recommended: boolean;
}

export function TimeStep({
  slots,
  loading,
  selectedTime,
  onSelect,
  onBack,
}: {
  slots: AvailableSlot[];
  loading: boolean;
  selectedTime: string;
  onSelect: (time: string) => void;
  onBack: () => void;
}) {
  const availableSlots = slots.filter((s) => s.available);

  return (
    <div>
      <button
        onClick={onBack}
        className="text-sm text-gray-500 mb-4 flex items-center gap-1"
      >
        ← 返回選擇日期
      </button>

      <h2 className="text-lg font-semibold mb-4">選擇時段</h2>

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : availableSlots.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-500">這天沒有可用的時段</p>
          <button
            onClick={onBack}
            className="mt-4 text-emerald-600 text-sm font-medium"
          >
            選擇其他日期
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          {slots.map((slot) => (
            <button
              key={slot.time}
              disabled={!slot.available}
              onClick={() => onSelect(slot.time)}
              className={`
                py-3 px-2 rounded-xl text-center transition-all
                ${!slot.available
                  ? "bg-gray-100 text-gray-300 cursor-not-allowed"
                  : selectedTime === slot.time
                  ? "bg-emerald-500 text-white shadow-sm"
                  : slot.recommended
                  ? "bg-emerald-50 text-emerald-700 border-2 border-emerald-300 hover:bg-emerald-100"
                  : "bg-white border border-gray-200 text-gray-700 hover:border-emerald-400"
                }
              `}
            >
              <span className="text-sm font-medium">{slot.time}</span>
              {slot.recommended && slot.available && selectedTime !== slot.time && (
                <span className="block text-[10px] mt-0.5 text-emerald-500">推薦</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
