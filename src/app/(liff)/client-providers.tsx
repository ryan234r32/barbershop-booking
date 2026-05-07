"use client";

import { LiffProvider } from "@/lib/liff/provider";
import { ToastProvider } from "@/components/ui/toast";
import { IntroModal } from "@/components/liff/intro-modal";
import { HelpFab } from "@/components/liff/help-fab";

export function LiffClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <LiffProvider>
      <ToastProvider>
        {children}
        <IntroModal />
        <HelpFab />
      </ToastProvider>
    </LiffProvider>
  );
}
