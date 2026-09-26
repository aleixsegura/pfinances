import { donutSegments } from "./arc";

export interface DonutSlice {
  key: string;
  label: string;
  value: number;
  /** CSS colour (a `var(--chart-N)` reference). */
  color: string;
}

interface Props {
  slices: DonutSlice[];
  size?: number;
  thickness?: number;
  active?: string | null;
  onActiveChange?: (key: string | null) => void;
  /** Centre text: the headline number and a caption under it. */
  center?: { value: string; label?: string };
  ariaLabel: string;
  className?: string;
}

const GAP_DEG = 2;

/** A small categorical ring with a 2px surface gap between slices and a
 * hover/active state. Identity is never colour-alone: pair it with a legend
 * (the caller's) — this component only draws the ring. */
export default function Donut({
  slices,
  size = 160,
  thickness = 22,
  active = null,
  onActiveChange,
  center,
  ariaLabel,
  className = "",
}: Props) {
  const total = slices.reduce((s, x) => s + Math.max(x.value, 0), 0);
  const center_ = size / 2;
  const radius = center_ - thickness / 2 - 4;
  const circ = 2 * Math.PI * radius;
  const segments = donutSegments(
    slices.map((s) => (total > 0 ? Math.max(s.value, 0) / total : 0)),
    circ,
    slices.length > 1 ? GAP_DEG : 0,
  );

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      style={{ width: size, height: size }}
      className={`block max-w-full ${className}`}
      role="img"
      aria-label={ariaLabel}
    >
      {total === 0 && (
        <circle cx={center_} cy={center_} r={radius} fill="none" stroke="var(--hairline)" strokeWidth={thickness} />
      )}
      <g transform={`rotate(-90 ${center_} ${center_})`}>
        {slices.map((slice, i) => {
          const seg = segments[i];
          const isActive = active === slice.key;
          return (
            <circle
              key={slice.key}
              className={`transition-[stroke-width,opacity] duration-150 ${onActiveChange ? "cursor-pointer" : ""}`}
              cx={center_}
              cy={center_}
              r={radius}
              fill="none"
              stroke={slice.color}
              strokeWidth={isActive ? thickness + 4 : thickness}
              strokeDasharray={`${seg.dash} ${seg.gap}`}
              strokeDashoffset={seg.offset}
              opacity={active === null || isActive ? 1 : 0.35}
              onMouseEnter={onActiveChange ? () => onActiveChange(slice.key) : undefined}
              onMouseLeave={onActiveChange ? () => onActiveChange(null) : undefined}
            >
              <title>{`${slice.label}`}</title>
            </circle>
          );
        })}
      </g>
      {center && (
        <>
          <text
            x={center_}
            y={center_ + (center.label ? -3 : 5)}
            textAnchor="middle"
            className="fill-primary font-semibold tabular-nums"
            style={{ fontSize: size >= 200 ? 20 : size >= 150 ? 16 : 13 }}
          >
            {center.value}
          </text>
          {center.label && (
            <text
              x={center_}
              y={center_ + 14}
              textAnchor="middle"
              className="fill-secondary"
              style={{ fontSize: size >= 150 ? 11 : 10 }}
            >
              {center.label}
            </text>
          )}
        </>
      )}
    </svg>
  );
}
