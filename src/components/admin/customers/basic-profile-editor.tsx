"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";
import { useToast } from "@/components/ui/toast";

type Gender = "MALE" | "FEMALE" | "OTHER" | "PREFER_NOT_TO_SAY";

const GENDER_OPTIONS: { value: Gender; label: string }[] = [
  { value: "MALE", label: "男" },
  { value: "FEMALE", label: "女" },
  { value: "OTHER", label: "其他" },
  { value: "PREFER_NOT_TO_SAY", label: "不便提供" },
];

interface Props {
  customerId: string;
  initial: {
    realName: string | null;
    phone: string | null;
    gender: Gender | null;
    birthday: string | null;
  };
  onClose: () => void;
  onSaved: () => void;
}

/**
 * Inline editor for the 基本資料 card on the customer detail page.
 * Lets admin fill in realName / phone / gender / birthday during a visit
 * — needed because LIFF-self-fill alone leaves Excel-imported customers blank.
 */
export function BasicProfileEditor({ customerId, initial, onClose, onSaved }: Props) {
  const { toast } = useToast();
  const [realName, setRealName] = useState(initial.realName ?? "");
  const [phone, setPhone] = useState(initial.phone ?? "");
  const [gender, setGender] = useState<Gender | "">(initial.gender ?? "");
  const [birthday, setBirthday] = useState(initial.birthday ? initial.birthday.split("T")[0] : "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/customers/${customerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          realName: realName.trim() || null,
          phone: phone.trim() || null,
          gender: gender || null,
          birthday: birthday || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({} as { error?: string }));
        throw new Error(err.error || "儲存失敗");
      }
      toast({ type: "success", message: "資料已更新" });
      onSaved();
      onClose();
    } catch (e) {
      toast({ type: "error", message: e instanceof Error ? e.message : "儲存失敗" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-[10px] text-[var(--color-text-muted)] mb-1">本名</label>
        <input
          type="text"
          value={realName}
          onChange={(e) => setRealName(e.target.value)}
          placeholder="王小明"
          className="w-full bg-[var(--color-bg)] rounded-lg px-3 py-2 text-sm text-[var(--color-text-body)] outline-none border border-transparent focus:border-[var(--color-brand)]"
        />
      </div>
      <div>
        <label className="block text-[10px] text-[var(--color-text-muted)] mb-1">手機</label>
        <input
          type="tel"
          inputMode="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="0912345678"
          className="w-full bg-[var(--color-bg)] rounded-lg px-3 py-2 text-sm text-[var(--color-text-body)] outline-none border border-transparent focus:border-[var(--color-brand)]"
        />
      </div>
      <div>
        <label className="block text-[10px] text-[var(--color-text-muted)] mb-1">性別</label>
        <div className="grid grid-cols-4 gap-1.5">
          {GENDER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setGender(gender === opt.value ? "" : opt.value)}
              className={`py-2 rounded-lg text-xs font-medium transition-colors ${
                gender === opt.value
                  ? "bg-[var(--color-brand)] text-[var(--color-bg)]"
                  : "bg-[var(--color-bg)] text-[var(--color-text-body)]"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="block text-[10px] text-[var(--color-text-muted)] mb-1">生日</label>
        <input
          type="date"
          value={birthday}
          onChange={(e) => setBirthday(e.target.value)}
          className="w-full bg-[var(--color-bg)] rounded-lg px-3 py-2 text-sm text-[var(--color-text-body)] outline-none border border-transparent focus:border-[var(--color-brand)]"
        />
      </div>

      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={onClose}
          disabled={saving}
          className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg bg-[var(--color-bg)] text-sm text-[var(--color-text-body)] disabled:opacity-50"
        >
          <X size={14} />
          取消
        </button>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg bg-[var(--color-brand)] text-sm font-medium text-[var(--color-bg)] disabled:opacity-50"
        >
          <Check size={14} />
          {saving ? "儲存中…" : "儲存"}
        </button>
      </div>
    </div>
  );
}
