"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import useSWR from "swr";
import { Calendar, MessageSquare, LayoutDashboard, FileBarChart } from "lucide-react";

// V3.5 Phase 3: tab bar promotes 儀表板 (今日對帳) to the bottom-bar so the
// 8pm settlement workflow is one tap away on mobile. /more was barely used —
// secondary nav lives in the sidebar (lg:hidden hamburger).
const TABS = [
  { href: "/calendar", label: "日曆", icon: Calendar },
  { href: "/messages", label: "訊息", icon: MessageSquare },
  { href: "/dashboard", label: "儀表板", icon: LayoutDashboard },
  { href: "/reports", label: "報表", icon: FileBarChart },
] as const;

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function AdminTabBar() {
  const pathname = usePathname();
  // Poll infrequently (30s) purely as a safety net. Push + focus handle real-time.
  const { data } = useSWR<{ totalUnread: number }>(
    "/api/admin/messages",
    fetcher,
    { refreshInterval: 30000, revalidateOnFocus: true },
  );
  const unread = data?.totalUnread ?? 0;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 lg:hidden border-t border-[var(--color-surface)] bg-[var(--color-bg)] safe-area-bottom">
      <div className="flex items-center justify-around h-14">
        {TABS.map((tab) => {
          const isActive =
            pathname === tab.href || pathname.startsWith(tab.href + "/");
          const Icon = tab.icon;

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`
                flex flex-col items-center justify-center gap-0.5 w-full h-full relative
                transition-colors duration-150
                ${isActive
                  ? "text-[var(--color-brand)]"
                  : "text-[var(--color-text-muted)]"
                }
              `}
            >
              {isActive && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-[var(--color-brand)] rounded-full" />
              )}
              <div className="relative">
                <Icon size={20} strokeWidth={isActive ? 2.2 : 1.5} />
                {tab.href === "/messages" && unread > 0 && (
                  <span className="absolute -top-1.5 -right-2 min-w-[16px] h-[16px] px-1 rounded-full bg-[var(--color-danger)] text-white text-[9px] font-bold leading-[16px] text-center">
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-medium tracking-wide">
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
