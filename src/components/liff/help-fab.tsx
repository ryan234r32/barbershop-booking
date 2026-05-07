"use client";

import { useState } from "react";
import { BottomSheet } from "./bottom-sheet";
import { IconChevronRight } from "./icons";

interface FaqItem {
  q: string;
  a: string;
}

const FAQ: FaqItem[] = [
  {
    q: "怎麼取消預約？",
    a: "點下方選單「我的預約」→ 找到該筆預約 → 點「取消」。前一天以前線上免費取消；當天請打電話告知店家，不算違規。",
  },
  {
    q: "怎麼改期？",
    a: "點下方選單「我的預約」→ 找到該筆預約 → 點「改期」→ 重新選日期時間。改期不算取消，原本的轉帳金額會保留。",
  },
  {
    q: "預約後要怎麼匯款？",
    a: "預約成功後會收到 LINE 訊息附上匯款帳號；下方選單「匯款資訊」也有完整資訊。請於 24 小時內完成匯款，並把後五碼回傳到聊天室。",
  },
  {
    q: "沒收到 LINE 提醒訊息？",
    a: "請確認沒有把店家設為靜音、且 LINE 通知開啟。如果還是沒收到，請直接打店家電話確認預約。",
  },
  {
    q: "違規 3 次會怎樣？",
    a: "未到（No-show）算違規 1 次；當天打電話取消不算。累積 3 次違規後，下個月只能改用電話預約，無法線上預約。隔月自動恢復。",
  },
  {
    q: "預約失敗（時段衝突）怎麼辦？",
    a: "代表剛好被別的客人搶先預約走了，請重新選擇其他時段。系統會即時更新可預約時段。",
  },
];

function FaqRow({ item, isOpen, onToggle }: { item: FaqItem; isOpen: boolean; onToggle: () => void }) {
  return (
    <div className="border-b border-[#003D2B]/10 last:border-b-0">
      <button
        type="button"
        onClick={onToggle}
        className="w-full py-4 flex items-center justify-between gap-3 text-left"
      >
        <span className="text-sm font-semibold text-[#003D2B] leading-snug">
          {item.q}
        </span>
        <IconChevronRight
          className={`w-4 h-4 shrink-0 text-[#003D2B]/50 transition-transform duration-200 ${
            isOpen ? "rotate-90" : ""
          }`}
        />
      </button>
      {isOpen && (
        <p className="pb-4 text-sm leading-relaxed text-[#2D3A30]">
          {item.a}
        </p>
      )}
    </div>
  );
}

export function HelpFab() {
  const [open, setOpen] = useState(false);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-24 right-4 z-40 w-12 h-12 rounded-full bg-[#003D2B] text-[#FFF8F1] flex items-center justify-center font-bold text-lg active:scale-95 transition-transform"
        style={{ boxShadow: "0 1px 3px rgba(0, 61, 43, 0.15)" }}
        aria-label="常見問題"
      >
        ?
      </button>

      <BottomSheet isOpen={open} onClose={() => setOpen(false)} height="85%">
        <div>
          <p className="text-[0.7rem] font-medium tracking-[0.15em] uppercase text-[#003D2B]/50">
            HELP CENTER
          </p>
          <h3 className="mt-1 text-2xl font-bold tracking-[0.03em] text-[#003D2B]">
            常見問題
          </h3>
          <p className="mt-2 text-sm text-[#003D2B]/60 leading-relaxed">
            找不到的問題？點下方「聯絡店家」直接打電話給老闆。
          </p>

          <div className="mt-6">
            {FAQ.map((item, i) => (
              <FaqRow
                key={i}
                item={item}
                isOpen={expandedIdx === i}
                onToggle={() => setExpandedIdx(expandedIdx === i ? null : i)}
              />
            ))}
          </div>

          <a
            href="tel:02-2396-2306"
            className="mt-6 mb-2 w-full h-12 rounded-md border border-[#003D2B]/20 text-[#003D2B] font-semibold text-sm tracking-[0.05em] flex items-center justify-center active:bg-[#003D2B]/5 transition-colors"
          >
            還是找不到？打電話聯絡店家
          </a>
        </div>
      </BottomSheet>
    </>
  );
}
