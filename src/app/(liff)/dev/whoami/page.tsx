"use client";

/**
 * /dev/whoami — operator utility page for bootstrapping feature-flag allowlists.
 *
 * Opens inside LIFF and displays the current LINE user's ID and profile.
 * Used when configuring ECPAY_ALLOWED_USER_IDS on Vercel for dogfood-in-prod.
 *
 * Not linked from anywhere — access by typing the URL into LIFF directly.
 * Exposes only the viewer's own LINE ID (which they already have via LINE),
 * so the lack of auth is intentional and safe.
 */

import { useLiff } from "@/lib/liff/provider";
import { useToast } from "@/components/ui/toast";
import { useState } from "react";

export default function WhoAmIPage() {
  const { isReady, userId, displayName, pictureUrl, liff } = useLiff();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast({ type: "success", message: "已複製" });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ type: "error", message: "複製失敗，請長按選取" });
    }
  }

  if (!isReady) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <p className="text-sm text-gray-500">LIFF 初始化中⋯</p>
      </div>
    );
  }

  if (!userId) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-sm text-center space-y-3">
          <p className="text-sm text-gray-700">
            未取得 LINE 身分。請確認這是透過 LINE 開啟（而非一般瀏覽器）。
          </p>
          <button
            onClick={() => liff?.login?.()}
            className="px-4 py-2 bg-[var(--color-primary,#111)] text-white rounded-lg"
          >
            重新登入 LINE
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 max-w-md mx-auto space-y-4">
      <header className="py-2">
        <h1 className="text-lg font-semibold">身分資訊（Dev）</h1>
        <p className="text-xs text-gray-500 mt-1">
          此頁用於 feature-flag 白名單設定，不對外宣傳。
        </p>
      </header>

      {pictureUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={pictureUrl}
          alt={displayName ?? ""}
          className="w-20 h-20 rounded-full mx-auto"
        />
      )}

      <div className="space-y-3">
        <Field label="顯示名稱" value={displayName ?? "—"} />
        <Field
          label="LINE User ID"
          value={userId}
          onCopy={() => copy(userId)}
          copied={copied}
          big
        />
      </div>

      <div className="text-xs text-gray-500 leading-relaxed bg-gray-50 rounded-lg p-3 mt-6">
        <p className="mb-1">👉 把上面的 User ID 貼給工程師：</p>
        <p>• 會加進 <code>ECPAY_ALLOWED_USER_IDS</code> 環境變數</p>
        <p>• 加完後重新打開付款頁，就能看到 ATM 選項</p>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onCopy,
  copied,
  big,
}: {
  label: string;
  value: string;
  onCopy?: () => void;
  copied?: boolean;
  big?: boolean;
}) {
  return (
    <div>
      <label className="text-xs text-gray-500">{label}</label>
      <div
        className={`mt-1 flex items-center gap-2 px-3 py-2 bg-white border rounded-lg ${
          big ? "font-mono text-sm break-all" : "text-sm"
        }`}
      >
        <span className="flex-1">{value}</span>
        {onCopy && (
          <button
            onClick={onCopy}
            className="px-2 py-1 text-xs border rounded shrink-0"
          >
            {copied ? "✓" : "複製"}
          </button>
        )}
      </div>
    </div>
  );
}
