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
        className="text-sm text-muted-foreground mb-4 flex items-center gap-1"
      >
        ← 返回選擇日期
      </button>

      <h2 className="text-lg font-semibold mb-4">選擇時段</h2>

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="w-6 h-6 border-2 border-[var(--color-brand)] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : availableSlots.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-muted-foreground">這天沒有可用的時段</p>
          <button
            onClick={onBack}
            className="mt-4 text-[var(--color-brand)] text-sm font-medium"
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
                py-3 px-2 rounded-lg text-center transition-all
                ${!slot.available
                  ? "bg-[var(--color-surface)] text-muted-foreground/40 cursor-not-allowed"
                  : selectedTime === slot.time
                  ? "bg-[var(--color-brand)] text-[var(--color-bg)]"
                  : slot.recommended
                  ? "bg-[var(--color-bg)] text-[var(--color-brand)] border-2 border-[var(--color-brand)] hover:bg-secondary"
                  : "bg-[var(--color-bg)] border border-[var(--color-brand)]/20 text-foreground hover:border-[var(--color-brand)]"
                }
              `}
            >
              <span className="text-sm font-medium">{slot.time}</span>
              {slot.recommended && slot.available && selectedTime !== slot.time && (
                <span className="block text-[10px] mt-0.5 text-[var(--color-brand)]">推薦</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
