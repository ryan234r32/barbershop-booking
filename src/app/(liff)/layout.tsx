"use client";

import { LiffProvider } from "@/lib/liff/provider";
import { ToastProvider } from "@/components/ui/toast";

export default function LiffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <LiffProvider>
      <ToastProvider>
        <div className="min-h-screen bg-[#FFF8F1]">
          {children}
        </div>
      </ToastProvider>
    </LiffProvider>
  );
}
