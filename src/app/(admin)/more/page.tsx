"use client";

import Link from "next/link";
import { useAdmin } from "@/lib/admin/auth-context";
import {
  Users,
  Scissors,
  Megaphone,
  CalendarClock,
  Download,
  Settings,
  LogOut,
  ChevronRight,
  Lock,
} from "lucide-react";

const MENU_ITEMS = [
  { href: "/customers", label: "顧客管理", icon: Users },
  { href: "/services", label: "服務項目管理", icon: Scissors },
  { href: "/campaigns", label: "行銷推播", icon: Megaphone },
  { href: "/more/schedule", label: "營業時間與公休", icon: CalendarClock },
  { href: "/more/export", label: "匯出資料", icon: Download },
  { href: "/settings", label: "店鋪設定", icon: Settings },
  { href: "/more/password", label: "修改密碼", icon: Lock },
];

export default function MorePage() {
  const { admin, logout } = useAdmin();

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-xl font-bold text-[var(--color-text-primary)] mb-6 tracking-wide">
        更多
      </h1>

      {/* Admin info */}
      <div className="bg-[var(--color-surface)] rounded-xl p-4 mb-6 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-[var(--color-brand)] text-[var(--color-bg)] flex items-center justify-center font-semibold text-sm">
          {admin?.name?.charAt(0) || "A"}
        </div>
        <div>
          <p className="font-semibold text-[var(--color-text-primary)] text-sm">
            {admin?.name || "管理員"}
          </p>
          <p className="text-xs text-[var(--color-text-muted)]">
            {admin?.email}
          </p>
        </div>
      </div>

      {/* Menu items */}
      <div className="space-y-0.5">
        {MENU_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-4 py-3.5 rounded-lg hover:bg-[var(--color-surface)] transition-colors group"
            >
              <Icon
                size={20}
                strokeWidth={1.5}
                className="text-[var(--color-text-body)] shrink-0"
              />
              <span className="flex-1 text-[15px] text-[var(--color-text-body)]">
                {item.label}
              </span>
              <ChevronRight
                size={16}
                className="text-[var(--color-text-disabled)] group-hover:text-[var(--color-text-muted)] transition-colors"
              />
            </Link>
          );
        })}
      </div>

      {/* Logout */}
      <div className="mt-8 text-center">
        <button
          onClick={logout}
          className="inline-flex items-center gap-2 text-[var(--color-danger)] text-sm font-medium hover:opacity-80 transition-opacity"
        >
          <LogOut size={16} strokeWidth={1.5} />
          登出
        </button>
      </div>

      <p className="text-center text-[10px] text-[var(--color-text-disabled)] mt-4">
        v1.1.0
      </p>
    </div>
  );
}
