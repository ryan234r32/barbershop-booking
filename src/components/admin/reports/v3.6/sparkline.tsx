import { memo } from "react";

interface SparklinePoint {
  label: string;
  value: number;
  isCurrent?: boolean;
  isPeak?: boolean;
  isTrough?: boolean;
}

interface SparklineProps {
  points: SparklinePoint[];
  height?: number;
  showAxis?: boolean;
}

// V3.8 perf (Wave 2): memo'd — render N 個 SVG <rect> + N 個 axis label。
// `points` reference 只在父層 fetch 變更時換。
function SparklineImpl({ points, height = 56, showAxis = true }: SparklineProps) {
  if (points.length === 0) return null;
  const max = Math.max(...points.map((p) => p.value), 1);
  const w = 100 / points.length;

  const colorFor = (p: SparklinePoint): string => {
    if (p.isCurrent) return "var(--color-success)";
    if (p.isPeak) return "var(--color-service-color)";
    if (p.isTrough) return "var(--color-danger)";
    return "var(--color-text-muted)";
  };

  return (
    <div>
      <svg
        viewBox={`0 0 100 ${height}`}
        preserveAspectRatio="none"
        className="w-full"
        style={{ height }}
      >
        {points.map((p, i) => {
          const barH = (p.value / max) * (height - 8);
          const x = i * w + w * 0.15;
          const barW = w * 0.7;
          return (
            <rect
              key={i}
              x={x}
              y={height - barH - 2}
              width={barW}
              height={Math.max(barH, 1)}
              fill={colorFor(p)}
              opacity={p.isCurrent ? 1 : 0.7}
              rx={1}
            />
          );
        })}
      </svg>
      {showAxis && (
        <div className="flex mt-1" style={{ paddingLeft: `${w * 0.15}%` }}>
          {points.map((p, i) => (
            <div
              key={i}
              className="text-[9px] text-[var(--color-text-muted)] text-center font-mono"
              style={{ width: `${w}%` }}
            >
              {(i % 3 === 0 || p.isCurrent) ? p.label : ""}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export const Sparkline = memo(SparklineImpl);
