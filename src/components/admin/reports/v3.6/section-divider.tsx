import type { ReactNode } from "react";

interface SectionDividerProps {
  number?: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
  /** when collapsible, render as <details>. */
  collapsible?: boolean;
  defaultOpen?: boolean;
}

export function SectionDivider({
  number,
  title,
  subtitle,
  children,
  collapsible,
  defaultOpen = true,
}: SectionDividerProps) {
  const Header = (
    <div className="flex items-baseline gap-2 mb-3 sm:mb-4">
      {number && (
        <span className="text-xs font-mono text-[var(--color-text-muted)] tracking-wider">
          {number}
        </span>
      )}
      <div className="flex-1 min-w-0">
        <h2 className="text-sm sm:text-base font-bold text-[var(--color-text-primary)]">
          {title}
        </h2>
        {subtitle && (
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{subtitle}</p>
        )}
      </div>
    </div>
  );

  if (collapsible) {
    return (
      <details className="group" open={defaultOpen}>
        <summary className="cursor-pointer list-none">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            {Header}
            <span className="text-xs text-[var(--color-text-muted)] group-open:rotate-90 transition-transform shrink-0 ml-2">
              ▶
            </span>
          </div>
        </summary>
        <div className="space-y-3">{children}</div>
      </details>
    );
  }

  return (
    <section>
      {Header}
      <div className="space-y-3">{children}</div>
    </section>
  );
}
