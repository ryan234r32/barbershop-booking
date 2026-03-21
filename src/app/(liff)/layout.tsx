"use client";

import { LiffProvider } from "@/lib/liff/provider";

export default function LiffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <LiffProvider>
      <div className="min-h-screen bg-gray-50">
        {children}
      </div>
    </LiffProvider>
  );
}
