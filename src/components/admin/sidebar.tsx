"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAdmin } from "@/lib/admin/auth-context";
import { useState, useEffect } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Calendar,
  Users,
  Scissors,
  Megaphone,
  Ticket,
  FileBarChart,
  Settings,
  MessageSquare,
  Gift,
  Lock,
  X,
} from "lucide-react";

interface NavItem {
  href: string;
  label: string;
  Icon: LucideIcon;
  badge?: string;
}

// V3.8 consolidation: 主選單 4 + 更多群組。老闆 2026-04-30 指定結構。
const MAIN_NAV: readonly NavItem[] = [
  { href: "/calendar", label: "行事曆", Icon: Calendar },
  { href: "/reports", label: "報表", Icon: FileBarChart },
  { href: "/customers", label: "顧客", Icon: Users },
  { href: "/messages", label: "訊息", Icon: MessageSquare },
] as const;

const MORE_NAV: readonly NavItem[] = [
  { href: "/lottery", label: "抽獎", Icon: Gift },
  { href: "/campaigns", label: "行銷推播", Icon: Megaphone },
  { href: "/coupons", label: "優惠券", Icon: Ticket },
  { href: "/services", label: "服務項目", Icon: Scissors },
  { href: "/settings", label: "店鋪設定", Icon: Settings },
  { href: "/more/password", label: "修改密碼", Icon: Lock },
] as const;

const ALL_NAV = [...MAIN_NAV, ...MORE_NAV];

export function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { admin, logout } = useAdmin();
  const [mobileOpen, setMobileOpen] = useState(false);

  // V3.5 Phase 4: 日曆是 app 的根 — 其他頁面在行動版 top bar 顯示「X 回日曆」
  // 而不是漢堡選單。漢堡只在 /calendar 上才出現。Tab bar 仍然永遠顯示。
  const isOnCalendar = pathname === "/calendar" || pathname.startsWith("/calendar/");
  // V3.8: 「更多」群組裡的 sub-page (lottery / campaigns / coupons / services /
  // settings / more/password) 按 X 應該回 /more，不是 /calendar — 老闆 2026-04-30
  // 反映從更多進去的 sub-page 應該回到更多。其他主選單頁 (reports / customers /
  // messages / bookings) 維持 X → /calendar。
  const isInMoreGroup =
    pathname === "/more" ||
    pathname.startsWith("/more/") ||
    MORE_NAV.some(
      (item) => pathname === item.href || pathname.startsWith(item.href + "/"),
    );
  const backTarget =
    isInMoreGroup && pathname !== "/more" ? "/more" : "/calendar";
  const backLabel = backTarget === "/more" ? "返回更多" : "返回日曆";
  const currentPageLabel =
    ALL_NAV.find(
      (item) => pathname === item.href || pathname.startsWith(item.href + "/"),
    )?.label ?? "理髮廳";

  useEffect(() => {
    // Reset mobile menu on navigation — intentional setState in effect
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMobileOpen(false);
  }, [pathname]);

  const navLinks = (
    <>
      <div className="p-6 border-b border-border/50">
        <h1 className="text-lg font-bold text-foreground">
          {admin?.tenant.businessName || "理髮廳"}
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">管理後台</p>
      </div>

      <nav className="flex-1 p-4 overflow-y-auto">
        {/* 主選單 — 4 個核心功能 */}
        <div className="space-y-1">
          {MAIN_NAV.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            const Icon = item.Icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors
                  ${isActive
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:bg-background hover:text-foreground"
                  }
                `}
              >
                <Icon size={18} strokeWidth={isActive ? 2.2 : 1.7} />
                <span className="flex-1">{item.label}</span>
                {item.badge && (
                  <span className="text-[9px] font-semibold tracking-wider px-1.5 py-0.5 rounded bg-[var(--color-brand)]/15 text-[var(--color-brand)]">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>

        {/* 更多群組 */}
        <div className="mt-6">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 px-3 mb-2">
            更多
          </p>
          <div className="space-y-1">
            {MORE_NAV.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
              const Icon = item.Icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`
                    flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors
                    ${isActive
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:bg-background hover:text-foreground"
                    }
                  `}
                >
                  <Icon size={18} strokeWidth={isActive ? 2.2 : 1.7} />
                  <span className="flex-1">{item.label}</span>
                  {item.badge && (
                    <span className="text-[9px] font-semibold tracking-wider px-1.5 py-0.5 rounded bg-[var(--color-brand)]/15 text-[var(--color-brand)]">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      </nav>

      <div className="p-4 border-t border-border/50">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground/80 truncate">{admin?.name}</p>
            <p className="text-xs text-muted-foreground truncate">{admin?.email}</p>
          </div>
          <button
            onClick={logout}
            className="text-xs text-muted-foreground hover:text-destructive transition-colors shrink-0 ml-2"
          >
            登出
          </button>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile top bar — calendar shows hamburger; other pages show X→日曆.
          The drawer-style sidebar is still reachable from /calendar via the
          hamburger; non-calendar pages emphasize "you're a step away from
          the root, tap X to return". */}
      <div className="fixed top-0 left-0 right-0 h-14 bg-card border-b border-border flex items-center px-4 z-40 lg:hidden">
        {isOnCalendar ? (
          <>
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="p-2 -ml-2 text-muted-foreground hover:text-foreground"
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
            <span className="ml-3 font-semibold text-foreground">
              {admin?.tenant.businessName || "理髮廳"}
            </span>
          </>
        ) : (
          <>
            <button
              onClick={() => router.push(backTarget)}
              className="p-2 -ml-2 text-muted-foreground hover:text-foreground"
              aria-label={backLabel}
            >
              <X className="w-6 h-6" strokeWidth={2.2} />
            </button>
            <span className="ml-3 font-semibold text-foreground">{currentPageLabel}</span>
          </>
        )}
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-foreground/30 z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed left-0 top-0 bottom-0 w-64 bg-card border-r border-border flex flex-col z-50
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
