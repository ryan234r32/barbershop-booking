interface MToggleOption<T extends string> {
  value: T;
  label: string;
  disabled?: boolean;
}

interface MToggleProps<T extends string> {
  options: MToggleOption<T>[];
  value: T;
  onChange: (next: T) => void;
}

export function MToggle<T extends string>({
  options,
  value,
  onChange,
}: MToggleProps<T>) {
  return (
    <div
      className="grid gap-1 p-1 bg-[var(--color-surface)] rounded-lg"
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            disabled={opt.disabled}
            onClick={() => !opt.disabled && onChange(opt.value)}
            className={`py-2 text-sm rounded-md transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
              active
                ? "bg-[var(--color-bg)] text-[var(--color-text-primary)] font-semibold shadow-sm"
                : "text-[var(--color-text-muted)] hover:bg-[var(--color-bg)]/50"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
