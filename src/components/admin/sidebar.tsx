"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAdmin } from "@/lib/admin/auth-context";
import { useState, useEffect } from "react";

const NAV_ITEMS = [
  { href: "/dashboard", label: "儀表板", icon: "📊" },
  { href: "/calendar", label: "行事曆", icon: "📅" },
  { href: "/bookings/new", label: "新增預約", icon: "➕" },
  { href: "/customers", label: "顧客管理", icon: "👥" },
  { href: "/services", label: "服務項目", icon: "💇" },
  { href: "/analytics", label: "數據分析", icon: "📈" },
  { href: "/settings", label: "設定", icon: "⚙️" },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const { admin, logout } = useAdmin();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const navLinks = (
    <>
      <div className="p-6 border-b border-gray-100">
        <h1 className="text-lg font-bold text-gray-900">
          {admin?.tenant.businessName || "理髮廳"}
        </h1>
        <p className="text-xs text-gray-400 mt-0.5">管理後台</p>
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`
                flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors
                ${isActive
                  ? "bg-emerald-50 text-emerald-700 font-medium"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                }
              `}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-gray-100">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-700 truncate">{admin?.name}</p>
            <p className="text-xs text-gray-400 truncate">{admin?.email}</p>
          </div>
          <button
            onClick={logout}
            className="text-xs text-gray-400 hover:text-red-500 transition-colors shrink-0 ml-2"
          >
            登出
          </button>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile top bar */}
      <div className="fixed top-0 left-0 right-0 h-14 bg-white border-b border-gray-200 flex items-center px-4 z-40 lg:hidden">
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="p-2 -ml-2 text-gray-600 hover:text-gray-900"
          aria-label="Toggle menu"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            {mobileOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
        <span className="ml-3 font-semibold text-gray-900">
          {admin?.tenant.businessName || "理髮廳"}
        </span>
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed left-0 top-0 bottom-0 w-64 bg-white border-r border-gray-200 flex flex-col z-50
          transition-transform duration-200 ease-in-out
          lg:translate-x-0
          ${mobileOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        {navLinks}
      </aside>
    </>
  );
}
