"use client";

import { AdminProvider, useAdmin } from "@/lib/admin/auth-context";
import { AdminSidebar } from "@/components/admin/sidebar";
import { AdminTabBar } from "@/components/admin/tab-bar";
import { ToastProvider } from "@/components/ui/toast";

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
        {/* Desktop: sidebar */}
        <AdminSidebar />

        {/* Content area — min-w-0 prevents intrinsic-width flex child from overflowing viewport */}
        <main className="flex-1 min-w-0 pt-14 lg:pt-0 lg:ml-64 pb-16 lg:pb-0 p-4 lg:p-6">
          {children}
        </main>

        {/* Mobile: bottom tab bar */}
        <AdminTabBar />
      </div>
    </ToastProvider>
  );
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AdminProvider>
      <AdminLayoutInner>{children}</AdminLayoutInner>
    </AdminProvider>
  );
}
