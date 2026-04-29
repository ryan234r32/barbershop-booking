"use client";

import { useState, useEffect, useRef, FormEvent } from "react";
import { useLiff } from "@/lib/liff/provider";

type Gender = "MALE" | "FEMALE" | "OTHER" | "PREFER_NOT_TO_SAY";

interface Status {
  state: "idle" | "submitting" | "success" | "error";
  message?: string;
  mergedCount?: number;
}

const GENDER_OPTIONS: { value: Gender; label: string }[] = [
  { value: "MALE", label: "男" },
  { value: "FEMALE", label: "女" },
  { value: "OTHER", label: "其他" },
  { value: "PREFER_NOT_TO_SAY", label: "不便提供" },
];

export default function ProfilePage() {
  const { isReady, liff, cachedIdToken, displayName, phone: liffPhone, birthday: liffBirthday, realName: liffRealName } = useLiff();

  const [phone, setPhone] = useState("");
  const [birthday, setBirthday] = useState("");
  const [gender, setGender] = useState<Gender | "">("");
  const [realName, setRealName] = useState("");
  const [legacyName, setLegacyName] = useState("");
  const [status, setStatus] = useState<Status>({ state: "idle" });

  // Pre-fill from LIFF context once after the provider hydrates server-stored
  // profile. We use a ref guard so subsequent context changes don't overwrite
  // what the user has typed.
  const hydrated = useRef(false);
  useEffect(() => {
    if (hydrated.current) return;
    if (!liffPhone && !liffBirthday && !liffRealName) return;
    hydrated.current = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (liffPhone) setPhone(liffPhone);
    if (liffBirthday) setBirthday(liffBirthday.slice(0, 10));
    if (liffRealName) setRealName(liffRealName);
  }, [liffPhone, liffBirthday, liffRealName]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!phone.trim()) {
      setStatus({ state: "error", message: "手機是必填欄位" });
      return;
    }
    setStatus({ state: "submitting" });

    const idToken = cachedIdToken || liff?.getIDToken?.() || "";
    if (!idToken) {
      setStatus({ state: "error", message: "尚未取得 LINE 驗證，請重新打開頁面" });
      return;
    }

    try {
      const res = await fetch("/api/profile/me", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-LIFF-ID-Token": idToken,
        },
        body: JSON.stringify({
          phone: phone.trim(),
          birthday: birthday || undefined,
          gender: gender || undefined,
          realName: realName.trim() || undefined,
          legacyName: legacyName.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const msg = data?.error?.message || data?.error || "儲存失敗，請稍後再試";
        setStatus({ state: "error", message: typeof msg === "string" ? msg : "儲存失敗" });
        return;
      }
      setStatus({
        state: "success",
        message: "已成功儲存您的資料",
        mergedCount: data.mergedCount || 0,
      });
    } catch {
      setStatus({ state: "error", message: "網路錯誤，請稍後再試" });
    }
  }

  if (!isReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FFF8F1]">
        <div className="w-6 h-6 border-2 border-[#003D2B] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (status.state === "success") {
    return (
      <div className="min-h-screen bg-[#FFF8F1] px-5 py-10">
        <div className="max-w-md mx-auto bg-white rounded-2xl p-6 shadow-sm">
          <div className="text-center mb-4">
            <div className="w-12 h-12 rounded-full bg-[#003D2B] text-white flex items-center justify-center mx-auto mb-3 text-xl">
              ✓
            </div>
            <h1 className="text-lg font-bold text-[#003D2B] mb-1">資料已更新</h1>
            <p className="text-sm text-[#003D2B]/70">{status.message}</p>
          </div>
          {status.mergedCount && status.mergedCount > 0 ? (
            <div className="bg-[#003D2B]/5 rounded-xl p-3 text-center mt-4">
              <p className="text-xs text-[#003D2B]/70">系統幫您找回</p>
              <p className="text-2xl font-bold text-[#003D2B] mt-1">{status.mergedCount} 次</p>
              <p className="text-xs text-[#003D2B]/70 mt-1">過去的消費紀錄</p>
            </div>
          ) : null}
          <button
            type="button"
            onClick={() => liff?.closeWindow()}
            className="w-full mt-6 py-3 bg-[#003D2B] text-white rounded-xl font-medium"
          >
            完成
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FFF8F1] pb-12">
      <div className="px-5 pt-6 pb-4">
        <h1 className="text-xl font-bold text-[#003D2B] mb-1">完善您的會員資料</h1>
        <p className="text-sm text-[#003D2B]/70">
          {displayName ? `${displayName}，` : ""}花 30 秒填寫，享生日當月優惠
        </p>
      </div>

      <div className="mx-5 mb-5 bg-[#003D2B]/5 border border-[#003D2B]/10 rounded-xl p-3">
        <p className="text-xs text-[#003D2B]/80 leading-relaxed">
          🔒 我們不會發行銷簡訊。<br />
          手機只用來傳當天預約提醒、生日只用於生日月優惠。
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mx-5 space-y-4">
        {/* 手機 (required) */}
        <div>
          <label className="block text-sm font-medium text-[#003D2B] mb-1.5">
            手機 <span className="text-[#A84A3B]">*</span>
          </label>
          <input
            type="tel"
            inputMode="tel"
            placeholder="0912345678"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full bg-white rounded-xl px-4 py-3 text-base text-[#003D2B] outline-none border border-[#003D2B]/15 focus:border-[#003D2B]"
            required
          />
        </div>

        {/* 生日 */}
        <div>
          <label className="block text-sm font-medium text-[#003D2B] mb-1.5">
            生日 <span className="text-[#003D2B]/50 text-xs">(選填，享生日月優惠)</span>
          </label>
          <input
            type="date"
            value={birthday}
            onChange={(e) => setBirthday(e.target.value)}
            className="w-full bg-white rounded-xl px-4 py-3 text-base text-[#003D2B] outline-none border border-[#003D2B]/15 focus:border-[#003D2B]"
          />
        </div>

        {/* 性別 */}
        <div>
          <label className="block text-sm font-medium text-[#003D2B] mb-1.5">
            性別 <span className="text-[#003D2B]/50 text-xs">(選填)</span>
          </label>
          <div className="grid grid-cols-4 gap-2">
            {GENDER_OPTIONS.map((opt) => (
              <button
                type="button"
                key={opt.value}
                onClick={() => setGender(gender === opt.value ? "" : opt.value)}
                className={`py-2.5 rounded-xl text-sm font-medium border transition-colors ${
                  gender === opt.value
                    ? "bg-[#003D2B] text-white border-[#003D2B]"
                    : "bg-white text-[#003D2B] border-[#003D2B]/15"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* 本名 */}
        <div>
          <label className="block text-sm font-medium text-[#003D2B] mb-1.5">
            本名 <span className="text-[#003D2B]/50 text-xs">(選填)</span>
          </label>
          <input
            type="text"
            placeholder="王小明"
            value={realName}
            onChange={(e) => setRealName(e.target.value)}
            className="w-full bg-white rounded-xl px-4 py-3 text-base text-[#003D2B] outline-none border border-[#003D2B]/15 focus:border-[#003D2B]"
          />
        </div>

        {/* 之前在店裡用的名字 (legacy match) */}
        <div className="bg-[#C88B3B]/10 rounded-xl p-3 border border-[#C88B3B]/20">
          <label className="block text-sm font-medium text-[#003D2B] mb-1.5">
            之前在店裡用的名字 <span className="text-[#003D2B]/50 text-xs">(老客戶請填)</span>
          </label>
          <input
            type="text"
            placeholder="老闆過去叫您的名字"
            value={legacyName}
            onChange={(e) => setLegacyName(e.target.value)}
            className="w-full bg-white rounded-xl px-4 py-3 text-base text-[#003D2B] outline-none border border-[#C88B3B]/30 focus:border-[#C88B3B]"
          />
          <p className="text-xs text-[#003D2B]/60 mt-1.5">
            填寫後，系統會嘗試找回您過去的消費紀錄
          </p>
        </div>

        {status.state === "error" && status.message && (
          <div className="bg-[#A84A3B]/10 border border-[#A84A3B]/20 rounded-xl p-3 text-sm text-[#A84A3B]">
            {status.message}
          </div>
        )}

        <button
          type="submit"
          disabled={status.state === "submitting"}
          className="w-full py-3.5 bg-[#003D2B] text-white rounded-xl font-medium text-base disabled:opacity-60"
        >
          {status.state === "submitting" ? "儲存中…" : "儲存"}
        </button>
      </form>
    </div>
  );
}
