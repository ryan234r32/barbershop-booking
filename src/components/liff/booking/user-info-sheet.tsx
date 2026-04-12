"use client";

import { useState } from "react";
import { BottomSheet } from "@/components/liff/bottom-sheet";

export function UserInfoSheet({
  isOpen,
  onClose,
  onSubmit,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { name: string; phone: string; gender: "male" | "female" }) => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [gender, setGender] = useState<"male" | "female">("male");
  const [errors, setErrors] = useState<{ name?: string; phone?: string }>({});

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
    if (validate()) {
      onSubmit({ name: name.trim(), phone: phone.trim(), gender });
    }
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} height="60%">
      <div>
        {/* Title */}
        <h3 className="text-2xl font-bold text-[#003D2B] tracking-tight mb-2">
          請留下你的資料
        </h3>
        <p className="text-[#003D2B]/50 text-sm leading-relaxed">
          方便我們聯絡你，下次就不用再填了
        </p>

        {/* Form */}
        <div className="space-y-8 mt-8">
          {/* Name */}
          <div>
            <label className="text-[0.7rem] font-bold tracking-[0.1em] uppercase text-[#003D2B]/40 mb-1 block">
              姓名
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
              電話
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

          {/* Gender */}
          <div>
            <label className="text-[0.7rem] font-bold tracking-[0.1em] uppercase text-[#003D2B]/40 mb-1 block">
              性別
            </label>
            <div className="flex gap-4 mt-1">
              <button
                type="button"
                onClick={() => setGender("male")}
                className={`
                  flex-1 flex items-center justify-between px-4 py-3 bg-[#faf2ea] rounded-lg cursor-pointer transition-all duration-200
                  ${gender === "male" ? "border-[1.5px] border-[#003D2B]" : "border-[1.5px] border-transparent"}
                `}
              >
                <span className="text-[#003D2B] font-medium">男</span>
                <span
                  className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${
                    gender === "male"
                      ? "border-[#003D2B] bg-[#003D2B]"
                      : "border-[#003D2B]/30"
                  }`}
                >
                  {gender === "male" && (
                    <span className="w-1.5 h-1.5 bg-white rounded-full" />
                  )}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setGender("female")}
                className={`
                  flex-1 flex items-center justify-between px-4 py-3 bg-[#faf2ea] rounded-lg cursor-pointer transition-all duration-200
                  ${gender === "female" ? "border-[1.5px] border-[#003D2B]" : "border-[1.5px] border-transparent"}
                `}
              >
                <span className="text-[#003D2B] font-medium">女</span>
                <span
                  className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${
                    gender === "female"
                      ? "border-[#003D2B] bg-[#003D2B]"
                      : "border-[#003D2B]/30"
                  }`}
                >
                  {gender === "female" && (
                    <span className="w-1.5 h-1.5 bg-white rounded-full" />
                  )}
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Buttons */}
        <div className="pt-4 flex flex-col gap-3 mt-4">
          <button
            onClick={handleSubmit}
            className="w-full h-14 bg-[#003D2B] text-[#FFF8F1] rounded-xl font-bold text-sm tracking-widest uppercase transition-colors hover:bg-[#003D2B]/90"
          >
            確認並完成預約
          </button>
          <button
            onClick={onClose}
            className="w-full h-14 bg-transparent border-[1.5px] border-[#003D2B] text-[#003D2B] rounded-xl font-bold text-sm tracking-widest uppercase transition-colors hover:bg-[#003D2B]/5"
          >
            取消
          </button>
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-[0.6rem] text-[#003D2B]/30 uppercase tracking-[0.2em]">
          1008 Hair Studio · Data Privacy Secured
        </p>
      </div>
    </BottomSheet>
  );
}
