import type { ReactNode } from "react";

type Tone = "default" | "success" | "warning" | "danger" | "info" | "brand";

const TONE_CLASS: Record<Tone, string> = {
  default: "bg-[var(--color-surface)] text-[var(--color-text-body)]",
  success: "bg-[var(--color-success)]/15 text-[var(--color-success)]",
  warning: "bg-[var(--color-warning)]/15 text-[var(--color-warning)]",
  danger: "bg-[var(--color-danger)]/12 text-[var(--color-danger)]",
  info: "bg-[var(--color-brand)]/8 text-[var(--color-brand)]",
  brand: "bg-[var(--color-brand)] text-[var(--color-bg)]",
};

interface MTagProps {
  children: ReactNode;
  tone?: Tone;
  size?: "xs" | "sm";
}

export function MTag({ children, tone = "default", size = "xs" }: MTagProps) {
  const sizeClass = size === "xs" ? "text-[10px] px-2 py-0.5" : "text-xs px-2.5 py-1";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-medium ${sizeClass} ${TONE_CLASS[tone]}`}
    >
      {children}
    </span>
  );
}
