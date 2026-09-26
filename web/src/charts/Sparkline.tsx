interface Props {
  points: number[];
  height?: number;
  /** CSS colour of the line; the fill is the same colour at low alpha. */
  stroke?: string;
  ariaLabel: string;
  className?: string;
  /** Draw as bars instead of a line (for sparse daily amounts). */
  bars?: boolean;
}

/** A tiny line/area (or bar) chart with no axes — a trend glance inside a
 * card, never the only place a number lives. */
export default function Sparkline({
  points,
  height = 44,
  stroke = "var(--accent)",
  ariaLabel,
  className = "",
  bars = false,
}: Props) {
  const width = 200;
  const n = points.length;
  const max = Math.max(...points, 0);
  const min = Math.min(...points, 0);
  const range = max - min || 1;
  const y = (v: number) => 2 + (height - 4) * (1 - (v - min) / range);
  const x = (i: number) => (n > 1 ? (i / (n - 1)) * width : width / 2);

  if (n === 0) return null;

  if (bars) {
    const slot = width / n;
    const w = Math.max(slot * 0.6, 1);
    return (
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className={`block h-auto w-full ${className}`} role="img" aria-label={ariaLabel}>
        {points.map((v, i) => (
          <rect key={i} x={i * slot + (slot - w) / 2} y={y(v)} width={w} height={Math.max(y(min) - y(v), 0)} fill={stroke} rx={1} />
        ))}
      </svg>
    );
  }

  const path = points.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const area = `${path} L${x(n - 1).toFixed(1)},${y(min).toFixed(1)} L${x(0).toFixed(1)},${y(min).toFixed(1)} Z`;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className={`block h-auto w-full ${className}`} role="img" aria-label={ariaLabel}>
      <path d={area} fill={stroke} opacity={0.12} />
      <path d={path} fill="none" stroke={stroke} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
