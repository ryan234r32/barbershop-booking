"use client";

interface Slice {
  label: string;
  value: number;
  color: string;
}

interface Props {
  data: Slice[];
  size?: number;
}

/**
 * Minimal pie chart using SVG arcs. Renders a single solid circle when one
 * slice has 100%, and skips zero-value slices entirely. The empty-state placeholder
 * is rendered by the caller — this component only handles the geometry.
 */
export function PieChart({ data, size = 200 }: Props) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 4;

  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) {
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle cx={cx} cy={cy} r={r} fill="var(--color-surface)" />
      </svg>
    );
  }

  const nonZero = data.filter((d) => d.value > 0);
  if (nonZero.length === 1) {
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle cx={cx} cy={cy} r={r} fill={nonZero[0].color} />
      </svg>
    );
  }

  const cumulativeSums = nonZero.reduce<number[]>((acc, slice) => {
    const prev = acc.length === 0 ? 0 : acc[acc.length - 1];
    acc.push(prev + slice.value);
    return acc;
  }, []);

  const paths = nonZero.map((slice, idx) => {
    const startSum = idx === 0 ? 0 : cumulativeSums[idx - 1];
    const endSum = cumulativeSums[idx];
    const startAngle = (startSum / total) * Math.PI * 2 - Math.PI / 2;
    const endAngle = (endSum / total) * Math.PI * 2 - Math.PI / 2;

    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);
    const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;

    const d = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;

    return <path key={idx} d={d} fill={slice.color} />;
  });

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
      {paths}
    </svg>
  );
}
