"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "登入失敗");
        return;
      }

      // Store token in localStorage for iOS PWA (cookie may be purged by ITP)
      if (data.token && typeof window !== "undefined") {
        localStorage.setItem("admin_token", data.token);
      }

      router.replace("/calendar");
    } catch {
      setError("網路錯誤，請稍後再試");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-[var(--color-brand)]">理髮廳管理後台</h1>
          <p className="text-muted-foreground text-sm mt-1">請登入您的帳號</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-[var(--color-surface)] rounded-lg p-6 space-y-4"
        >
          <div>
            <label className="text-sm text-foreground block mb-1">電子信箱</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2.5 border-b-2 border-[var(--color-brand)]/20 bg-transparent text-sm focus:outline-none focus:border-[var(--color-brand)]"
              placeholder="admin@example.com"
            />
          </div>

          <div>
            <label className="text-sm text-foreground block mb-1">密碼</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-3 py-2.5 border-b-2 border-[var(--color-brand)]/20 bg-transparent text-sm focus:outline-none focus:border-[var(--color-brand)]"
              placeholder="••••••"
            />
          </div>

          {error && (
            <p className="text-[var(--color-danger)] text-sm">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className={`
              w-full py-2.5 rounded-lg font-semibold transition-all
              ${loading ? "bg-[var(--color-surface)] text-muted-foreground" : "bg-[var(--color-brand)] text-[var(--color-bg)] hover:opacity-90"}
            `}
          >
            {loading ? "登入中..." : "登入"}
          </button>
        </form>
      </div>
    </div>
  );
}
