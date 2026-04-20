'use client';

type Props = { series: number[]; /** Réduit la largeur pour tableaux denses sans scroll horizontal */ compact?: boolean };

export function AdminClientUsageSparkline({ series, compact = false }: Props) {
  const vals = series.length >= 7 ? series.slice(-7) : [...series, ...Array(7 - series.length).fill(0)].slice(0, 7);
  const max = Math.max(1, ...vals);
  const w = compact ? 52 : 72;
  const h = compact ? 20 : 28;
  const pad = 3;
  const pts = vals
    .map((v, i) => {
      const x = pad + (i / Math.max(1, vals.length - 1)) * (w - pad * 2);
      const y = pad + (1 - v / max) * (h - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      className="shrink-0 text-indigo-400/90"
      aria-hidden
    >
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth={compact ? 1.5 : 1.25}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        points={pts}
      />
    </svg>
  );
}
