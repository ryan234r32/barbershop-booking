"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Calendar, BarChart3, MoreHorizontal } from "lucide-react";

const TABS = [
  { href: "/calendar", label: "日曆", icon: Calendar },
  { href: "/analytics", label: "報表", icon: BarChart3 },
  { href: "/more", label: "更多", icon: MoreHorizontal },
] as const;

export function AdminTabBar() {
  const pathname = usePathname();

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
              <Icon size={20} strokeWidth={isActive ? 2.2 : 1.5} />
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
