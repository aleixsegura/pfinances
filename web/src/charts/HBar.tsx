interface Props {
  /** 0–1 share of the track. */
  fraction: number;
  color?: string;
  className?: string;
}

/** A thin proportion bar on a hairline track — the weight glyph in list rows. */
export default function HBar({ fraction, color = "var(--chart-1)", className = "" }: Props) {
  const width = Math.max(0, Math.min(1, fraction)) * 100;
  return (
    <div className={`h-1.5 w-full overflow-hidden rounded-full bg-elevated ${className}`} aria-hidden>
      <div className="h-full rounded-full" style={{ width: `${width}%`, background: color }} />
    </div>
  );
}
