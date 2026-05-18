"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { SWRConfig } from "swr";
import { AdminProvider, useAdmin } from "@/lib/admin/auth-context";
import { AdminSidebar } from "@/components/admin/sidebar";
import { AdminTabBar } from "@/components/admin/tab-bar";
import { ToastProvider } from "@/components/ui/toast";
import { ReportIssueButton } from "@/components/admin/report-issue-button";
import { localStorageProvider } from "@/lib/swr/persistent-cache";

/**
 * V3.7 Tier 0.1.D — Route-change body scroll-lock safety net.
 *
 * Root cause: 多個 modal 元件（Modal / FullscreenModal）各自 manipulate
 * document.body.style.overflow。即使各 modal 都 snapshot-restore，仍可能在
 * 以下情境留下 stuck "hidden":
 *   - React Suspense fallback 切換時 modal unmount cleanup 沒跑完
 *   - Next.js App Router transition 中 modal 半 mount 狀態
 *   - iOS Safari PWA 切到背景再回來，狀態快照不對
 *
 * 此 hook 在每次路由變更後強制把 body + html overflow 設回 "" — 即「沒有
 * 任何 modal 在 viewport 上」的預期狀態。代價：若使用者切路由時 modal 正
 * 在開，那個 modal 的 scroll lock 會失效（但 modal 自己的 overflow-y-auto
 * 仍 work，所以 modal 內容仍可滑）。
 */
function useGlobalScrollLockSafetyNet() {
  const pathname = usePathname();
  useEffect(() => {
    document.body.style.overflow = "";
    document.body.style.overflowX = "";
    document.documentElement.style.overflow = "";
    document.documentElement.style.overflowX = "";
  }, [pathname]);
}

function AdminLayoutInner({ children }: { children: React.ReactNode }) {
  const { admin, loading } = useAdmin();
  useGlobalScrollLockSafetyNet();

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
        {/* V3.7 Tier 0.1.D — pb-16 → pb-20 因 tab bar h-14 → h-16 + safe-area-bottom，
            原本 64px padding 不夠遮，最後一筆內容會被吃到。pb-20 = 80px 有 buffer。 */}
        <main className="flex-1 min-w-0 pt-14 lg:pt-0 lg:ml-64 pb-20 lg:pb-0 p-4 lg:p-6">
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
