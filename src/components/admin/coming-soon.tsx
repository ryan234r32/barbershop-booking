"use client";

import Link from "next/link";

interface Props {
  title: string;
  prdSection: string;
  waveLabel: string;
  description: string;
  bullets?: string[];
}

/**
 * Placeholder for V3 features whose routes/UI are not yet built.
 * Renders a clean "coming soon" card with PRD breadcrumb so the owner can
 * see the navigation entry exists without being misled by broken UI.
 */
export function ComingSoon({ title, prdSection, waveLabel, description, bullets }: Props) {
  return (
    <main className="p-6 max-w-2xl mx-auto">
      <div className="bg-[var(--color-surface)] rounded-2xl p-8 border border-[var(--color-brand)]/10">
        <div className="flex items-baseline gap-3 mb-2">
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">{title}</h1>
          <span className="text-[10px] font-semibold tracking-wider px-2 py-0.5 rounded bg-[var(--color-brand)]/15 text-[var(--color-brand)]">
            BETA
          </span>
        </div>
        <p className="text-sm text-[var(--color-text-muted)] mb-6">
          PRD-v3 §{prdSection} · {waveLabel}
        </p>

        <div className="bg-[var(--color-bg)] rounded-xl p-5 mb-6">
          <p className="text-sm text-[var(--color-text-body)] leading-relaxed">
            {description}
          </p>
        </div>

        {bullets && bullets.length > 0 && (
          <div className="mb-6">
            <h2 className="text-xs font-semibold tracking-wider text-[var(--color-text-muted)] uppercase mb-3">
              預計功能
            </h2>
            <ul className="space-y-2">
              {bullets.map((b, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 text-sm text-[var(--color-text-body)]"
                >
                  <span className="text-[var(--color-brand)] mt-1">▸</span>
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="text-xs text-[var(--color-text-muted)] border-t border-[var(--color-brand)]/10 pt-4">
          進度詳見：
          <Link
            href="/dev"
            className="text-[var(--color-brand)] underline underline-offset-2 ml-1"
          >
            開發進度
          </Link>
          ｜PRD：
          <code className="bg-[var(--color-brand)]/10 px-1.5 py-0.5 rounded">
            docs/PRD-v3.md
          </code>
        </div>
      </div>
    </main>
  );
}
