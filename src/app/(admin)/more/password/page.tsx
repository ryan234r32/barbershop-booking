"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { usePageTitle } from "@/lib/hooks/use-page-title";
import { useToast } from "@/components/ui/toast";
import { ChevronLeft } from "lucide-react";

export default function ChangePasswordPage() {
  usePageTitle("修改密碼");
  const router = useRouter();
  const { toast } = useToast();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      toast({ type: "error", message: "兩次新密碼不一致" });
      return;
    }
    if (newPassword.length < 6) {
      toast({ type: "error", message: "新密碼至少 6 個字元" });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "修改失敗");

      toast({ type: "success", message: "密碼已更新" });
      setTimeout(() => router.push("/more"), 1000);
    } catch (err) {
      toast({
        type: "error",
        message: err instanceof Error ? err.message : "修改失敗",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center gap-2 mb-6">
        <Link href="/more" className="p-1.5 rounded-lg hover:bg-[var(--color-surface)]">
          <ChevronLeft size={20} className="text-[var(--color-text-body)]" />
        </Link>
        <h1 className="text-xl font-bold text-[var(--color-text-primary)] tracking-wide">
          修改密碼
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-[10px] font-medium text-[var(--color-text-muted)] tracking-wider block mb-1">
            目前密碼
          </label>
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            autoComplete="current-password"
            required
            className="w-full border-b border-[var(--color-brand)] bg-transparent py-2 text-sm text-[var(--color-text-body)] outline-none"
          />
        </div>

        <div>
          <label className="text-[10px] font-medium text-[var(--color-text-muted)] tracking-wider block mb-1">
            新密碼（至少 6 個字元）
          </label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
            minLength={6}
            required
            className="w-full border-b border-[var(--color-brand)] bg-transparent py-2 text-sm text-[var(--color-text-body)] outline-none"
          />
        </div>

        <div>
          <label className="text-[10px] font-medium text-[var(--color-text-muted)] tracking-wider block mb-1">
            再次輸入新密碼
          </label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
            minLength={6}
            required
            className="w-full border-b border-[var(--color-brand)] bg-transparent py-2 text-sm text-[var(--color-text-body)] outline-none"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 bg-[var(--color-brand)] text-[var(--color-bg)] font-semibold rounded-lg text-sm hover:opacity-90 transition-opacity disabled:opacity-50 mt-6"
        >
          {loading ? "修改中..." : "確認修改"}
        </button>
      </form>
    </div>
  );
}
