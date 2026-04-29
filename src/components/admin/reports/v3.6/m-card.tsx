import type { ReactNode, HTMLAttributes } from "react";

interface MCardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  /** Optional left color band (KpiCard pattern). 4px wide. */
  leftBand?: string;
  /** Padding preset — keeps consistency across reports views */
  padding?: "sm" | "md" | "lg";
}

const PAD: Record<NonNullable<MCardProps["padding"]>, string> = {
  sm: "p-3",
  md: "p-4 sm:p-5",
  lg: "p-5 sm:p-6",
};

export function MCard({
  children,
  className = "",
  leftBand,
  padding = "md",
  style,
  ...rest
}: MCardProps) {
  return (
    <div
      className={`relative bg-[var(--color-bg)] border border-[var(--color-brand)]/12 rounded-xl shadow-[0_1px_2px_rgba(0,0,0,0.03)] ${PAD[padding]} ${className}`}
      style={{
        ...style,
        ...(leftBand
          ? { borderLeft: `4px solid ${leftBand}` }
          : {}),
      }}
      {...rest}
    >
      {children}
    </div>
  );
}
