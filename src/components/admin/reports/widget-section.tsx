/**
 * Section divider for the V3.5 reports redesign — adds a visible header above
 * a group of related widgets so the page reads as "客戶診斷 / 客戶來源 /
 * 服務組合 / 時段 / VIP / 收款" instead of one long scroll of cards.
 */
export function WidgetSection({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3 pt-2">
      <div className="border-l-4 border-[var(--color-brand)] pl-3">
        <h2 className="text-base font-bold text-[var(--color-text-primary)]">{title}</h2>
        {subtitle && (
          <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">{subtitle}</p>
        )}
      </div>
      {children}
    </section>
  );
}
