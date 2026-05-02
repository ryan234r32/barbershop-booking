"use client";

import { useState } from "react";
import useSWR from "swr";
import { PieChart } from "./pie-chart";
import type { CustomerAnalytics, AgeBucketRow } from "@/lib/customers/analytics";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type Dimension = "gender" | "verification" | "visitTier";

const DIMENSIONS: { key: Dimension; label: string }[] = [
  { key: "gender", label: "性別比例" },
  { key: "verification", label: "認證比例" },
  { key: "visitTier", label: "熟客比例" },
];

/** Brand-aligned palette using existing theme tokens — keeps light/dark themes consistent. */
const COLORS = {
  female: "var(--color-info, #6366F1)",
  male: "var(--color-brand)",
  other: "var(--color-warning)",
  verified: "var(--color-success)",
  unverified: "var(--color-text-muted)",
  new: "var(--color-brand)",
  twice: "var(--color-info, #6366F1)",
  threePlus: "var(--color-warning)",
} as const;

interface SegmentDef<K extends string = string> {
  key: K;
  label: string;
  color: string;
}

const GENDER_SEGMENTS: SegmentDef<"female" | "male" | "other">[] = [
  { key: "female", label: "女性", color: COLORS.female },
  { key: "male", label: "男性", color: COLORS.male },
  { key: "other", label: "其他", color: COLORS.other },
];

const VERIFICATION_SEGMENTS: SegmentDef<"verified" | "unverified">[] = [
  { key: "verified", label: "已驗證", color: COLORS.verified },
  { key: "unverified", label: "未驗證", color: COLORS.unverified },
];

const VISIT_TIER_SEGMENTS: SegmentDef<"new" | "twice" | "threePlus">[] = [
  { key: "new", label: "新客", color: COLORS.new },
  { key: "twice", label: "2次客", color: COLORS.twice },
  { key: "threePlus", label: "3+次客", color: COLORS.threePlus },
];

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-[var(--color-surface)] rounded-xl px-4 py-3 flex items-center justify-between">
      <span className="text-sm text-[var(--color-text-muted)]">{label}</span>
      <span className="text-2xl font-bold text-[var(--color-text-primary)] tabular-nums">{value}</span>
    </div>
  );
}

interface PieSectionProps {
  data: CustomerAnalytics;
  dimension: Dimension;
}

function PieSection({ data, dimension }: PieSectionProps) {
  const segments = getSegments(dimension);
  const counts = data.composition[dimension] as unknown as Record<string, number>;
  const total = segments.reduce((s, seg) => s + (counts[seg.key] ?? 0), 0);

  const slices = segments.map((seg) => ({
    label: seg.label,
    value: counts[seg.key] ?? 0,
    color: seg.color,
  }));

  return (
    <div className="flex flex-col items-center gap-4 py-4">
      <PieChart data={slices} size={200} />
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
        {segments.map((seg) => {
          const count = counts[seg.key] ?? 0;
          const pct = total === 0 ? 0 : Math.round((count / total) * 100);
          return (
            <div key={seg.key} className="flex items-center gap-1.5 text-xs text-[var(--color-text-body)]">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: seg.color }} />
              <span>{seg.label}</span>
              <span className="text-[var(--color-text-muted)] tabular-nums">{pct}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AgeBucketTable({
  buckets,
  dimension,
}: {
  buckets: AgeBucketRow[];
  dimension: Dimension;
}) {
  const segments = getSegments(dimension);

  return (
    <div className="border-t border-[var(--color-surface)] pt-3">
      <div className={`grid gap-2 px-3 py-2 text-xs font-medium text-[var(--color-text-muted)]`}
           style={{ gridTemplateColumns: `1.2fr repeat(${segments.length}, 1fr)` }}>
        <span>年齡</span>
        {segments.map((seg) => (
          <span key={seg.key} className="text-right">{seg.label}</span>
        ))}
      </div>
      {buckets.map((bucket) => {
        const counts = bucket[dimension] as unknown as Record<string, number>;
        const total = segments.reduce((s, seg) => s + (counts[seg.key] ?? 0), 0);
        return (
          <div
            key={bucket.key}
            className="grid gap-2 px-3 py-2.5 text-sm border-t border-[var(--color-surface)]/60"
            style={{ gridTemplateColumns: `1.2fr repeat(${segments.length}, 1fr)` }}
          >
            <span className="text-[var(--color-text-body)]">{bucket.label}</span>
            {segments.map((seg) => {
              const count = counts[seg.key] ?? 0;
              const pct = total === 0 ? 0 : Math.round((count / total) * 100);
              return (
                <span
                  key={seg.key}
                  className="text-right tabular-nums text-[var(--color-text-body)]"
                >
                  {pct}%
                </span>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

function getSegments(dim: Dimension): SegmentDef[] {
  if (dim === "gender") return GENDER_SEGMENTS;
  if (dim === "verification") return VERIFICATION_SEGMENTS;
  return VISIT_TIER_SEGMENTS;
}

export function CustomerAnalyticsView() {
  const { data, isLoading, error } = useSWR<CustomerAnalytics>("/api/customers/analytics", fetcher);
  const [dimension, setDimension] = useState<Dimension>("gender");

  if (isLoading) {
    return (
      <div className="py-12 text-center">
        <div className="w-6 h-6 border-2 border-[var(--color-brand)] border-t-transparent rounded-full animate-spin mx-auto" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <p className="py-12 text-center text-sm text-[var(--color-text-muted)]">無法載入分析資料</p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-2">
        <StatCard label="累積會員" value={data.totals.total} />
        <div className="grid grid-cols-2 gap-2">
          <StatCard label="已驗證" value={data.totals.verified} />
          <StatCard label="未驗證" value={data.totals.unverified} />
        </div>
      </div>

      <div className="bg-[var(--color-surface)] rounded-xl p-4">
        <h2 className="text-base font-semibold text-[var(--color-text-primary)] mb-3">會員組成分析</h2>

        <div className="flex gap-1 bg-[var(--color-bg)] rounded-lg p-1 mb-2">
          {DIMENSIONS.map((d) => (
            <button
              key={d.key}
              onClick={() => setDimension(d.key)}
              className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
                dimension === d.key
                  ? "bg-[var(--color-bg-elevated,#fff)] text-[var(--color-brand)] shadow-sm"
                  : "text-[var(--color-text-muted)]"
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>

        <PieSection data={data} dimension={dimension} />
        <AgeBucketTable buckets={data.ageBuckets} dimension={dimension} />
      </div>
    </div>
  );
}
