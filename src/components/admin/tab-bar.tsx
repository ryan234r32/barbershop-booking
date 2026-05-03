"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import useSWR from "swr";
import {
  Calendar,
  FileBarChart,
  Users,
  MessageSquare,
  MoreHorizontal,
} from "lucide-react";

// V3.8 consolidation: 老闆指定主選單 4 個 + 更多。日曆是 app 根，報表 = V3.6
// 三視角，顧客 = 客戶管理，訊息 = LINE 客服。其他全進「更多」（/more 頁）。
//
// V3.7 §1 — 「報表」改名「財務」：報表 tab 現在 owns 營收 + 支出 + 淨利 + 對帳，
// 路由維持 /reports（節省遷移成本，未來若改為 /finance 再走 redirect）。
const TABS = [
  { href: "/calendar", label: "行事曆", icon: Calendar },
  { href: "/reports", label: "財務", icon: FileBarChart },
  { href: "/customers", label: "顧客", icon: Users },
  { href: "/messages", label: "訊息", icon: MessageSquare },
  { href: "/more", label: "更多", icon: MoreHorizontal },
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
