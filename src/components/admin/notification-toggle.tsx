"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, BellRing } from "lucide-react";
import { useToast } from "@/components/ui/toast";

type State = "loading" | "unsupported" | "denied" | "disabled" | "enabled";

function urlBase64ToArrayBuffer(base64: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const buf = new ArrayBuffer(raw.length);
  const view = new Uint8Array(buf);
  for (let i = 0; i < raw.length; i++) view[i] = raw.charCodeAt(i);
  return buf;
}

export function NotificationToggle() {
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      setState("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setState("denied");
      return;
    }
    navigator.serviceWorker
      .getRegistration()
      .then((reg) => reg?.pushManager.getSubscription() ?? null)
      .then((sub) => setState(sub ? "enabled" : "disabled"))
      .catch(() => setState("disabled"));
  }, []);

  const enable = async () => {
    setBusy(true);
    try {
      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidPublicKey) {
        toast({ type: "error", message: "系統未設定推播金鑰，請聯絡開發人員" });
        setBusy(false);
        return;
      }

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "disabled");
        toast({ type: "info", message: "未授權通知" });
        setBusy(false);
        return;
      }

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToArrayBuffer(vapidPublicKey),
      });

      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: sub.toJSON() }),
      });
      if (!res.ok) throw new Error("subscribe failed");

      setState("enabled");
      toast({ type: "success", message: "已開啟通知 — 新預約會即時推播" });
    } catch (err) {
      console.error(err);
      toast({ type: "error", message: "開啟通知失敗，請重試" });
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setState("disabled");
      toast({ type: "info", message: "已關閉通知" });
    } catch (err) {
      console.error(err);
      toast({ type: "error", message: "關閉通知失敗" });
    } finally {
      setBusy(false);
    }
  };

  const Row = ({
    icon: Icon,
    title,
    desc,
    action,
  }: {
    icon: typeof Bell;
    title: string;
    desc: string;
    action?: React.ReactNode;
  }) => (
    <div className="flex items-center gap-3 px-4 py-3.5 rounded-lg bg-[var(--color-surface)]">
      <Icon size={20} strokeWidth={1.5} className="text-[var(--color-text-body)] shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-[15px] text-[var(--color-text-body)]">{title}</p>
        <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{desc}</p>
      </div>
      {action}
    </div>
  );

  if (state === "loading") {
    return (
      <Row icon={Bell} title="推播通知" desc="載入中..." />
    );
  }

  if (state === "unsupported") {
    return (
      <Row
        icon={BellOff}
        title="推播通知"
        desc="此瀏覽器不支援 — 請用 iOS Safari（16.4+）或 Chrome 並安裝 PWA"
      />
    );
  }

  if (state === "denied") {
    return (
      <Row
        icon={BellOff}
        title="推播通知"
        desc="已被封鎖 — 請至系統設定開啟通知權限後重新整理"
      />
    );
  }

  if (state === "enabled") {
    return (
      <Row
        icon={BellRing}
        title="推播通知（已開啟）"
        desc="新預約、取消、訊息會即時推送"
        action={
          <button
            onClick={disable}
            disabled={busy}
            className="text-xs font-medium text-[var(--color-danger)] hover:opacity-70 disabled:opacity-40"
          >
            關閉
          </button>
        }
      />
    );
  }

  return (
    <Row
      icon={Bell}
      title="推播通知"
      desc="開啟後，新預約會即時推送到此裝置"
      action={
        <button
          onClick={enable}
          disabled={busy}
          className="px-3 py-1.5 rounded-lg bg-[var(--color-brand)] text-[var(--color-bg)] text-xs font-medium hover:opacity-90 disabled:opacity-40"
        >
          開啟
        </button>
      }
    />
  );
}
