"use client";

import { useState } from "react";
import { usePageTitle } from "@/lib/hooks/use-page-title";

interface PreviewResult {
  intent: string;
  intentLabel: string;
  note?: string;
  preview: unknown;
}

const SAMPLE_INPUTS = [
  "我的預約",
  "我想改期",
  "剪髮多少錢",
  "預約",
  "地點在哪裡",
  "電話幾號",
  "轉帳帳號",
  "你好",
  "謝謝",
  "今天天氣真好",
];

export default function KeywordTestPage() {
  usePageTitle("關鍵字測試");

  const [text, setText] = useState("");
  const [result, setResult] = useState<PreviewResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runPreview(input: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/dev/keyword-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: input }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `HTTP ${res.status}`);
      }
      setResult(await res.json());
    } catch (e) {
      setError((e as Error).message);
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    runPreview(text);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-6">
      <header>
        <h1 className="text-2xl font-bold">關鍵字測試工具</h1>
        <p className="mt-1 text-sm text-gray-600">
          模擬顧客在 LINE 傳訊息後，系統會回什麼 —— 不會真的送訊息。
        </p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-3">
        <label className="block">
          <span className="text-sm font-medium text-gray-700">模擬訊息</span>
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="例如：剪髮多少錢"
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600"
          />
        </label>
        <button
          type="submit"
          disabled={loading || !text.trim()}
          className="rounded-lg bg-green-800 px-4 py-2 text-white hover:bg-green-900 disabled:opacity-50"
        >
          {loading ? "模擬中..." : "模擬"}
        </button>
      </form>

      <section>
        <h2 className="mb-2 text-sm font-medium text-gray-700">快速測試</h2>
        <div className="flex flex-wrap gap-2">
          {SAMPLE_INPUTS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                setText(s);
                runPreview(s);
              }}
              className="rounded-full border border-gray-300 bg-white px-3 py-1 text-sm text-gray-700 hover:border-green-600 hover:text-green-800"
            >
              {s}
            </button>
          ))}
        </div>
      </section>

      {error && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          錯誤：{error}
        </div>
      )}

      {result && (
        <section className="space-y-3 rounded-lg border border-gray-200 bg-white p-4">
          <div>
            <div className="text-xs uppercase tracking-wide text-gray-500">命中 Intent</div>
            <div className="mt-1 font-semibold text-green-800">{result.intentLabel}</div>
          </div>

          {result.note && (
            <div className="rounded bg-amber-50 p-3 text-sm text-amber-800">
              ⚠️ {result.note}
            </div>
          )}

          <div>
            <div className="text-xs uppercase tracking-wide text-gray-500">回覆 payload</div>
            <pre className="mt-1 max-h-96 overflow-auto rounded bg-gray-900 p-3 text-xs text-green-200">
              {JSON.stringify(result.preview, null, 2)}
            </pre>
          </div>
        </section>
      )}

      <footer className="text-xs text-gray-500">
        注意：此頁僅供開發測試，真實 LINE 訊息走 <code>/api/webhook</code>。
        動態訊息（如「我的預約」）在此頁只顯示空狀態 guide，真實執行會回傳動態預約清單。
      </footer>
    </div>
  );
}
