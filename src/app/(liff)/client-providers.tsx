"use client";

import { LiffProvider } from "@/lib/liff/provider";
import { ToastProvider } from "@/components/ui/toast";

export function LiffClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <LiffProvider>
      <ToastProvider>{children}</ToastProvider>
    </LiffProvider>
  );
}
