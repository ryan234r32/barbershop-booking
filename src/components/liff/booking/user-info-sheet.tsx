"use client";

import { useState, useEffect } from "react";
import { BottomSheet } from "@/components/liff/bottom-sheet";

type Gender = "MALE" | "FEMALE" | "PREFER_NOT_TO_SAY";

interface UserInfoData {
  name: string;
  phone: string;
  birthday?: string; // "YYYY-MM-DD" format
  gender?: Gender;
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
  const [gender, setGender] = useState<Gender | "">("");
  const [birthdayYear, setBirthdayYear] = useState(""); // 民國年
  const [birthdayMonth, setBirthdayMonth] = useState("");
  const [birthdayDay, setBirthdayDay] = useState("");
  const [errors, setErrors] = useState<{ name?: string; phone?: string; birthday?: string }>({});

  // Sync defaults when they change (e.g. after LIFF init loads async).
  // setState-in-effect is the correct pattern here because the source is an
  // async external event (LIFF profile fetch) rather than a derivable value.
  /* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
  useEffect(() => {
    if (defaultName && !name) setName(defaultName);
  }, [defaultName]);

  useEffect(() => {
    if (defaultPhone && !phone) setPhone(defaultPhone);
  }, [defaultPhone]);
  /* eslint-enable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

  const validate = (): boolean => {
    const newErrors: { name?: string; phone?: string; birthday?: string } = {};

    if (!name.trim()) {
      newErrors.name = "請輸入姓名";
    }

    if (!phone.trim()) {
      newErrors.phone = "請輸入電話";
    } else if (!/^09\d{8}$/.test(phone.trim())) {
      newErrors.phone = "請輸入有效的手機號碼（09 開頭，共 10 碼）";
    }

    if (!birthdayYear || !birthdayMonth || !birthdayDay) {
      newErrors.birthday = "請選擇完整的出生年月日";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;

    const westernYear = parseInt(birthdayYear) + 1911;
    const data: UserInfoData = {
      name: name.trim(),
      phone: phone.trim(),
      birthday: `${westernYear}-${birthdayMonth.padStart(2, "0")}-${birthdayDay.padStart(2, "0")}`,
      ...(gender ? { gender } : {}),
    };

    onSubmit(data);
  };

  // 民國年 40~113（西元 1951~2024），涵蓋大部分客群
  const currentRocYear = new Date().getFullYear() - 1911;
  const years = Array.from({ length: currentRocYear - 40 + 1 }, (_, i) => currentRocYear - i);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const westernYear = birthdayYear ? parseInt(birthdayYear) + 1911 : 2000;
  const daysInMonth = birthdayMonth
    ? new Date(westernYear, parseInt(birthdayMonth), 0).getDate()
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

          {/* Gender — 選填，三選一 */}
          <div>
            <label className="text-[0.7rem] font-bold tracking-[0.1em] uppercase text-[#003D2B]/40 mb-1 block">
              性別（選填）
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { value: "MALE", label: "生理男" },
                  { value: "FEMALE", label: "生理女" },
                  { value: "PREFER_NOT_TO_SAY", label: "略" },
                ] as const
              ).map((opt) => {
                const active = gender === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setGender(active ? "" : opt.value)}
                    className={`h-10 rounded-lg text-sm font-medium transition-colors ${
                      active
                        ? "bg-[#003D2B] text-[#FFF8F1]"
                        : "bg-[#faf2ea] text-[#003D2B]/70 hover:bg-[#003D2B]/5"
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Birthday — 民國年月日 */}
          <div>
            <label className="text-[0.7rem] font-bold tracking-[0.1em] uppercase text-[#003D2B]/40 mb-1 block">
              生日 *
            </label>
            <div className="flex gap-2">
              <select
                value={birthdayYear}
                onChange={(e) => setBirthdayYear(e.target.value)}
                className="flex-[1.2] bg-[#faf2ea] border-0 rounded-lg py-2.5 px-2 text-sm text-[#003D2B] focus:ring-1 focus:ring-[#003D2B]"
              >
                <option value="">民國年</option>
                {years.map((y) => (
                  <option key={y} value={String(y)}>
                    {y} 年
                  </option>
                ))}
              </select>
              <select
                value={birthdayMonth}
                onChange={(e) => {
                  setBirthdayMonth(e.target.value);
                  const yr = birthdayYear ? parseInt(birthdayYear) + 1911 : 2000;
                  const newMax = e.target.value
                    ? new Date(yr, parseInt(e.target.value), 0).getDate()
                    : 31;
                  if (parseInt(birthdayDay) > newMax) setBirthdayDay("");
                }}
                className="flex-1 bg-[#faf2ea] border-0 rounded-lg py-2.5 px-2 text-sm text-[#003D2B] focus:ring-1 focus:ring-[#003D2B]"
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
                className="flex-1 bg-[#faf2ea] border-0 rounded-lg py-2.5 px-2 text-sm text-[#003D2B] focus:ring-1 focus:ring-[#003D2B]"
              >
                <option value="">日</option>
                {days.map((d) => (
                  <option key={d} value={String(d)}>
                    {d} 日
                  </option>
                ))}
              </select>
            </div>
            {errors.birthday ? (
              <span className="text-xs text-[#A84A3B] mt-1.5 block">{errors.birthday}</span>
            ) : (
              <p className="text-[10px] text-[#003D2B]/40 mt-1.5">
                生日月來店有小驚喜
              </p>
            )}
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
