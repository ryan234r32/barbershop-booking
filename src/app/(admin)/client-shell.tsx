"use client";

import { SWRConfig } from "swr";
import { AdminProvider, useAdmin } from "@/lib/admin/auth-context";
import { AdminSidebar } from "@/components/admin/sidebar";
import { AdminTabBar } from "@/components/admin/tab-bar";
import { ToastProvider } from "@/components/ui/toast";
import { ReportIssueButton } from "@/components/admin/report-issue-button";
import { localStorageProvider } from "@/lib/swr/persistent-cache";

function AdminLayoutInner({ children }: { children: React.ReactNode }) {
  const { admin, loading } = useAdmin();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[var(--color-bg)]">
        <div className="w-8 h-8 border-3 border-[var(--color-brand)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!admin) return null; // Redirecting to login

  return (
    <ToastProvider>
      <div className="flex min-h-screen bg-[var(--color-bg)]">
        <AdminSidebar />
        <main className="flex-1 min-w-0 pt-14 lg:pt-0 lg:ml-64 pb-16 lg:pb-0 p-4 lg:p-6">
          {children}
        </main>
        <AdminTabBar />
        {/* V3.8 incident response — 老闆報告問題的浮動按鈕，所有 admin 頁可見 */}
        <ReportIssueButton />
      </div>
    </ToastProvider>
  );
}

export function AdminClientShell({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig value={{ provider: localStorageProvider }}>
      <AdminProvider>
        <AdminLayoutInner>{children}</AdminLayoutInner>
      </AdminProvider>
    </SWRConfig>
  );
}
