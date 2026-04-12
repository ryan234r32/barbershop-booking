"use client";

interface Service {
  name: string;
  duration: number;
  price: number;
  slotsNeeded: number;
}

export function ConfirmStep({
  notes,
  onNotesChange,
  onShowCancelPolicy,
}: {
  service: Service;
  date: string;
  time: string;
  notes: string;
  onNotesChange: (v: string) => void;
  onConfirm: () => void;
  onBack: () => void;
  submitting: boolean;
  onShowCancelPolicy: () => void;
}) {
  return (
    <div>
      {/* Step label */}
      <span className="font-headline text-[10px] tracking-[0.15em] font-semibold text-[#003D2B]/60 uppercase">
        STEP 03
      </span>

      {/* Title */}
      <h2 className="font-headline font-bold text-[2rem] text-[#003D2B] mt-2 mb-8">
        備註（選填）
      </h2>

      {/* Notes textarea — underline-only style */}
      <textarea
        value={notes}
        onChange={(e) => onNotesChange(e.target.value)}
        placeholder="想告訴設計師什麼嗎？"
        className="w-full bg-transparent border-t-0 border-l-0 border-r-0 border-b-[1.5px] border-[#003D2B]/20 focus:ring-0 focus:outline-none focus:border-[#003D2B] px-0 py-2 text-sm text-[#003D2B] placeholder:text-[#003D2B]/30 min-h-[40px] resize-none font-body"
      />

      {/* Cancel policy link */}
      <button
        onClick={onShowCancelPolicy}
        className="mt-8 text-xs font-bold text-[#003D2B] underline underline-offset-4 decoration-[#003D2B]/30 block"
      >
        查看取消政策
      </button>
    </div>
  );
}
