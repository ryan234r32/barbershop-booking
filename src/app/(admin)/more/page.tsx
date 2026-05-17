"use client";

import Link from "next/link";
import { useAdmin } from "@/lib/admin/auth-context";
import { NotificationToggle } from "@/components/admin/notification-toggle";
import { ClosureReminderBanner } from "@/components/admin/closure-reminder-banner";
import {
  Scissors,
  Megaphone,
  Ticket,
  Settings,
  LogOut,
  ChevronRight,
  Lock,
  Wallet,
} from "lucide-react";

// V3.8 consolidation: 老闆指定主選單 4 個（行事曆/報表/顧客/訊息）+ 更多。
// V3.7 Tier 1.5: 加「支出總覽」入口（集中支出頁 + 搜尋）。
// V3.7 5/18: 移除「抽獎」入口（老闆訪談 5/17 確認不用），routes + DB 暫保留
// 待下次 session 清理（destructive 操作避免破壞既有資料）。
const MENU_ITEMS = [
  { href: "/expenses", label: "支出總覽", icon: Wallet },
  { href: "/campaigns", label: "行銷推播", icon: Megaphone },
  { href: "/coupons", label: "優惠券", icon: Ticket },
  { href: "/services", label: "服務項目管理", icon: Scissors },
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

      {/* V3.7 Tier 1.3 — 公休未設提醒 (autoplan D-G dashboard banner pattern) */}
      <ClosureReminderBanner />

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

      {/* Notifications */}
      <div className="mb-4">
        <NotificationToggle />
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
