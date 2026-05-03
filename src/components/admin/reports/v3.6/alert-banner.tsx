import type { Alert } from "@/lib/reports/v3.6/aggregates";

interface AlertBannerProps {
  alerts: Alert[];
  onDrill?: (alertId: string) => void;
}

export function AlertBanner({ alerts, onDrill }: AlertBannerProps) {
  if (alerts.length === 0) {
    return (
      <div className="bg-[var(--color-success)]/10 border-l-[3px] border-[var(--color-success)] rounded-r-lg px-4 py-3">
        <p className="text-sm text-[var(--color-text-primary)] font-medium inline-flex items-center gap-1.5">
          <span
            className="inline-block w-2.5 h-2.5 rounded-full bg-[var(--color-success)]"
            aria-hidden
          />
          本月所有 KPI 達標 — 無警報
        </p>
      </div>
    );
  }

  return (
    <div className="bg-[var(--color-warning)]/10 border-l-[3px] border-[var(--color-warning)] rounded-r-lg px-4 py-3 space-y-2">
      <p className="text-[10px] tracking-wider text-[var(--color-text-muted)] uppercase font-semibold">
        本月警報 · {alerts.length} 條
      </p>
      <ul className="space-y-2">
        {alerts.map((a) => (
          <li
            key={a.id}
            className="flex items-start gap-2 text-sm"
            onClick={() => onDrill?.(a.id)}
            style={{ cursor: onDrill ? "pointer" : "default" }}
          >
            <span
              className={`shrink-0 mt-1.5 inline-block w-2.5 h-2.5 rounded-full ${
                a.level === "red"
                  ? "bg-[var(--color-danger)]"
                  : "bg-[var(--color-warning)]"
              }`}
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-[var(--color-text-primary)]">{a.title}</p>
              <p className="text-xs text-[var(--color-text-body)] mt-0.5">{a.detail}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
