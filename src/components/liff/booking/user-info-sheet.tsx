"use client";

import { useState, useEffect } from "react";
import { BottomSheet } from "@/components/liff/bottom-sheet";

interface UserInfoData {
  name: string;
  phone: string;
  birthday?: string; // "MM-DD" format
}

export function UserInfoSheet({
  isOpen,
  onClose,
  onSubmit,
  defaultName,
  defaultPhone,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: UserInfoData) => void;
  defaultName?: string;
  defaultPhone?: string;
}) {
  const [name, setName] = useState(defaultName || "");
  const [phone, setPhone] = useState(defaultPhone || "");
  const [birthdayMonth, setBirthdayMonth] = useState("");
  const [birthdayDay, setBirthdayDay] = useState("");
  const [errors, setErrors] = useState<{ name?: string; phone?: string }>({});

  // Sync defaults when they change (e.g. after LIFF init loads)
  useEffect(() => {
    if (defaultName && !name) setName(defaultName);
  }, [defaultName]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (defaultPhone && !phone) setPhone(defaultPhone);
  }, [defaultPhone]); // eslint-disable-line react-hooks/exhaustive-deps

  const validate = (): boolean => {
    const newErrors: { name?: string; phone?: string } = {};

    if (!name.trim()) {
      newErrors.name = "請輸入姓名";
    }

    if (!phone.trim()) {
      newErrors.phone = "請輸入電話";
    } else if (!/^09\d{8}$/.test(phone.trim())) {
      newErrors.phone = "請輸入有效的手機號碼（09 開頭，共 10 碼）";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;

    const data: UserInfoData = {
      name: name.trim(),
      phone: phone.trim(),
    };

    // Only include birthday if both month and day are selected
    if (birthdayMonth && birthdayDay) {
      data.birthday = `${birthdayMonth.padStart(2, "0")}-${birthdayDay.padStart(2, "0")}`;
    }

    onSubmit(data);
  };

  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const daysInMonth = birthdayMonth
    ? new Date(2000, parseInt(birthdayMonth), 0).getDate()
    : 31;
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} height="85%">
      <div>
        {/* Title */}
        <h3 className="text-2xl font-bold text-[#003D2B] tracking-tight mb-2">
          請留下你的資料
        </h3>
        <p className="text-[#003D2B]/50 text-sm leading-relaxed">
          方便我們聯絡你，下次就不用再填了
        </p>

        {/* Form */}
        <div className="space-y-6 mt-6">
          {/* Name */}
          <div>
            <label className="text-[0.7rem] font-bold tracking-[0.1em] uppercase text-[#003D2B]/40 mb-1 block">
              姓名 *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
              }}
              placeholder="請輸入真實姓名"
              className="w-full bg-transparent border-0 border-b border-[#003D2B] py-2 px-0 text-[#003D2B] placeholder-[#003D2B]/20 focus:ring-0 focus:outline-none text-base font-body"
            />
            {errors.name && (
              <span className="text-xs text-[#A84A3B] mt-1 block">{errors.name}</span>
            )}
          </div>

          {/* Phone */}
          <div>
            <label className="text-[0.7rem] font-bold tracking-[0.1em] uppercase text-[#003D2B]/40 mb-1 block">
              電話 *
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value);
                if (errors.phone) setErrors((prev) => ({ ...prev, phone: undefined }));
              }}
              placeholder="09xxxxxxxx"
              className="w-full bg-transparent border-0 border-b border-[#003D2B] py-2 px-0 text-[#003D2B] placeholder-[#003D2B]/20 focus:ring-0 focus:outline-none text-base font-body"
            />
            {errors.phone && (
              <span className="text-xs text-[#A84A3B] mt-1 block">{errors.phone}</span>
            )}
          </div>

          {/* Birthday (optional) */}
          <div>
            <label className="text-[0.7rem] font-bold tracking-[0.1em] uppercase text-[#003D2B]/40 mb-1 block">
              生日（選填）
            </label>
            <div className="flex gap-3">
              <select
                value={birthdayMonth}
                onChange={(e) => {
                  setBirthdayMonth(e.target.value);
                  // Reset day if it exceeds new month's max
                  const newMax = e.target.value
                    ? new Date(2000, parseInt(e.target.value), 0).getDate()
                    : 31;
                  if (parseInt(birthdayDay) > newMax) setBirthdayDay("");
                }}
                className="flex-1 bg-[#faf2ea] border-0 rounded-lg py-2.5 px-3 text-sm text-[#003D2B] focus:ring-1 focus:ring-[#003D2B]"
              >
                <option value="">月</option>
                {months.map((m) => (
                  <option key={m} value={String(m)}>
                    {m} 月
                  </option>
                ))}
              </select>
              <select
                value={birthdayDay}
                onChange={(e) => setBirthdayDay(e.target.value)}
                className="flex-1 bg-[#faf2ea] border-0 rounded-lg py-2.5 px-3 text-sm text-[#003D2B] focus:ring-1 focus:ring-[#003D2B]"
              >
                <option value="">日</option>
                {days.map((d) => (
                  <option key={d} value={String(d)}>
                    {d} 日
                  </option>
                ))}
              </select>
            </div>
            <p className="text-[10px] text-[#003D2B]/40 mt-1.5">
              生日月來店有小驚喜
            </p>
          </div>
        </div>

        {/* Submit button */}
        <div className="pt-4 mt-4">
          <button
            onClick={handleSubmit}
            className="w-full h-14 bg-[#003D2B] text-[#FFF8F1] rounded-xl font-bold text-sm tracking-widest uppercase transition-colors hover:bg-[#003D2B]/90"
          >
            確認並完成預約
          </button>
        </div>

        {/* Footer */}
        <p className="mt-4 text-center text-[0.6rem] text-[#003D2B]/30 uppercase tracking-[0.2em]">
          1008 Hair Studio · Data Privacy Secured
        </p>
      </div>
    </BottomSheet>
  );
}
